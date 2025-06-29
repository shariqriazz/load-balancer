import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import keyManager from '@/lib/services/keyManager';
import { logError, requestLogger } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings';
import { v4 as uuidv4 } from 'uuid';
import { RequestLog } from '@/lib/models/RequestLog';
import { LoadBalancer } from '@/lib/services/loadBalancer';

// Tool extraction function to convert XML-style tools to OpenAI format
function extractToolsFromSystemMessage(systemContent: string): any[] {
  const tools: any[] = [];
  
  // Pattern to match tool definitions in the system message
  // Looking for ## tool_name followed by description and parameters
  const toolPattern = /## (\w+)\s*\n([\s\S]*?)(?=\n## |\n# |$)/g;
  const matches = systemContent.matchAll(toolPattern);
  
  for (const match of matches) {
    const toolName = match[1];
    const toolDescription = match[2];
    
    // Extract description
    const descMatch = toolDescription.match(/Description:\s*([^\n]+)/);
    const description = descMatch ? descMatch[1].trim() : `Tool: ${toolName}`;
    
    // Extract parameters
    const parameters: any = {
      type: "object",
      properties: {},
      required: []
    };
    
    // Look for Parameters section
    const paramSection = toolDescription.match(/Parameters:\s*\n([\s\S]*?)(?=\nUsage:|$)/);
    if (paramSection) {
      const paramText = paramSection[1];
      // Extract parameter definitions like "- param_name: (required) description"
      const paramMatches = paramText.matchAll(/- (\w+):\s*(\(required\))?\s*([^\n]+)/g);
      
      for (const paramMatch of paramMatches) {
        const paramName = paramMatch[1];
        const isRequired = !!paramMatch[2];
        const paramDesc = paramMatch[3].trim();
        
        parameters.properties[paramName] = {
          type: "string",
          description: paramDesc
        };
        
        if (isRequired) {
          parameters.required.push(paramName);
        }
      }
    }
    
    // Create OpenAI-compatible tool definition
    const tool = {
      type: "function",
      function: {
        name: toolName,
        description: description,
        parameters: parameters
      }
    };
    
    tools.push(tool);
  }
  
  return tools;
}

// Function to convert JSON tool calls back to XML format
function convertToolCallsToXML(content: string): string {
  let processedContent = content;
  
  // Pattern 1: Standard OpenAI tool call format
  const openAIPattern = /```json\s*\{\s*"name":\s*"([^"]+)",\s*"parameters":\s*(\{[^}]*\})\s*\}\s*```/g;
  processedContent = processedContent.replace(openAIPattern, (match, toolName, parametersJson) => {
    try {
      const parameters = JSON.parse(parametersJson);
      return formatAsXML(toolName, parameters);
    } catch (error) {
      return match;
    }
  });
  
  // Pattern 2: Function call format that Gemini might use
  const functionCallPattern = /\{\s*"function_call":\s*\{\s*"name":\s*"([^"]+)",\s*"arguments":\s*"([^"]+)"\s*\}\s*\}/g;
  processedContent = processedContent.replace(functionCallPattern, (match, toolName, argumentsJson) => {
    try {
      const parameters = JSON.parse(argumentsJson);
      return formatAsXML(toolName, parameters);
    } catch (error) {
      return match;
    }
  });
  
  // Pattern 3: Direct JSON object with tool info
  const directJsonPattern = /\{\s*"tool":\s*"([^"]+)",\s*"parameters":\s*(\{[^}]*\})\s*\}/g;
  processedContent = processedContent.replace(directJsonPattern, (match, toolName, parametersJson) => {
    try {
      const parameters = JSON.parse(parametersJson);
      return formatAsXML(toolName, parameters);
    } catch (error) {
      return match;
    }
  });
  
  return processedContent;
}

// Helper function to format parameters as XML
function formatAsXML(toolName: string, parameters: any): string {
  let xmlContent = `<${toolName}>`;
  
  // Convert each parameter to XML format
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'object' && value !== null) {
      // Handle nested objects
      xmlContent += `\n<${key}>`;
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        xmlContent += `\n  <${nestedKey}>${nestedValue}</${nestedKey}>`;
      }
      xmlContent += `\n</${key}>`;
    } else {
      xmlContent += `\n<${key}>${value}</${key}>`;
    }
  }
  
  xmlContent += `\n</${toolName}>`;
  return xmlContent;
}

// Function to process streaming response and convert tool calls
function processStreamingChunk(chunk: string, requestId: string): string {
  // Look for tool calls in streaming chunks and convert them
  return convertToolCallsToXML(chunk);
}

// Function to clean system message by removing tool definitions
function cleanSystemMessage(systemContent: string): string {
  // Find the TOOL USE section and remove everything from there until the final ====
  const toolSectionStart = systemContent.indexOf('TOOL USE');
  if (toolSectionStart === -1) {
    return systemContent; // No TOOL USE section found
  }
  
  // Find the last ==== section which should contain final instructions
  const lastSeparatorIndex = systemContent.lastIndexOf('====');
  
  if (lastSeparatorIndex > toolSectionStart) {
    // Keep everything before TOOL USE and everything after the last ====
    const beforeTools = systemContent.substring(0, toolSectionStart).trim();
    const afterTools = systemContent.substring(lastSeparatorIndex);
    return beforeTools + '\n\n' + afterTools;
  } else {
    // No final section, just remove everything from TOOL USE onwards
    return systemContent.substring(0, toolSectionStart).trim();
  }
}
async function handleStreamingResponse(axiosResponse: any, res: any, requestId: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let isAborted = false;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of axiosResponse.data) {
          if (isAborted) {
            break;
          }
          
          // Decode the chunk to process it
          const chunkText = decoder.decode(chunk, { stream: true });
          
          // Process the chunk to convert any tool calls from JSON to XML
          const processedChunk = processStreamingChunk(chunkText, requestId);
          
          // Re-encode and send
          controller.enqueue(encoder.encode(processedChunk));
        }
      } catch (error) {
        if (!isAborted) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      } finally {
        if (!isAborted) {
          controller.close();
        }
      }
    },
    cancel() {
      isAborted = true;
      // Cleanup axios response stream if possible
      if (axiosResponse.data && typeof axiosResponse.data.destroy === 'function') {
        axiosResponse.data.destroy();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

export async function POST(req: NextRequest) {
  const masterApiKey = process.env.MASTER_API_KEY;

  if (masterApiKey) {
    const authHeader = req.headers.get('Authorization');
    const incomingKey = authHeader?.split(' ')[1];

    if (!incomingKey || incomingKey !== masterApiKey) {
      requestLogger.warn('Unauthorized access attempt with Master Key', { path: req.nextUrl.pathname });
      return NextResponse.json(
        { error: { message: 'Unauthorized', type: 'authentication_error' } },
        { status: 401 }
      );
    }
  }

  // Fetch settings to get maxRetries, endpoint
  const settings = await readSettings();
  const maxRetries = settings.maxRetries || 3;
  const baseEndpoint = settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai';
  
  
  console.log('Using endpoint for chat completions:', baseEndpoint);

  let retryCount = 0;
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Get client IP
  const ipAddress = req.headers.get('x-forwarded-for') || req.ip;

  // Parse the request body
  let body: any;
  try {
    body = await req.json();
  } catch (parseError: any) {
    logError(parseError, { context: 'Chat completions - Body Parsing', requestId });
    // Log to DB as well
    await RequestLog.create({
        apiKeyId: 'N/A', // No key involved yet
        statusCode: 400,
        isError: true,
        errorType: 'InvalidRequestError',
        errorMessage: 'Failed to parse request body: ' + parseError.message,
        responseTime: Date.now() - startTime,
        ipAddress: ipAddress || null,
    }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' }));

    return NextResponse.json(
      { error: { message: 'Invalid request body', type: 'invalid_request_error' } },
      { status: 400 }
    );
  }
  const isStreaming = body?.stream === true;

  // Log incoming request (sanitized)
  requestLogger.info('Incoming Request', {
    requestId,
    path: '/api/v1/chat/completions',
    method: 'POST',
    model: body?.model,
    streaming: isStreaming,
    messageCount: body?.messages?.length || 0,
    hasTools: !!(body?.tools && body.tools.length > 0),
    ipAddress: ipAddress,
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date().toISOString()
  });


  let apiKeyIdForAttempt: string | null = null; // Store the ID used for the current attempt
  
  // Create a copy of the original body to use for the request - moved outside of try block
  let requestBody = JSON.parse(JSON.stringify(body));

  // Extract tools from system message if no tools array is present
  if (!requestBody.tools || requestBody.tools.length === 0) {
    const systemMessage = requestBody.messages?.find((msg: any) => msg.role === 'system');
    if (systemMessage?.content) {
      const extractedTools = extractToolsFromSystemMessage(systemMessage.content);
      
      if (extractedTools.length > 0) {
        
        // Try different approaches based on the model
        const isGeminiModel = requestBody.model?.includes('gemini');
        
        if (isGeminiModel) {
          // For Gemini, keep tools in system message but add a clear instruction
          const toolInstruction = `\n\nIMPORTANT: When you need to perform actions, you MUST use the tools provided above. Format your tool calls exactly as shown in the examples using XML tags like <tool_name><parameter>value</parameter></tool_name>.`;
          systemMessage.content = systemMessage.content + toolInstruction;
          
        } else {
          // For other models, try the OpenAI function calling approach
          requestBody.tools = extractedTools;
          requestBody.tool_choice = "auto";
          
          // Clean the system message by removing tool definitions
          const cleanedContent = cleanSystemMessage(systemMessage.content);
          systemMessage.content = cleanedContent;
        }
      }
    }
  }

  while (retryCount < maxRetries) {
    try {
      // Get the current key or rotate if needed
      const { key: currentKeyValue, id: currentKeyId } = await keyManager.getKey();
      apiKeyIdForAttempt = currentKeyId; // Store ID for potential error logging
      
      const axiosConfig: any = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKeyValue}`,
        },
        timeout: 120000, // 2 minutes timeout
        validateStatus: (status: number) => status < 500 || status === 503, // Don't throw on client errors
      };
      


      // Add responseType: 'stream' for streaming requests
      if (isStreaming) {
        axiosConfig.responseType = 'stream';
      }


      const response = await axios.post(
        `${baseEndpoint}/chat/completions`,
        requestBody, // Use the possibly modified request body
        axiosConfig
      );

      // Mark the successful use of the key
      await keyManager.markKeySuccess();
      
      // Decrement connection count for load balancing
      LoadBalancer.decrementConnections(apiKeyIdForAttempt);

      // Log successful response
      const responseTime = Date.now() - startTime;
      
      
      // Log success to DB
      await RequestLog.create({
        apiKeyId: apiKeyIdForAttempt, // Use the ID from this attempt
        statusCode: 200,
        isError: false,
        modelUsed: requestBody?.model,
        responseTime: responseTime,
        ipAddress: ipAddress || null,
      }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' }));

      // Handle streaming response differently
      if (isStreaming) {
        return handleStreamingResponse(response, null, requestId);
      }

      // For non-streaming responses, convert tool calls in the response
      const responseData = response.data;
      
      if (responseData?.choices?.[0]?.message?.content) {
        const originalContent = responseData.choices[0].message.content;
        const convertedContent = convertToolCallsToXML(originalContent);
        responseData.choices[0].message.content = convertedContent;
      }

      return NextResponse.json(responseData);
    } catch (error: any) {

      const isRateLimit = await keyManager.markKeyError(error);

      // Only retry on rate limits or server errors
      // If maxRetries is 3, we want to retry when retryCount is 0, 1, or 2. We stop if retryCount becomes 3.
      // So the condition should be `retryCount < maxRetries`.
      if ((isRateLimit || error.response?.status >= 500) && retryCount < maxRetries) {
        retryCount++;
        
        // Add exponential backoff for retries
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Max 10 seconds
        if (backoffDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        continue;
      }

      // Determine if it's an API key related error
      const responseTime = Date.now() - startTime;
      const statusCode = error.response?.status || 500; // Default to 500 if no response status
      const isApiKeyError = statusCode === 401 || statusCode === 403 || statusCode === 429;
      let errorType = 'UpstreamError'; // Default error type
      if (isApiKeyError) {
        errorType = 'ApiKeyError';
      } else if (statusCode >= 500) {
        errorType = 'UpstreamServerError';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorType = 'UpstreamTimeoutError';
      }
      // Log error to DB (only if not retrying or if it's the last retry attempt)
      if (!((isRateLimit || statusCode >= 500) && retryCount < maxRetries)) {
        await RequestLog.create({
          apiKeyId: apiKeyIdForAttempt || 'UNKNOWN', // Use ID or fallback
          statusCode: statusCode,
          isError: true,
          errorType: errorType,
          errorMessage: error.response?.data?.error?.message || error.message,
          modelUsed: requestBody?.model,
          responseTime: responseTime,
          ipAddress: ipAddress || null,
        }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' }));
      }

      // For non-streaming requests, send error response
      return NextResponse.json(
        {
          error: {
            message: error.response?.data?.error?.message || error.message,
            type: error.response?.data?.error?.type || 'internal_error'
          }
        },
        { status: error.response?.status || 500 }
      );
    }
  }

  // If loop finishes due to max retries, log the final error
  const finalResponseTime = Date.now() - startTime;
  logError(new Error('Maximum retries exceeded'), {
    context: 'Chat completions - Max Retries',
    requestId,
    retryCount,
    statusCode: 500,
    streaming: isStreaming,
    responseTime: finalResponseTime,
    model: requestBody?.model,
    errorType: 'MaxRetriesExceeded'
  });

  // Log final failure to DB
  await RequestLog.create({
    apiKeyId: apiKeyIdForAttempt || 'UNKNOWN', // Use ID or fallback
    statusCode: 500,
    isError: true,
    errorType: 'MaxRetriesExceeded',
    errorMessage: 'Maximum retries exceeded after multiple upstream failures.',
    modelUsed: requestBody?.model,
    responseTime: finalResponseTime,
    ipAddress: ipAddress || null,
  }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' })); // Catch potential DB errors

  return NextResponse.json(
    {
      error: {
        message: 'Maximum retries exceeded',
        type: 'internal_error'
      }
    },
    { status: 500 }
  );
}
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import keyManager from '@/lib/services/keyManager';
import { logError, requestLogger } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings';
import { v4 as uuidv4 } from 'uuid';
import { RequestLog } from '@/lib/models/RequestLog';
import { LoadBalancer } from '@/lib/services/loadBalancer';
async function handleStreamingResponse(axiosResponse: any, res: any) {
  const encoder = new TextEncoder();
  let isAborted = false;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of axiosResponse.data) {
          if (isAborted) {
            break;
          }
          controller.enqueue(encoder.encode(chunk));
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

  // Fetch settings to get maxRetries, endpoint, and grounding settings
  const settings = await readSettings();
  const maxRetries = settings.maxRetries || 3;
  const baseEndpoint = settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai';
  const enableGoogleGrounding = settings.enableGoogleGrounding || false;
  
  // Check if using Google API and grounding is enabled
  const isGoogleAPI = baseEndpoint.includes('generativelanguage.googleapis.com');
  
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
      
      // Modify the request body to include Google Search grounding if enabled AND only for Google API
      if (isGoogleAPI && enableGoogleGrounding) {
        // Add tools array with Google Search grounding if not already present
        if (!requestBody.tools) {
          requestBody.tools = [];
        }

        // Check if grounding is already requested
        const isGroundingRequested = requestBody.tools.some((tool: any) => 
          tool.googleSearchRetrieval || tool.googleSearch
        );

        // For Gemini models, we don't need to explicitly add the search tool
        // as it's handled implicitly by the model
        const isGeminiModel = requestBody.model?.includes('gemini');
        
        if (isGeminiModel) {
          console.log('Gemini model detected - search grounding handled implicitly by the model');
          // Clear any existing tools as they're not needed for Gemini
          requestBody.tools = [];
        } else {
          // For non-Gemini models (like older Vertex AI models)
          if (isGroundingRequested && requestBody.tools.length > 1) {
            console.warn("Grounding requested with other tools; keeping only search.");
            requestBody.tools = requestBody.tools.filter((tool: any) => 
              tool.googleSearchRetrieval || tool.googleSearch
            );
          }

          // If no grounding tool is present, add googleSearchRetrieval
          if (!isGroundingRequested) {
            requestBody.tools = [{
              "googleSearchRetrieval": {}
            }];
            console.log('Added Google Search grounding for non-Gemini model:', JSON.stringify(requestBody.tools));
          }
        }
        
        // Always set tool_choice to auto when using grounding
        requestBody.tool_choice = "auto";
      }

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
      
      // Log Google Search grounding usage in successful responses
      if (isGoogleAPI && enableGoogleGrounding) {
        requestLogger.info('Used Google Search grounding', {
          requestId,
          model: requestBody?.model,
          responseTime
        });
      }
      
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
        return handleStreamingResponse(response, null);
      }

      return NextResponse.json(response.data);
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
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
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
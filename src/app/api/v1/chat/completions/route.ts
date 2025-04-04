import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import keyManager from '@/lib/services/keyManager';
import { logError, requestLogger } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings'; // Import readSettings
import { v4 as uuidv4 } from 'uuid';
import { RequestLog } from '@/lib/models/RequestLog'; // Import RequestLog model
// Helper function to handle streaming response
async function handleStreamingResponse(axiosResponse: any, res: any) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of axiosResponse.data) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(req: NextRequest) {
  const masterApiKey = process.env.MASTER_API_KEY;

  // --- Master API Key Check ---
  if (masterApiKey) {
    const authHeader = req.headers.get('Authorization');
    const incomingKey = authHeader?.split(' ')[1]; // Extract key from "Bearer <key>"

    if (!incomingKey || incomingKey !== masterApiKey) {
      requestLogger.warn('Unauthorized access attempt with Master Key', { path: req.nextUrl.pathname });
      return NextResponse.json(
        { error: { message: 'Unauthorized', type: 'authentication_error' } },
        { status: 401 }
      );
    }
    // If Master Key is set and valid, proceed
  }
  // If Master Key is NOT set, we proceed without this specific check
  // (maintaining previous behavior where any request could pass this stage,
  // relying on keyManager for outgoing requests).
  // --- End Master API Key Check ---

  // Fetch settings to get maxRetries
  const settings = await readSettings();
  const maxRetries = settings.maxRetries; // Use configured maxRetries

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
    }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' })); // Catch potential DB errors

    return NextResponse.json(
      { error: { message: 'Invalid request body', type: 'invalid_request_error' } },
      { status: 400 }
    );
  }
  const isStreaming = body?.stream === true;

  // Log incoming request
  requestLogger.info('Incoming Request', {
    requestId,
    path: '/api/v1/chat/completions',
    method: 'POST',
    body,
    model: body?.model,
    streaming: isStreaming
  });

  let apiKeyIdForAttempt: string | null = null; // Store the ID used for the current attempt

  while (retryCount < maxRetries) {
    try {
      // Get the current key or rotate if needed
      const { key: currentKeyValue, id: currentKeyId } = await keyManager.getKey();
      apiKeyIdForAttempt = currentKeyId; // Store ID for potential error logging
      
      const axiosConfig: any = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKeyValue}`,
        }
      };

      // Add responseType: 'stream' for streaming requests
      if (isStreaming) {
        axiosConfig.responseType = 'stream';
      }

      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        body,
        axiosConfig
      );

      // Mark the successful use of the key
      await keyManager.markKeySuccess();

      // Log successful response
      const responseTime = Date.now() - startTime;
      // Log success to DB
      await RequestLog.create({
        apiKeyId: apiKeyIdForAttempt, // Use the ID from this attempt
        statusCode: 200,
        isError: false,
        modelUsed: body?.model,
        responseTime: responseTime,
        ipAddress: ipAddress || null,
      }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' })); // Catch potential DB errors

      // File logging for successful response removed (now logged to DB)

      // Handle streaming response differently
      if (isStreaming) {
        return handleStreamingResponse(response, null);
      }

      return NextResponse.json(response.data);
    } catch (error: any) {
      const isRateLimit = await keyManager.markKeyError(error);

      // Only retry on rate limits or server errors
      // Use the fetched maxRetries value in the condition
      // Note: The loop condition is `retryCount < maxRetries`, so we retry as long as count is 0, 1, ..., maxRetries-1
      // The check here should be if we have retries *left*, so check against maxRetries directly.
      // If maxRetries is 3, we want to retry when retryCount is 0 or 1. We stop if retryCount becomes 2.
      // So the condition should be `retryCount < maxRetries - 1`.
      if ((isRateLimit || error.response?.status >= 500) && retryCount < maxRetries - 1) {
        retryCount++;
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

      // File logging for standard errors removed (now logged to DB)
      // We still log the final "Max Retries Exceeded" error to file below.

      // Log error to DB (only if not retrying or if it's the last retry attempt)
      if (!((isRateLimit || statusCode >= 500) && retryCount < maxRetries - 1)) {
        await RequestLog.create({
          apiKeyId: apiKeyIdForAttempt || 'UNKNOWN', // Use ID or fallback
          statusCode: statusCode,
          isError: true,
          errorType: errorType,
          errorMessage: error.response?.data?.error?.message || error.message,
          modelUsed: body?.model,
          responseTime: responseTime,
          ipAddress: ipAddress || null,
        }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' })); // Catch potential DB errors
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
    model: body?.model,
    errorType: 'MaxRetriesExceeded'
  });

  // Log final failure to DB
  await RequestLog.create({
    apiKeyId: apiKeyIdForAttempt || 'UNKNOWN', // Use ID or fallback
    statusCode: 500,
    isError: true,
    errorType: 'MaxRetriesExceeded',
    errorMessage: 'Maximum retries exceeded after multiple upstream failures.',
    modelUsed: body?.model,
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
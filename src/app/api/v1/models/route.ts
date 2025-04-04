export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import keyManager from '@/lib/services/keyManager';
import { logError } from '@/lib/services/logger';

export async function GET(req: NextRequest) {
  const maxRetries = 3;
  let retryCount = 0;

  // Define the upstream URL - **This might need adjustment based on the specific OpenAI-compatible endpoint being used**
  // Let's start with the original one that was present before.
  const upstreamUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/models';

  while (retryCount < maxRetries) {
    let keyData: { key: string; id: string } | null = null; // Store the object returned by getKey
    try {
      keyData = await keyManager.getKey(); // Get key data object

      // Ensure a key was actually retrieved
      // Ensure a key was actually retrieved (getKey should throw if none found, but double-check)
      if (!keyData || !keyData.key) {
          logError(new Error('No available API key found'), { context: 'Models endpoint - getKey' });
          // If no key is found after retries, return an error.
          // If this happens on the first try, the loop might handle it, but explicit check is safer.
          return NextResponse.json(
            { error: { message: 'No available API keys to process the request.', type: 'no_key_available' } },
            { status: 503 } // Service Unavailable might be appropriate
          );
      }

      const axiosConfig = {
        headers: {
          // Use the key string from the keyData object
          'Authorization': `Bearer ${keyData.key}`,
          // Add other headers if required by the specific OpenAI-compatible endpoint
        }
      };

      // Make the request to the upstream URL
      const response = await axios.get(upstreamUrl, axiosConfig);

      // Mark the key as successful only if the request succeeded
      // Mark success (no argument needed)
      await keyManager.markKeySuccess();

      // Return the data from the upstream API
      return NextResponse.json(response.data);

    } catch (error: any) {
      // Mark error (only pass the error object)
      // Note: markKeyError internally uses the keyManager's currentKey state
      const isRateLimit = await keyManager.markKeyError(error);

      // Retry logic: Retry on rate limits or 5xx errors if retries remain
      if ((isRateLimit || error.response?.status >= 500) && retryCount < maxRetries - 1) {
          retryCount++;
          // Log retry attempt, include key ID if available from keyData
          logError(error, { context: 'Models endpoint - Retrying', retryCount, keyIdUsed: keyData?.id, statusCode: error.response?.status });
          continue; // Go to the next iteration of the while loop
      } else if (!keyData) {
           // If keyData was null (e.g., getKey failed initially), log and exit loop
           logError(error, { context: 'Models endpoint - Error before key obtained', retryCount });
          // No key to mark as error, break the loop or return error directly
          // Breaking might lead to the maxRetries error below, which is okay.
          break;
      }


      // Log the final error after retries or for non-retryable errors
      // Log the final error after retries or for non-retryable errors
      logError(error, {
        context: 'Models endpoint - Final Error',
        retryCount,
        keyIdUsed: keyData?.id, // Log the key ID that ultimately failed, if available
        statusCode: error.response?.status,
        responseData: error.response?.data // Log response data if available
      });

      // Return the error response from the upstream API if available, otherwise a generic error
      return NextResponse.json(
        {
          error: {
            message: error.response?.data?.error?.message || error.message || 'Failed to fetch models from upstream API.',
            type: error.response?.data?.error?.type || 'upstream_error'
          }
        },
        { status: error.response?.status || 500 }
      );
    }
  }

  // This part is reached only if the while loop completes (max retries exceeded)
  logError(new Error('Max retries exceeded'), { context: 'Models endpoint - Max Retries' });
  return NextResponse.json(
    {
      error: {
        message: 'Maximum retries exceeded while fetching models from upstream API.',
        type: 'max_retries_exceeded'
      }
    },
    { status: 504 } // Gateway Timeout might be appropriate
  );
}
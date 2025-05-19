export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import keyManager from '@/lib/services/keyManager';
import { logError } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings';

export async function GET(req: NextRequest) {
  const maxRetries = 3;
  let retryCount = 0;

  const settings = await readSettings();
  const baseEndpoint = settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta/openai';
  const upstreamUrl = `${baseEndpoint}/models`;
  
  console.log('Using endpoint for models:', upstreamUrl);

  while (retryCount < maxRetries) {
    let keyData: { key: string; id: string } | null = null;
    try {
      keyData = await keyManager.getKey();

      if (!keyData || !keyData.key) {
          logError(new Error('No available API key found'), { context: 'Models endpoint - getKey' });
          return NextResponse.json(
            { error: { message: 'No available API keys to process the request.', type: 'no_key_available' } },
            { status: 503 } // Service Unavailable might be appropriate
          );
      }

      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${keyData.key}`
        }
      };

      const response = await axios.get(upstreamUrl, axiosConfig);

      await keyManager.markKeySuccess();

      return NextResponse.json(response.data);

    } catch (error: any) {
      const isRateLimit = await keyManager.markKeyError(error);

      if ((isRateLimit || error.response?.status >= 500) && retryCount < maxRetries - 1) {
          retryCount++;
          logError(error, { context: 'Models endpoint - Retrying', retryCount, keyIdUsed: keyData?.id, statusCode: error.response?.status });
          continue;
      } else if (!keyData) {
           logError(error, { context: 'Models endpoint - Error before key obtained', retryCount });
          break;
      }

      logError(error, {
        context: 'Models endpoint - Final Error',
        retryCount,
        keyIdUsed: keyData?.id, // Log the key ID that ultimately failed, if available
        statusCode: error.response?.status,
        responseData: error.response?.data // Log response data if available
      });

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
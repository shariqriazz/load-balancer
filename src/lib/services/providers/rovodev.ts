import axios, { AxiosResponse } from 'axios';
import { RovoDevKey } from '../../models/RovoDevKey';
import { logError, requestLogger } from '../logger';

// RovoDev specific models - only the premium Sonnet models
export const ROVODEV_MODELS = [
  'claude-sonnet-4',           // claude-sonnet-4@20250514 (latest Sonnet 4)
  'claude-3-7-sonnet'          // claude-3-7-sonnet-20250219 (Claude 3.7)
] as const;

export type RovoDevModel = typeof ROVODEV_MODELS[number];

// RovoDev API interfaces
interface RovoDevUsageResponse {
  status: string;
  balance: {
    dailyTotal: number;
    dailyRemaining: number;
    dailyUsed: number;
  };
  retryAfterSeconds?: number;
  userCreditLimits?: {
    user: {
      atlassianAccountId: string;
      cloudId: string;
      atlassianOrgId?: string;
      authType: string;
    };
  };
}

interface RovoDevChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface RovoDevChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface RovoDevError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
  status?: string;
}

export class RovoDevProvider {
  private baseUrl = 'https://api.atlassian.com';
  private chatEndpoint = '/ai-gateway/v1/chat/completions'; // Try AI Gateway endpoint
  private usageEndpoint = '/rovodev/v2/credits/check';

  constructor() {}

  // Map internal model names to RovoDev model identifiers
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'claude-sonnet-4': 'claude-sonnet-4@20250514',
      'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219'
    };
    return modelMap[model] || model;
  }

  // Build authentication headers for RovoDev API
  private buildHeaders(rovoDevKey: RovoDevKey): Record<string, string> {
    // RovoDev uses Basic Auth with base64 encoded email:token
    const credentials = Buffer.from(`${rovoDevKey.email}:${rovoDevKey.apiToken}`).toString('base64');
    
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': 'LoadBalancer/1.0 (RovoDev Provider)',
      'Accept': 'application/json'
    };
  }

  // Check usage/credits for a RovoDev key
  async checkUsage(rovoDevKey: RovoDevKey): Promise<RovoDevUsageResponse | null> {
    try {
      const headers = this.buildHeaders(rovoDevKey);
      
      requestLogger.info('Checking RovoDev usage', { 
        email: rovoDevKey.email,
        endpoint: `${this.baseUrl}${this.usageEndpoint}`
      });

      const response: AxiosResponse<RovoDevUsageResponse> = await axios.get(
        `${this.baseUrl}${this.usageEndpoint}`,
        { 
          headers,
          timeout: 10000
        }
      );

      return response.data;
    } catch (error: any) {
      logError(error, { 
        context: 'RovoDevProvider.checkUsage',
        email: rovoDevKey.email,
        status: error.response?.status,
        data: error.response?.data
      });

      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new Error('Unauthorized: Invalid RovoDev API token or email');
      }
      if (error.response?.status === 403) {
        throw new Error('Forbidden: RovoDev access denied for this user');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limited: RovoDev daily limit exceeded');
      }

      return null;
    }
  }

  // Make a chat completion request
  async makeChatRequest(
    rovoDevKey: RovoDevKey,
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: {
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    } = {}
  ): Promise<RovoDevChatResponse> {
    try {
      const headers = this.buildHeaders(rovoDevKey);
      const mappedModel = this.mapModelName(model);

      const requestData: RovoDevChatRequest = {
        model: mappedModel,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        })),
        stream: options.stream || false,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p
      };

      requestLogger.info('Making RovoDev chat request', {
        email: rovoDevKey.email,
        model: mappedModel,
        messageCount: messages.length,
        endpoint: `${this.baseUrl}${this.chatEndpoint}`
      });

      const response: AxiosResponse<RovoDevChatResponse> = await axios.post(
        `${this.baseUrl}${this.chatEndpoint}`,
        requestData,
        {
          headers,
          timeout: 120000 // 2 minutes for chat requests
        }
      );

      // Record successful token usage
      if (response.data.usage?.total_tokens) {
        await rovoDevKey.recordTokenUsage(response.data.usage.total_tokens);
      }

      // Reset failure count on success
      await rovoDevKey.resetFailures();

      requestLogger.info('RovoDev chat request successful', {
        email: rovoDevKey.email,
        model: mappedModel,
        tokensUsed: response.data.usage?.total_tokens || 0,
        responseId: response.data.id
      });

      return response.data;
    } catch (error: any) {
      logError(error, {
        context: 'RovoDevProvider.makeChatRequest',
        email: rovoDevKey.email,
        model,
        status: error.response?.status,
        data: error.response?.data
      });

      // Record failure
      await rovoDevKey.recordFailure();

      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new Error('Unauthorized: Invalid RovoDev credentials');
      }
      if (error.response?.status === 403) {
        throw new Error('Forbidden: Access denied to this model');
      }
      if (error.response?.status === 404) {
        throw new Error('RovoDev Chat API not available: The chat completions endpoint may not be publicly accessible. RovoDev might only support usage monitoring through their public API.');
      }
      if (error.response?.status === 429) {
        const errorData = error.response.data as RovoDevError;
        if (errorData.error?.message?.includes('DAILY_LIMIT_EXCEEDED')) {
          // Mark key as rate limited
          await rovoDevKey.update({ isDisabledByRateLimit: true });
          throw new Error('Daily token limit exceeded for this account');
        }
        throw new Error('Rate limited: Too many requests');
      }
      if (error.response?.status === 413 || 
          (error.response?.status === 400 && error.response.data?.error?.message?.includes('context limit'))) {
        throw new Error('Context limit exceeded: Request too large');
      }
      if (error.response?.status === 400) {
        const errorData = error.response.data as RovoDevError;
        throw new Error(`Bad request: ${errorData.error?.message || 'Invalid request format'}`);
      }
      if (error.response?.status >= 500) {
        throw new Error(`Server error: ${error.response.status} - ${error.response.statusText}`);
      }

      // Generic error
      throw new Error(`RovoDev API error: ${error.message}`);
    }
  }

  // Validate that a model is supported
  isModelSupported(model: string): boolean {
    return ROVODEV_MODELS.includes(model as RovoDevModel);
  }

  // Get list of supported models
  getSupportedModels(): readonly string[] {
    return ROVODEV_MODELS;
  }

  // Test connection with a RovoDev key
  async testConnection(rovoDevKey: RovoDevKey): Promise<boolean> {
    try {
      const usage = await this.checkUsage(rovoDevKey);
      return usage !== null && usage.status !== 'USER_NOT_AUTHORIZED';
    } catch (error) {
      logError(error, { 
        context: 'RovoDevProvider.testConnection',
        email: rovoDevKey.email
      });
      return false;
    }
  }

  // Sync usage data with RovoDev API
  async syncUsage(rovoDevKey: RovoDevKey): Promise<void> {
    try {
      const usage = await this.checkUsage(rovoDevKey);
      if (!usage) return;

      // Update local token tracking based on remote data
      const remoteUsed = usage.balance.dailyUsed;
      const remoteLimit = usage.balance.dailyTotal;

      if (remoteLimit !== rovoDevKey.dailyTokenLimit) {
        await rovoDevKey.update({ dailyTokenLimit: remoteLimit });
      }

      // If remote usage is higher than local, sync it
      if (remoteUsed > rovoDevKey.dailyTokensUsed) {
        await rovoDevKey.update({ 
          dailyTokensUsed: remoteUsed,
          isDisabledByRateLimit: usage.balance.dailyRemaining <= 0
        });
      }

      requestLogger.info('Synced RovoDev usage data', {
        email: rovoDevKey.email,
        localUsed: rovoDevKey.dailyTokensUsed,
        remoteUsed,
        limit: remoteLimit,
        remaining: usage.balance.dailyRemaining
      });
    } catch (error) {
      logError(error, {
        context: 'RovoDevProvider.syncUsage',
        email: rovoDevKey.email
      });
    }
  }

  // Get the best available key for a profile (least used, active)
  async getBestKey(profile: string): Promise<RovoDevKey | null> {
    try {
      const keys = await RovoDevKey.findActiveByProfile(profile);
      if (keys.length === 0) return null;

      // Reset daily usage for all keys if needed
      for (const key of keys) {
        key.checkDailyReset();
      }

      // Find the key with the most remaining tokens
      let bestKey: RovoDevKey | null = null;
      let maxRemaining = 0;

      for (const key of keys) {
        if (key.isUsable()) {
          const remaining = key.getRemainingTokens();
          if (remaining > maxRemaining) {
            maxRemaining = remaining;
            bestKey = key;
          }
        }
      }

      return bestKey;
    } catch (error) {
      logError(error, {
        context: 'RovoDevProvider.getBestKey',
        profile
      });
      return null;
    }
  }
}

export default RovoDevProvider;
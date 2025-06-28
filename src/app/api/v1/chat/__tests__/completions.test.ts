import { POST } from '@/app/api/v1/chat/completions/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/services/keyManager');
jest.mock('@/lib/services/logger');
jest.mock('@/lib/settings');
jest.mock('@/lib/models/RequestLog');
jest.mock('axios');

import keyManager from '@/lib/services/keyManager';
import { logError, requestLogger } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings';
import { RequestLog } from '@/lib/models/RequestLog';
import axios from 'axios';

// Type the mocked modules
const mockKeyManager = keyManager as jest.Mocked<typeof keyManager>;
const mockLogError = logError as jest.MockedFunction<typeof logError>;
const mockRequestLogger = requestLogger as jest.Mocked<typeof requestLogger>;
const mockReadSettings = readSettings as jest.MockedFunction<typeof readSettings>;
const mockRequestLog = RequestLog as jest.Mocked<typeof RequestLog>;
const mockAxios = axios as jest.Mocked<typeof axios>;

// Create specific mocks for the methods we use
const mockKeyManagerGetKey = mockKeyManager.getKey as jest.MockedFunction<typeof mockKeyManager.getKey>;
const mockKeyManagerMarkKeyError = mockKeyManager.markKeyError as jest.MockedFunction<typeof mockKeyManager.markKeyError>;
const mockKeyManagerMarkKeySuccess = mockKeyManager.markKeySuccess as jest.MockedFunction<typeof mockKeyManager.markKeySuccess>;
const mockRequestLoggerInfo = mockRequestLogger.info as jest.MockedFunction<typeof mockRequestLogger.info>;
const mockRequestLogCreate = mockRequestLog.create as jest.MockedFunction<typeof mockRequestLog.create>;
const mockAxiosPost = mockAxios.post as jest.MockedFunction<typeof mockAxios.post>;

describe('/api/v1/chat/completions', () => {
  // Helper function to create a mock request
  const createMockRequest = (body: any): NextRequest => {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Map([
        ['authorization', 'Bearer test-key'],
        ['content-type', 'application/json'],
      ]),
    } as any;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    mockKeyManagerGetKey.mockResolvedValue({
      key: 'test-api-key',
      id: 'test-key-id',
    });
    
    mockKeyManagerMarkKeySuccess.mockResolvedValue();
    mockKeyManagerMarkKeyError.mockResolvedValue(false);
    mockRequestLogCreate.mockResolvedValue({} as any);
    mockRequestLoggerInfo.mockImplementation(() => ({} as any));
    
    // Default settings
    mockReadSettings.mockResolvedValue({
      keyRotationRequestCount: 10,
      maxFailureCount: 3,
      rateLimitCooldown: 60,
      logRetentionDays: 30,
      maxRetries: 3,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      failoverDelay: 2,
      loadBalancingStrategy: 'round-robin',
      requestRateLimit: 0,
    });
  });

  it('should handle basic chat completion request', async () => {
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }] };
    const req = createMockRequest(requestBody);

    mockAxiosPost.mockResolvedValue({
      data: { choices: [{ message: { content: 'Hello response' } }] },
      status: 200,
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({
        model: 'gemini-pro',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
      expect.any(Object)
    );
  });

  it('should handle streaming responses correctly when stream is true', async () => {
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }], stream: true };
    const req = createMockRequest(requestBody);

    // Mock axios to return a stream-like response
    const mockStream = {
      data: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
          yield Buffer.from('data: [DONE]\n\n');
        }
      }
    };
    
    mockAxiosPost.mockResolvedValue(mockStream);

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({
        model: 'gemini-pro',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
      expect.objectContaining({
        responseType: 'stream'
      })
    );
  });

  it('should handle API errors correctly', async () => {
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }] };
    const req = createMockRequest(requestBody);

    mockAxiosPost.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Bad request' } } }
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(mockKeyManagerMarkKeyError).toHaveBeenCalled();
  });

  it('should retry on rate limit errors', async () => {
    mockReadSettings.mockResolvedValue({
      keyRotationRequestCount: 10,
      maxFailureCount: 3,
      rateLimitCooldown: 60,
      logRetentionDays: 30,
      maxRetries: 2,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      failoverDelay: 2,
      loadBalancingStrategy: 'round-robin',
      requestRateLimit: 0,
    });
    
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }] };
    const req = createMockRequest(requestBody);

    // Simulate rate limit errors
    mockAxiosPost
      .mockRejectedValueOnce({ response: { status: 429, data: { error: { message: 'Rate limit' } } } })
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Success after retry' } }] },
        status: 200,
      });
    
    mockKeyManagerMarkKeyError.mockResolvedValue(true); // Indicate it's a rate limit

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(mockKeyManagerGetKey).toHaveBeenCalledTimes(2);
    expect(mockKeyManagerMarkKeyError).toHaveBeenCalledTimes(1);
    expect(mockKeyManagerMarkKeySuccess).toHaveBeenCalledTimes(1);
  });
});
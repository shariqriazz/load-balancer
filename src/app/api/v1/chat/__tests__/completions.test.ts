import { POST } from '@/app/api/v1/chat/completions/route';
import { NextRequest } from 'next/server';
import { readSettings } from '@/lib/settings';
import keyManager from '@/lib/services/keyManager';
import axios from 'axios';
import { RequestLog } from '@/lib/models/RequestLog';
jest.mock('next/server', () => {
  const actualNextServer = jest.requireActual('next/server');
  return {
    ...actualNextServer, // Keep NextRequest, etc.
    NextResponse: { // Mock the NextResponse object
      ...actualNextServer.NextResponse, // Keep other static methods like redirect()
      json: jest.fn((body: any, init?: ResponseInit) => {
        const headers = new Headers(init?.headers);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        // Return an actual Response object, as NextResponse.json does
        return new Response(JSON.stringify(body), {
          status: init?.status || 200,
          headers: headers,
          statusText: init?.statusText || 'OK'
        });
      }),
    },
  };
});
import { requestLogger, logError } from '@/lib/services/logger';

// Mock dependencies
jest.mock('@/lib/settings');
jest.mock('@/lib/services/keyManager');
jest.mock('axios');
jest.mock('@/lib/models/RequestLog');
jest.mock('@/lib/services/logger');
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

const mockReadSettings = readSettings as jest.Mock;
const mockKeyManagerGetKey = keyManager.getKey as jest.Mock;
const mockKeyManagerMarkKeySuccess = keyManager.markKeySuccess as jest.Mock;
const mockKeyManagerMarkKeyError = keyManager.markKeyError as jest.Mock;
const mockAxiosPost = axios.post as jest.Mock;
const mockRequestLogCreate = RequestLog.create as jest.Mock;
const mockRequestLoggerInfo = requestLogger.info as jest.Mock;
const mockRequestLoggerWarn = requestLogger.warn as jest.Mock;
const mockLogError = logError as jest.Mock;

describe('POST /api/v1/chat/completions - Google Search Grounding Logic', () => {
  let originalMasterApiKey: string | undefined;

  beforeAll(() => {
    originalMasterApiKey = process.env.MASTER_API_KEY;
  });

  afterAll(() => {
    process.env.MASTER_API_KEY = originalMasterApiKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MASTER_API_KEY = ''; // Bypass master key auth by setting to a falsy string

    // Default mocks
    mockKeyManagerGetKey.mockResolvedValue({ key: 'test-api-key', id: 'key-id-123' });
    mockKeyManagerMarkKeySuccess.mockResolvedValue(undefined);
    mockKeyManagerMarkKeyError.mockResolvedValue(false); // No rate limit by default
    mockAxiosPost.mockResolvedValue({ data: { id: 'chatcmpl-test' }, status: 200 });
    mockRequestLogCreate.mockResolvedValue({} as any);
    mockRequestLoggerInfo.mockImplementation(() => {});
    mockRequestLoggerWarn.mockImplementation(() => {});
    mockLogError.mockImplementation(() => {});

    // Default settings (can be overridden in describe blocks or tests)
    mockReadSettings.mockResolvedValue({
      maxRetries: 3,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', // Google API
      enableGoogleGrounding: false, // Default to false
    });
  });

  const createMockRequest = (body: any, headers?: Record<string, string>): NextRequest => {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({
        'Content-Type': 'application/json',
        ...headers,
      }),
      ip: '127.0.0.1',
      nextUrl: new URL('http://localhost/api/v1/chat/completions'),
    } as unknown as NextRequest;
  };

  describe('when enableGoogleGrounding is true and using Google API endpoint', () => {
    beforeEach(() => {
      mockReadSettings.mockResolvedValue({
        maxRetries: 3,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
        enableGoogleGrounding: true,
      });
    });

    it('should clear tools and set tool_choice to "auto" for Gemini models', async () => {
      const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }], tools: [{ type: 'function', function: { name: 'other_tool' } }] };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual([]);
      expect(actualRequestBody.tool_choice).toBe('auto');
      expect(mockRequestLoggerInfo).toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.objectContaining({ model: 'gemini-pro' })
      );
    });

    it('should add googleSearchRetrieval and set tool_choice to "auto" for non-Gemini Google models if no tools exist', async () => {
      const requestBody = { model: 'google-bison', messages: [{ role: 'user', content: 'Hello' }] };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual([{ googleSearchRetrieval: {} }]);
      expect(actualRequestBody.tool_choice).toBe('auto');
      expect(mockRequestLoggerInfo).toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.objectContaining({ model: 'google-bison' })
      );
    });

    it('should keep only googleSearchRetrieval and set tool_choice to "auto" for non-Gemini Google models if grounding is already requested with other tools', async () => {
      const requestBody = {
        model: 'google-bison',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [
          { googleSearchRetrieval: {} },
          { type: 'function', function: { name: 'other_tool' } }
        ]
      };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual([{ googleSearchRetrieval: {} }]);
      expect(actualRequestBody.tool_choice).toBe('auto');
      expect(mockRequestLoggerInfo).toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.objectContaining({ model: 'google-bison' })
      );
    });
    
    it('should add googleSearchRetrieval and set tool_choice to "auto" for non-Gemini Google models if other tools exist but no grounding', async () => {
      const requestBody = {
        model: 'google-bison',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ type: 'function', function: { name: 'other_tool' } }]
      };
      const req = createMockRequest(requestBody);
    
      await POST(req);
    
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      // The logic in route.ts will replace existing tools if grounding is not present
      expect(actualRequestBody.tools).toEqual([{ googleSearchRetrieval: {} }]);
      expect(actualRequestBody.tool_choice).toBe('auto');
      expect(mockRequestLoggerInfo).toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.objectContaining({ model: 'google-bison' })
      );
    });

    it('should not modify tools if googleSearchRetrieval is already the only tool for non-Gemini Google models, but set tool_choice to "auto"', async () => {
      const requestBody = {
        model: 'google-bison',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ googleSearchRetrieval: {} }]
      };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual([{ googleSearchRetrieval: {} }]);
      expect(actualRequestBody.tool_choice).toBe('auto');
      expect(mockRequestLoggerInfo).toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.objectContaining({ model: 'google-bison' })
      );
    });
  });

  describe('when enableGoogleGrounding is false', () => {
    beforeEach(() => {
      mockReadSettings.mockResolvedValue({
        maxRetries: 3,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', // Google API
        enableGoogleGrounding: false,
      });
    });

    it('should not modify tools or tool_choice for any model', async () => {
      const originalTools = [{ type: 'function', function: { name: 'custom_tool' } }];
      const requestBody = {
        model: 'gemini-pro',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: originalTools,
        tool_choice: 'specific_tool'
      };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual(originalTools);
      expect(actualRequestBody.tool_choice).toBe('specific_tool');
      expect(mockRequestLoggerInfo).not.toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.anything()
      );
    });

     it('should not modify tools or tool_choice if tools are initially undefined', async () => {
        const requestBody = {
          model: 'gemini-pro',
          messages: [{ role: 'user', content: 'Hello' }],
        };
        const req = createMockRequest(requestBody);
  
        await POST(req);
  
        expect(mockAxiosPost).toHaveBeenCalledTimes(1);
        const actualRequestBody = mockAxiosPost.mock.calls[0][1];
        expect(actualRequestBody.tools).toBeUndefined();
        expect(actualRequestBody.tool_choice).toBeUndefined();
        expect(mockRequestLoggerInfo).not.toHaveBeenCalledWith(
          'Used Google Search grounding',
          expect.anything()
        );
      });
  });

  describe('when enableGoogleGrounding is true but using a non-Google API endpoint', () => {
    beforeEach(() => {
      mockReadSettings.mockResolvedValue({
        maxRetries: 3,
        endpoint: 'https://api.openai.com/v1', // Non-Google API
        enableGoogleGrounding: true,
      });
    });

    it('should not modify tools or tool_choice for any model', async () => {
      const originalTools = [{ type: 'function', function: { name: 'custom_tool' } }];
      const requestBody = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: originalTools,
        tool_choice: 'specific_tool'
      };
      const req = createMockRequest(requestBody);

      await POST(req);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      const actualRequestBody = mockAxiosPost.mock.calls[0][1];
      expect(actualRequestBody.tools).toEqual(originalTools);
      expect(actualRequestBody.tool_choice).toBe('specific_tool');
      expect(mockRequestLoggerInfo).not.toHaveBeenCalledWith(
        'Used Google Search grounding',
        expect.anything()
      );
    });
  });
  
  // Test for streaming response (basic check, grounding logic is independent of streaming)
  it('should handle streaming responses correctly when stream is true', async () => {
    mockReadSettings.mockResolvedValue({
      maxRetries: 3,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      enableGoogleGrounding: false, // Keep grounding off for simplicity here
    });
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }], stream: true };
    const req = createMockRequest(requestBody);

    // Mock axios to return a stream-like response
    const mockStream = {
      data: {
        async *[Symbol.asyncIterator]() {
          yield 'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n';
          yield 'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';
          yield 'data: [DONE]\n\n';
        }
      },
      headers: { 'content-type': 'text/event-stream' }
    };
    mockAxiosPost.mockResolvedValue(mockStream);

    const response = await POST(req);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(mockAxiosPost.mock.calls[0][2].responseType).toBe('stream');

    // Consume the stream to ensure it works (optional, but good for completeness)
    const reader = response.body?.getReader();
    let result = '';
    if (reader) {
      const decoder = new TextDecoder(); // Ensure TextDecoder is available
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }
    }
    expect(result).toContain('data: {"id":"chatcmpl-123"');
    expect(result).toContain('data: [DONE]');
  });

  // Test for error handling and retries (simplified, focusing on grounding interaction)
  it('should retry on rate limit and eventually fail if maxRetries exceeded', async () => {
    mockReadSettings.mockResolvedValue({
      maxRetries: 2, // Set to 2 for quicker test
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
      enableGoogleGrounding: true,
    });
    const requestBody = { model: 'gemini-pro', messages: [{ role: 'user', content: 'Hello' }] };
    const req = createMockRequest(requestBody);

    // Simulate rate limit errors
    mockAxiosPost
      .mockRejectedValueOnce({ response: { status: 429, data: { error: { message: 'Rate limit' } } } }) // First attempt fails
      .mockRejectedValueOnce({ response: { status: 429, data: { error: { message: 'Rate limit again' } } } }); // Second attempt fails (maxRetries reached)
    
    mockKeyManagerMarkKeyError.mockResolvedValue(true); // Indicate it's a rate limit

    const response = await POST(req);
    const responseJson = await response.json();

    expect(mockAxiosPost).toHaveBeenCalledTimes(2); // Called initial + 1 retry (maxRetries = 2)
    expect(mockKeyManagerGetKey).toHaveBeenCalledTimes(2);
    expect(mockKeyManagerMarkKeyError).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(500); // Should return 500 when max retries exceeded
    expect(responseJson.error.message).toBe('Maximum retries exceeded'); // Message when retries are exhausted
    expect(responseJson.error.type).toBe('internal_error');

    // Check that grounding logic was applied on each attempt
    const firstCallBody = mockAxiosPost.mock.calls[0][1];
    expect(firstCallBody.tools).toEqual([]);
    expect(firstCallBody.tool_choice).toBe('auto');

    const secondCallBody = mockAxiosPost.mock.calls[1][1];
    expect(secondCallBody.tools).toEqual([]);
    expect(secondCallBody.tool_choice).toBe('auto');

    // Verify RequestLog.create was called once for the final max retries exceeded error
    expect(mockRequestLogCreate).toHaveBeenCalledTimes(1);
    expect(mockRequestLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 500,
      isError: true,
      errorMessage: 'Maximum retries exceeded after multiple upstream failures.',
      errorType: 'MaxRetriesExceeded',
      modelUsed: 'gemini-pro', // Ensure this matches the requestBody model
    }));

    // Ensure the "MaxRetriesExceeded" logError WAS called in this scenario
    expect(mockLogError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'MaxRetriesExceeded' })
    );
  });
});
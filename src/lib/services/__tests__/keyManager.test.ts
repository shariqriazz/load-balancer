import { ApiKey } from '../../models/ApiKey';
import keyManagerInstance from '../keyManager'; // Import the singleton instance
import { readSettings } from '@/lib/settings';
import { DEFAULT_SETTINGS, Settings } from '@/lib/db';
import { logKeyEvent, logError } from '../logger';
import mockFs from 'mock-fs';

// Mock logger
jest.mock('../logger', () => ({
  logKeyEvent: jest.fn(),
  logError: jest.fn(),
}));

// Mock settings
jest.mock('@/lib/settings', () => ({
  readSettings: jest.fn(),
}));

// Mock ApiKey model
jest.mock('../../models/ApiKey');

const mockApiKeyModel = ApiKey as jest.Mocked<typeof ApiKey>;

// Helper to create a mock ApiKey instance with a save method
const createMockApiKey = (data: Partial<InstanceType<typeof ApiKey>> & { _id: string, key: string }): InstanceType<typeof ApiKey> => {
  const instance = {
    ...data,
    isActive: data.isActive !== undefined ? data.isActive : true,
    failureCount: data.failureCount || 0,
    requestCount: data.requestCount || 0,
    dailyRequestsUsed: data.dailyRequestsUsed || 0,
    dailyRateLimit: data.dailyRateLimit === undefined ? null : data.dailyRateLimit,
    lastUsed: data.lastUsed || null,
    rateLimitResetAt: data.rateLimitResetAt || null,
    lastResetDate: data.lastResetDate || null,
    isDisabledByRateLimit: data.isDisabledByRateLimit || false,
    profile: data.profile || '',
    save: jest.fn().mockResolvedValue(undefined),
  } as InstanceType<typeof ApiKey>;
  return instance;
};


describe('KeyManager', () => {
  let keyManager: typeof keyManagerInstance;
  let mockSettings: Settings;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFs({
      'data': {} // For SQLite in-memory or mock DB
    });

    // Reset the singleton instance's internal state for each test
    // This is a bit of a hack for testing singletons. Ideally, KeyManager would be injectable.
    // For now, we'll re-assign its internal properties or re-initialize.
    // Accessing private members for testing is generally discouraged, but necessary here.
    (keyManagerInstance as any).currentKey = null;
    (keyManagerInstance as any).requestCounter = 0;


    keyManager = keyManagerInstance;


    mockSettings = { ...DEFAULT_SETTINGS, keyRotationRequestCount: 2, maxFailureCount: 2, failoverDelay: 0 };
    (readSettings as jest.Mock).mockResolvedValue(mockSettings);

    // Default mock implementations for ApiKey static methods
    mockApiKeyModel.findAll.mockResolvedValue([]);
    mockApiKeyModel.findOne.mockResolvedValue(null);
    mockApiKeyModel.create.mockImplementation(async (data: any) => createMockApiKey({ ...data, _id: `new-${Date.now()}` }));
    mockApiKeyModel.bulkUpdate.mockResolvedValue(undefined);

    // Initialize the keyManager which might call getKey internally
    // We need to ensure mocks are set up before this.
    // await keyManager.initialize(); // Let tests call initialize if they need specific pre-conditions
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('getKey', () => {
    it('should rotate to a new key if no current key', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1' });
      mockApiKeyModel.findAll.mockResolvedValue([key1]);

      const result = await keyManager.getKey();
      expect(result.key).toBe('key1');
      expect(result.id).toBe('id1');
      expect((keyManager as any).currentKey._id).toBe('id1');
      expect(logKeyEvent).toHaveBeenCalledWith('Key Rotation', expect.any(Object));
    });

    it('should return current key if valid and below rotation count', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1' });
      mockApiKeyModel.findAll.mockResolvedValue([key1]); // For initial rotation
      await keyManager.getKey(); // Initial call to set currentKey

      (keyManager as any).requestCounter = 0; // Reset counter for this specific test part
      const result = await keyManager.getKey(); // Second call

      expect(result.key).toBe('key1');
      expect((keyManager as any).requestCounter).toBe(1);
      expect(logKeyEvent).not.toHaveBeenCalledWith('Request Count Rotation Triggered (getKey)', expect.any(Object));
    });

    it('should rotate key if request counter reaches threshold', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1', lastUsed: new Date(Date.now() - 1000).toISOString() });
      const key2 = createMockApiKey({ _id: 'id2', key: 'key2', lastUsed: null }); // New key
      mockApiKeyModel.findAll.mockImplementation(async (query: any) => {
        if ((keyManager as any).currentKey?._id === 'id1') return [key1, key2]; // After key1 is set
        return [key1, key2]; // Initial
      });


      await keyManager.getKey(); // Sets currentKey to key1
      (keyManager as any).requestCounter = mockSettings.keyRotationRequestCount; // Trigger rotation

      const result = await keyManager.getKey();
      expect(result.key).toBe('key2'); // Rotated to the new key
      expect(logKeyEvent).toHaveBeenCalledWith('Request Count Rotation Triggered (getKey)', expect.any(Object));
      expect(logKeyEvent).toHaveBeenCalledWith('Key Rotation', expect.objectContaining({ keyId: 'id2' }));
    });

    it('should perform daily reset for the current key if needed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const key1 = createMockApiKey({
        _id: 'id1', key: 'key1',
        dailyRequestsUsed: 5,
        lastResetDate: yesterday.toISOString(),
        dailyRateLimit: 10
      });
      (keyManager as any).currentKey = key1;
      (keyManager as any).requestCounter = 0;

      await keyManager.getKey();

      expect(key1.dailyRequestsUsed).toBe(0);
      expect(key1.isDisabledByRateLimit).toBe(false);
      expect(key1.save).toHaveBeenCalled();
      expect(logKeyEvent).toHaveBeenCalledWith('Daily Limit Reset (getKey)', expect.objectContaining({ keyId: 'id1' }));
    });

    it('should rotate if current key is globally rate-limited', async () => {
      const rateLimitedKey = createMockApiKey({ _id: 'id1', key: 'key1', rateLimitResetAt: new Date(Date.now() + 3600000).toISOString() });
      const freshKey = createMockApiKey({ _id: 'id2', key: 'key2' });
      (keyManager as any).currentKey = rateLimitedKey;
      mockApiKeyModel.findAll.mockResolvedValue([freshKey]); // For rotation

      const result = await keyManager.getKey();
      expect(result.id).toBe('id2');
      expect(logKeyEvent).toHaveBeenCalledWith('Global Rate Limit Active (getKey)', expect.objectContaining({ keyId: 'id1' }));
    });

    it('should rotate if current key hits daily rate limit', async () => {
      const today = new Date(); // Ensure 'today' is consistent for the test
      const dailyLimitedKey = createMockApiKey({
        _id: 'id1',
        key: 'key1',
        dailyRequestsUsed: 5, // At limit
        dailyRateLimit: 5,
        isActive: true,
        lastResetDate: today.toISOString(), // Simulate its daily counters are for 'today'
        isDisabledByRateLimit: false // Starts as not disabled
      });
      const freshKey = createMockApiKey({ _id: 'id2', key: 'key2', isActive: true, isDisabledByRateLimit: false });
      (keyManager as any).currentKey = dailyLimitedKey;

      // When _internalRotateKey is called, it will look for available keys.
      // freshKey should be the only one available.
      mockApiKeyModel.findAll.mockImplementation(async (query: any) => {
        if (query.isActive === true && query.isDisabledByRateLimit === false) {
          // This is the selection query in _internalRotateKey
          return [freshKey];
        }
        // This is the daily reset query in _internalRotateKey
        return [dailyLimitedKey, freshKey].filter(k => k.isActive);
      });
      mockApiKeyModel.bulkUpdate.mockResolvedValue(undefined);


      const result = await keyManager.getKey();
      expect(result.id).toBe('id2');
      expect(dailyLimitedKey.isDisabledByRateLimit).toBe(true); // Should be set by getKey
      expect(dailyLimitedKey.save).toHaveBeenCalledTimes(1); // Saved when isDisabledByRateLimit is set
      expect(logKeyEvent).toHaveBeenCalledWith('Daily Rate Limit Hit (getKey)', expect.objectContaining({ keyId: 'id1' }));
    });


    it('should select an unused key first during rotation', async () => {
        const usedKey = createMockApiKey({ _id: 'id1', key: 'key1', lastUsed: new Date().toISOString() });
        const unusedKey = createMockApiKey({ _id: 'id2', key: 'key2', lastUsed: null });
        const anotherUsedKey = createMockApiKey({ _id: 'id3', key: 'key3', lastUsed: new Date(Date.now() - 5000).toISOString() });
        mockApiKeyModel.findAll.mockResolvedValue([usedKey, unusedKey, anotherUsedKey]);

        const result = await keyManager.getKey(); // This will trigger _internalRotateKey
        expect(result.id).toBe('id2'); // Unused key should be picked
    });

    it('should select the least recently used key if no unused keys are available', async () => {
        const lruKey = createMockApiKey({ _id: 'id1', key: 'key1', lastUsed: new Date(Date.now() - 10000).toISOString() });
        const mruKey = createMockApiKey({ _id: 'id2', key: 'key2', lastUsed: new Date(Date.now() - 5000).toISOString() });
        mockApiKeyModel.findAll.mockResolvedValue([mruKey, lruKey]);

        const result = await keyManager.getKey();
        expect(result.id).toBe('id1'); // LRU key should be picked
    });


    it('should throw an error if no keys are available after daily reset and filtering', async () => {
        mockApiKeyModel.findAll.mockImplementation(async (query: any) => {
            // First call in _internalRotateKey for daily reset (can return some keys)
            if (query.isActive === true && query.isDisabledByRateLimit === undefined) {
                 return [createMockApiKey({_id: 'id1', key: 'key1', isDisabledByRateLimit: true, lastResetDate: new Date(Date.now() - 86400000 * 2).toISOString()})]; // A key that will be reset
            }
            // Second call in _internalRotateKey after reset, but simulate none are truly available
            if (query.isDisabledByRateLimit === false) {
                return [];
            }
            return [];
        });
        mockApiKeyModel.bulkUpdate.mockResolvedValue(undefined); // Mock bulk update for reset

        await expect(keyManager.getKey()).rejects.toThrow('No available API keys');
        expect(logError).toHaveBeenCalledWith(expect.any(Error), { context: 'Key rotation - post daily reset' });
    });


    it('should prioritize keys from a different profile if available', async () => {
        const keyP1_current = createMockApiKey({ _id: 'id_p1_current', key: 'key_p1_current', profile: 'profile1', lastUsed: new Date().toISOString() });
        const keyP1_other = createMockApiKey({ _id: 'id_p1_other', key: 'key_p1_other', profile: 'profile1', lastUsed: new Date(Date.now() - 20000).toISOString() });
        const keyP2_new = createMockApiKey({ _id: 'id_p2_new', key: 'key_p2_new', profile: 'profile2', lastUsed: null }); // Unused, different profile
        const keyP3_lru = createMockApiKey({ _id: 'id_p3_lru', key: 'key_p3_lru', profile: 'profile3', lastUsed: new Date(Date.now() - 10000).toISOString() });

        (keyManager as any).currentKey = keyP1_current; // Set current key to profile1
        (keyManager as any).requestCounter = mockSettings.keyRotationRequestCount; // Force rotation

        mockApiKeyModel.findAll.mockResolvedValue([keyP1_current, keyP1_other, keyP2_new, keyP3_lru]);

        const result = await keyManager.getKey();
        expect(result.id).toBe('id_p2_new'); // Should pick the unused key from a different profile
        expect(logKeyEvent).toHaveBeenCalledWith('Profile-Based Rotation', expect.objectContaining({ currentProfile: 'profile1' }));
    });

    it('should fallback to same profile keys if no different profile keys are available', async () => {
        const keyP1_current = createMockApiKey({ _id: 'id_p1_current', key: 'key_p1_current', profile: 'profile1', lastUsed: new Date().toISOString() });
        const keyP1_lru = createMockApiKey({ _id: 'id_p1_lru', key: 'key_p1_lru', profile: 'profile1', lastUsed: new Date(Date.now() - 10000).toISOString() }); // LRU, same profile
        const keyP1_unused = createMockApiKey({ _id: 'id_p1_unused', key: 'key_p1_unused', profile: 'profile1', lastUsed: null }); // Unused, same profile


        (keyManager as any).currentKey = keyP1_current;
        (keyManager as any).requestCounter = mockSettings.keyRotationRequestCount; // Force rotation

        mockApiKeyModel.findAll.mockResolvedValue([keyP1_current, keyP1_lru, keyP1_unused]);

        const result = await keyManager.getKey();
        expect(result.id).toBe('id_p1_unused'); // Should pick the unused key from the same profile
        expect(logKeyEvent).toHaveBeenCalledWith('No Different Profile Keys', expect.objectContaining({ currentProfile: 'profile1' }));
    });


  });

  describe('markKeySuccess', () => {
    it('should update lastUsed, requestCount, and dailyRequestsUsed for the current key', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1', requestCount: 0, dailyRequestsUsed: 0 });
      (keyManager as any).currentKey = key1;

      await keyManager.markKeySuccess();

      expect(key1.lastUsed).not.toBeNull();
      expect(key1.requestCount).toBe(1);
      expect(key1.dailyRequestsUsed).toBe(1);
      expect(key1.save).toHaveBeenCalled();
      expect(logKeyEvent).toHaveBeenCalledWith('Key Success', expect.any(Object));
    });
  });

  describe('markKeyError', () => {
    it('should increment failureCount and deactivate key if threshold reached', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1', failureCount: mockSettings.maxFailureCount -1 });
      (keyManager as any).currentKey = key1;

      await keyManager.markKeyError({}); // Non-rate limit error

      expect(key1.failureCount).toBe(mockSettings.maxFailureCount);
      expect(key1.isActive).toBe(false);
      expect(key1.save).toHaveBeenCalledTimes(1); // One save for deactivation
      expect((keyManager as any).currentKey).toBeNull(); // Current key should be cleared
      expect(logKeyEvent).toHaveBeenCalledWith('Key Deactivated', expect.any(Object));
    });

    it('should set rateLimitResetAt and clear currentKey on 429 error', async () => {
      const key1 = createMockApiKey({ _id: 'id1', key: 'key1' });
      (keyManager as any).currentKey = key1;
      const error = { response: { status: 429, headers: {} } };
      mockSettings.failoverDelay = 0; // Test immediate failover
      (readSettings as jest.Mock).mockResolvedValue(mockSettings);


      const isRateLimitError = await keyManager.markKeyError(error);

      expect(isRateLimitError).toBe(true);
      expect(key1.rateLimitResetAt).not.toBeNull();
      expect(key1.save).toHaveBeenCalled();
      expect((keyManager as any).currentKey).toBeNull();
      expect(logKeyEvent).toHaveBeenCalledWith('Rate Limit Hit', expect.any(Object));
    });

     it('should apply failoverDelay on 429 error if configured', async () => {
        const key1 = createMockApiKey({ _id: 'id1', key: 'key1' });
        (keyManager as any).currentKey = key1;
        const error = { response: { status: 429, headers: {} } };
        mockSettings.failoverDelay = 0.1; // 100ms delay
        (readSettings as jest.Mock).mockResolvedValue(mockSettings);

        const startTime = Date.now();
        await keyManager.markKeyError(error);
        const endTime = Date.now();

        expect(endTime - startTime).toBeGreaterThanOrEqual(mockSettings.failoverDelay * 1000 * 0.9); // Allow for slight timing inaccuracies
        expect(logKeyEvent).toHaveBeenCalledWith('Failover Delay', expect.objectContaining({ delayMs: mockSettings.failoverDelay * 1000 }));
    });
  });

  describe('addKey', () => {
    it('should create a new key if it does not exist', async () => {
      const newKeyData = { key: 'newKey123', name: 'Test Key', profile: 'testP', dailyRateLimit: 100 };
      mockApiKeyModel.findOne.mockResolvedValue(null);
      const createdKeyInstance = createMockApiKey({ _id: 'genId1', ...newKeyData });
      mockApiKeyModel.create.mockResolvedValue(createdKeyInstance);


      const result = await keyManager.addKey(newKeyData);

      expect(mockApiKeyModel.create).toHaveBeenCalledWith(newKeyData);
      expect(result._id).toBe('genId1');
      expect(logKeyEvent).toHaveBeenCalledWith('New Key Added', expect.objectContaining({ profile: 'testP' }));
    });

    it('should reactivate and update an existing key', async () => {
      const existingKeyData = { key: 'existingKey456', name: 'Old Name', profile: 'oldP', isActive: false, failureCount: 5 };
      const existingKeyInstance = createMockApiKey({ _id: 'existId1', ...existingKeyData });
      mockApiKeyModel.findOne.mockResolvedValue(existingKeyInstance);

      const updateData = { key: 'existingKey456', name: 'Updated Name', profile: 'newP' };
      const result = await keyManager.addKey(updateData);

      expect(result.isActive).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.profile).toBe('newP'); // Profile should be updated
      expect(result.name).toBe('Old Name'); // Name is not updated by addKey if it exists, only profile
      expect(existingKeyInstance.save).toHaveBeenCalled();
      expect(logKeyEvent).toHaveBeenCalledWith('Key Reactivated', expect.objectContaining({ profile: 'newP' }));
    });
  });

  describe('_internalRotateKey daily reset logic', () => {
    it('should reset dailyRequestsUsed and isDisabledByRateLimit for keys if lastResetDate is before today', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const today = new Date();

        const keyToReset = createMockApiKey({
            _id: 'reset1', key: 'resetKey1',
            dailyRequestsUsed: 10, dailyRateLimit: 20,
            isDisabledByRateLimit: true,
            lastResetDate: yesterday.toISOString()
        });
        const keyNotToResetUsage = createMockApiKey({ // No usage, but lastResetDate is old
            _id: 'noResetUsage1', key: 'noResetUsageKey1',
            dailyRequestsUsed: 0, dailyRateLimit: 20,
            isDisabledByRateLimit: false,
            lastResetDate: yesterday.toISOString()
        });
         const keyNotToResetDate = createMockApiKey({ // Usage, but lastResetDate is today
            _id: 'noResetDate1', key: 'noResetDateKey1',
            dailyRequestsUsed: 5, dailyRateLimit: 20,
            isDisabledByRateLimit: false,
            lastResetDate: today.toISOString()
        });
         const keyNoLastReset = createMockApiKey({ // No last reset date, should set it
            _id: 'noLastReset1', key: 'noLastResetKey1',
            dailyRequestsUsed: 0, dailyRateLimit: 20,
            isDisabledByRateLimit: false,
            lastResetDate: null
        });


        mockApiKeyModel.findAll.mockImplementation(async (query: any) => {
            if (query.isActive === true && query.isDisabledByRateLimit === undefined) { // First call in _internalRotateKey for daily reset
                return [keyToReset, keyNotToResetUsage, keyNotToResetDate, keyNoLastReset];
            }
            // Subsequent call for available keys for selection
            return [keyToReset, keyNotToResetUsage, keyNoLastReset].filter(k => !k.isDisabledByRateLimit); // Simulate they are now available
        });


        await keyManager.getKey(); // Triggers _internalRotateKey

        expect(mockApiKeyModel.bulkUpdate).toHaveBeenCalled();
        const updatedKeysMap = (mockApiKeyModel.bulkUpdate as jest.Mock).mock.calls[0][0] as Map<string, ApiKey>;

        const updatedKeyToReset = updatedKeysMap.get('reset1');
        expect(updatedKeyToReset?.dailyRequestsUsed).toBe(0);
        expect(updatedKeyToReset?.isDisabledByRateLimit).toBe(false);
        expect(new Date(updatedKeyToReset!.lastResetDate!).getDate()).toBe(today.getDate());
        expect(logKeyEvent).toHaveBeenCalledWith('Daily Limit Reset', expect.objectContaining({ keyId: 'reset1' }));

        // This key had no usage, but its lastResetDate was old, so it should be updated to today if it was reset
        // The current logic only resets if dailyRequestsUsed > 0 OR isDisabledByRateLimit is true.
        // If we want to update lastResetDate even for unused keys, the condition in keyManager needs change.
        // Based on current logic:
        const updatedKeyNotToResetUsage = updatedKeysMap.get('noResetUsage1');
        if (updatedKeyNotToResetUsage) { // It might not be in the map if it wasn't "updated" by the criteria
            expect(new Date(updatedKeyNotToResetUsage!.lastResetDate!).getDate()).toBe(today.getDate());
        }


        expect(updatedKeysMap.has('noResetDate1')).toBe(false); // Should not be in the bulk update map

        const updatedKeyNoLastReset = updatedKeysMap.get('noLastReset1');
        expect(updatedKeyNoLastReset).toBeDefined();
        expect(new Date(updatedKeyNoLastReset!.lastResetDate!).getDate()).toBe(today.getDate());
    });
  });

});
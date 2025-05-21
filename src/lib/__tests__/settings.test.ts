import mockFs from 'mock-fs';
import { readSettings, writeSettings, Settings, _clearCache as clearSettingsCache } from '../settings';
import { getDb, DEFAULT_SETTINGS } from '../db';
import { logError } from '@/lib/services/logger';

// Mock the logger to prevent actual logging during tests and allow spying
jest.mock('@/lib/services/logger', () => ({
  logError: jest.fn(),
}));

// Mock the getDb function to control database interactions
jest.mock('../db', () => {
  const originalDb = jest.requireActual('../db');
  return {
    ...originalDb,
    getDb: jest.fn(),
  };
});

const mockDb = {
  run: jest.fn(),
  get: jest.fn(),
  close: jest.fn(),
};

describe('Settings', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    clearSettingsCache(); // Clear cache before each test
    (getDb as jest.Mock).mockResolvedValue(mockDb); // Ensure getDb returns our mockDb

    // Mock file system for sqlite
    mockFs({
      'data': {} // Ensure data directory exists for the in-memory DB or mock DB
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('readSettings', () => {
    it('should return default settings if database is empty and write defaults back', async () => {
      mockDb.get.mockResolvedValue(null); // Simulate no settings in DB
      mockDb.run.mockResolvedValue({ changes: 1 }); // Simulate successful write

      const settings = await readSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT config FROM settings WHERE id = 1');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (id, config) VALUES (?, ?)',
        1,
        JSON.stringify(DEFAULT_SETTINGS)
      );
      expect(logError).toHaveBeenCalledWith(expect.any(Error), { context: 'readSettingsFromDb' });
    });

    it('should return settings from database if they exist', async () => {
      const storedSettings: Settings = {
        ...DEFAULT_SETTINGS,
        loadBalancingStrategy: 'round-robin',
        requestRateLimit: 50,
      };
      mockDb.get.mockResolvedValue({ config: JSON.stringify(storedSettings) });

      const settings = await readSettings();

      expect(settings).toEqual(storedSettings);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT config FROM settings WHERE id = 1');
      expect(mockDb.run).not.toHaveBeenCalled(); // Should not write if read is successful
    });

    it('should return cached settings if cache is valid', async () => {
      const initialSettings: Settings = { ...DEFAULT_SETTINGS, requestRateLimit: 100, loadBalancingStrategy: 'random' };
      mockDb.get.mockResolvedValueOnce({ config: JSON.stringify(initialSettings) });

      // First call to populate cache
      await readSettings();
      expect(mockDb.get).toHaveBeenCalledTimes(1);

      // Second call, should use cache
      const cached = await readSettings();
      expect(cached).toEqual(initialSettings);
      expect(mockDb.get).toHaveBeenCalledTimes(1); // Still 1, meaning cache was used
    });

    it('should refresh cache if cache is expired', async () => {
      const initialSettings: Settings = { ...DEFAULT_SETTINGS, requestRateLimit: 100, loadBalancingStrategy: 'random' };
      const updatedSettings: Settings = { ...DEFAULT_SETTINGS, requestRateLimit: 200, loadBalancingStrategy: 'least-connections' };
      mockDb.get.mockResolvedValueOnce({ config: JSON.stringify(initialSettings) });

      // Populate cache
      await readSettings();
      expect(mockDb.get).toHaveBeenCalledTimes(1);

      // Fast-forward time to expire cache
      const originalNow = Date.now;
      const CACHE_DURATION_MS = 60 * 1000; // Make sure this matches the one in settings.ts
      Date.now = jest.fn(() => originalNow() + CACHE_DURATION_MS + 1000);


      mockDb.get.mockResolvedValueOnce({ config: JSON.stringify(updatedSettings) }); // Next DB call returns updated
      const refreshedSettings = await readSettings();

      expect(refreshedSettings).toEqual(updatedSettings);
      expect(mockDb.get).toHaveBeenCalledTimes(2); // Called again to refresh

      Date.now = originalNow; // Restore Date.now
    });


    it('should return default settings and log error if database read fails', async () => {
      const dbError = new Error('Database read failed');
      mockDb.get.mockRejectedValue(dbError);

      const settings = await readSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(logError).toHaveBeenCalledWith(dbError, { context: 'readSettingsFromDb' });
    });

    it('should merge loaded settings with defaults to ensure all keys are present', async () => {
        const partialStoredSettings = {
            // Missing some keys from DEFAULT_SETTINGS
            loadBalancingStrategy: 'random' as const, // Use 'as const' for literal types
            requestRateLimit: 75,
        };
        const expectedMergedSettings: Settings = {
            ...DEFAULT_SETTINGS,
            ...partialStoredSettings,
        };
        mockDb.get.mockResolvedValue({ config: JSON.stringify(partialStoredSettings) });

        const settings = await readSettings();
        expect(settings).toEqual(expectedMergedSettings);
    });
  });

  describe('writeSettings', () => {
    it('should write settings to the database and update cache', async () => {
      const newSettings: Settings = {
        ...DEFAULT_SETTINGS,
        loadBalancingStrategy: 'least-connections',
        requestRateLimit: 120,
      };
      mockDb.run.mockResolvedValue({ changes: 1 }); // Simulate successful write

      await writeSettings(newSettings);

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (id, config) VALUES (?, ?)',
        1,
        JSON.stringify(newSettings)
      );

      // Verify cache is updated
      mockDb.get.mockResolvedValue({ config: JSON.stringify(newSettings) }); // Simulate DB now has new settings
      const cachedSettings = await readSettings(); // This should hit the cache updated by writeSettings
      expect(cachedSettings).toEqual(newSettings);
      // Ensure readSettings didn't re-fetch from DB after write if cache was updated correctly
      // This depends on the internal implementation of readSettings cache update on write.
      // If writeSettings updates the internal cache variable directly, this test is fine.
      // If readSettings always fetches after a write (e.g. if cache invalidation is aggressive),
      // then mockDb.get might be called again.
      // Based on current settings.ts, writeSettings updates the cache.
      expect(mockDb.get).not.toHaveBeenCalled(); // After the write, readSettings should use the fresh cache
    });

    it('should throw error and log if database write fails', async () => {
      const newSettings: Settings = { ...DEFAULT_SETTINGS, requestRateLimit: 150 };
      const dbError = new Error('Database write failed');
      mockDb.run.mockRejectedValue(dbError);

      await expect(writeSettings(newSettings)).rejects.toThrow(dbError);
      expect(logError).toHaveBeenCalledWith(dbError, { context: 'writeSettingsToDb' });
    });
  });
});
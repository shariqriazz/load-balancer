import { RovoDevKey } from '../models/RovoDevKey';
import RovoDevProvider from './providers/rovodev';
import { logError, requestLogger } from './logger';

export interface CreateRovoDevKeyData {
  profile: string;
  email: string;
  apiToken: string;
  cloudId?: string;
  dailyTokenLimit?: number;
}

export interface UpdateRovoDevKeyData {
  email?: string;
  apiToken?: string;
  cloudId?: string;
  dailyTokenLimit?: number;
  isActive?: boolean;
}

export class RovoDevKeyManager {
  private provider: RovoDevProvider;

  constructor() {
    this.provider = new RovoDevProvider();
  }

  // Create a new RovoDev key
  async createKey(data: CreateRovoDevKeyData): Promise<RovoDevKey> {
    try {
      // Validate email format
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Validate API token (basic format check)
      if (!data.apiToken || data.apiToken.length < 10) {
        throw new Error('Invalid API token - must be at least 10 characters');
      }

      // Create the key
      const rovoDevKey = await RovoDevKey.create({
        profile: data.profile,
        email: data.email,
        apiToken: data.apiToken,
        cloudId: data.cloudId,
        dailyTokenLimit: data.dailyTokenLimit || 20000000 // 20M default
      });

      // Test the connection (optional - allow creation even if test fails)
      try {
        const isValid = await this.provider.testConnection(rovoDevKey);
        if (!isValid) {
          requestLogger.warn('RovoDev connection test failed, but allowing key creation', {
            email: rovoDevKey.email,
            profile: rovoDevKey.profile
          });
        }
      } catch (error) {
        requestLogger.warn('RovoDev connection test error, but allowing key creation', {
          email: rovoDevKey.email,
          profile: rovoDevKey.profile,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Sync usage data (optional)
      try {
        await this.provider.syncUsage(rovoDevKey);
      } catch (error) {
        requestLogger.warn('Failed to sync RovoDev usage data during creation', {
          email: rovoDevKey.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      requestLogger.info('Created new RovoDev key', {
        id: rovoDevKey._id,
        profile: rovoDevKey.profile,
        email: rovoDevKey.email,
        isInternal: rovoDevKey.isInternal
      });

      return rovoDevKey;
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.createKey',
        profile: data.profile,
        email: data.email
      });
      throw error;
    }
  }

  // Update an existing RovoDev key
  async updateKey(id: string, updates: UpdateRovoDevKeyData): Promise<RovoDevKey> {
    try {
      const rovoDevKey = await RovoDevKey.findById(id);
      if (!rovoDevKey) {
        throw new Error('RovoDev key not found');
      }

      // Validate email if being updated
      if (updates.email && !this.isValidEmail(updates.email)) {
        throw new Error('Invalid email format');
      }

      // Validate API token if being updated
      if (updates.apiToken && updates.apiToken.length < 10) {
        throw new Error('Invalid API token - must be at least 10 characters');
      }

      // Apply updates
      await rovoDevKey.update(updates);

      // Test connection if credentials changed
      if (updates.email || updates.apiToken) {
        const isValid = await this.provider.testConnection(rovoDevKey);
        if (!isValid) {
          throw new Error('Failed to authenticate with updated credentials');
        }
        
        // Reset failure count if credentials are valid
        await rovoDevKey.resetFailures();
      }

      // Sync usage data
      await this.provider.syncUsage(rovoDevKey);

      requestLogger.info('Updated RovoDev key', {
        id: rovoDevKey._id,
        profile: rovoDevKey.profile,
        email: rovoDevKey.email,
        updatedFields: Object.keys(updates)
      });

      return rovoDevKey;
    } catch (error) {
      logError(error, {
        context: 'RovoDevKeyManager.updateKey',
        id,
        updates
      });
      throw error;
    }
  }

  // Get a RovoDev key by ID
  async getKey(id: string): Promise<RovoDevKey | null> {
    try {
      return await RovoDevKey.findById(id);
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.getKey',
        id
      });
      return null;
    }
  }

  // Get all RovoDev keys
  async getAllKeys(): Promise<RovoDevKey[]> {
    try {
      return await RovoDevKey.findAll();
    } catch (error) {
      logError(error, { context: 'RovoDevKeyManager.getAllKeys' });
      return [];
    }
  }

  // Get RovoDev keys by profile
  async getKeysByProfile(profile: string): Promise<RovoDevKey[]> {
    try {
      return await RovoDevKey.findByProfile(profile);
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.getKeysByProfile',
        profile
      });
      return [];
    }
  }

  // Get active RovoDev keys by profile
  async getActiveKeysByProfile(profile: string): Promise<RovoDevKey[]> {
    try {
      return await RovoDevKey.findActiveByProfile(profile);
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.getActiveKeysByProfile',
        profile
      });
      return [];
    }
  }

  // Delete a RovoDev key
  async deleteKey(id: string): Promise<boolean> {
    try {
      const rovoDevKey = await RovoDevKey.findById(id);
      if (!rovoDevKey) {
        return false;
      }

      await rovoDevKey.delete();

      requestLogger.info('Deleted RovoDev key', {
        id,
        profile: rovoDevKey.profile,
        email: rovoDevKey.email
      });

      return true;
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.deleteKey',
        id
      });
      return false;
    }
  }

  // Test connection for a RovoDev key
  async testKey(id: string): Promise<boolean> {
    try {
      const rovoDevKey = await RovoDevKey.findById(id);
      if (!rovoDevKey) {
        return false;
      }

      const isValid = await this.provider.testConnection(rovoDevKey);
      
      if (isValid) {
        await rovoDevKey.resetFailures();
      } else {
        await rovoDevKey.recordFailure();
      }

      return isValid;
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.testKey',
        id
      });
      return false;
    }
  }

  // Get the best available key for a profile
  async getBestKey(profile: string): Promise<RovoDevKey | null> {
    try {
      return await this.provider.getBestKey(profile);
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.getBestKey',
        profile
      });
      return null;
    }
  }

  // Sync usage for all keys in a profile
  async syncUsageForProfile(profile: string): Promise<void> {
    try {
      const keys = await RovoDevKey.findByProfile(profile);
      
      for (const key of keys) {
        if (key.isActive) {
          await this.provider.syncUsage(key);
        }
      }

      requestLogger.info('Synced usage for profile', {
        profile,
        keyCount: keys.length
      });
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.syncUsageForProfile',
        profile
      });
    }
  }

  // Sync usage for all keys
  async syncAllUsage(): Promise<void> {
    try {
      const keys = await RovoDevKey.findAll();
      let syncedCount = 0;

      for (const key of keys) {
        if (key.isActive) {
          try {
            await this.provider.syncUsage(key);
            syncedCount++;
          } catch (error) {
            logError(error, {
              context: 'RovoDevKeyManager.syncAllUsage',
              keyId: key._id,
              email: key.email
            });
          }
        }
      }

      requestLogger.info('Synced usage for all keys', {
        totalKeys: keys.length,
        syncedCount
      });
    } catch (error) {
      logError(error, { context: 'RovoDevKeyManager.syncAllUsage' });
    }
  }

  // Get usage statistics for a profile
  async getProfileUsageStats(profile: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    totalTokensUsed: number;
    totalTokensRemaining: number;
    totalDailyLimit: number;
  }> {
    try {
      const keys = await RovoDevKey.findByProfile(profile);
      
      let activeKeys = 0;
      let totalTokensUsed = 0;
      let totalTokensRemaining = 0;
      let totalDailyLimit = 0;

      for (const key of keys) {
        key.checkDailyReset();
        
        if (key.isActive) {
          activeKeys++;
        }
        
        totalTokensUsed += key.dailyTokensUsed;
        totalTokensRemaining += key.getRemainingTokens();
        totalDailyLimit += key.dailyTokenLimit;
      }

      return {
        totalKeys: keys.length,
        activeKeys,
        totalTokensUsed,
        totalTokensRemaining,
        totalDailyLimit
      };
    } catch (error) {
      logError(error, { 
        context: 'RovoDevKeyManager.getProfileUsageStats',
        profile
      });
      return {
        totalKeys: 0,
        activeKeys: 0,
        totalTokensUsed: 0,
        totalTokensRemaining: 0,
        totalDailyLimit: 0
      };
    }
  }

  // Reset daily usage for all keys (useful for testing)
  async resetDailyUsage(): Promise<void> {
    try {
      const keys = await RovoDevKey.findAll();
      
      for (const key of keys) {
        await key.update({
          dailyTokensUsed: 0,
          lastResetDate: new Date().toISOString().split('T')[0],
          isDisabledByRateLimit: false
        });
      }

      requestLogger.info('Reset daily usage for all keys', {
        keyCount: keys.length
      });
    } catch (error) {
      logError(error, { context: 'RovoDevKeyManager.resetDailyUsage' });
    }
  }

  // Validate email format
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get provider instance
  getProvider(): RovoDevProvider {
    return this.provider;
  }
}

// Create singleton instance
const rovodevKeyManager = new RovoDevKeyManager();

export default rovodevKeyManager;
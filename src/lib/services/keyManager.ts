import { ApiKey } from '../models/ApiKey';
import { logKeyEvent, logError } from './logger';
import { readSettings } from '@/lib/settings';
import { Mutex } from 'async-mutex'; // Import Mutex

// Helper function to check if two date objects represent the same day in the server's local timezone
function isSameLocalDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
class KeyManager {
  private currentKey: ApiKey | null = null;
  private requestCounter: number = 0;
  private mutex = new Mutex(); // Create a mutex instance

  constructor() {
    // Constructor no longer needs to set rotationRequestCount
  }

  async initialize() {
    // Call getKey() which will handle initial rotation if needed
    if (!this.currentKey) {
      await this.getKey();
    }
  }

  // Internal rotateKey logic, now wrapped by getKey's mutex
  private async _internalRotateKey(): Promise<{ key: string; id: string }> {
    // Note: This method assumes it's already being called within a mutex lock
    try {
      // Get a working key that's not in cooldown
      const now = new Date();
      const todayLocalString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format for local date

      // --- FIRST: Check ALL active keys for daily resets, even rate-limited ones ---
      const allActiveKeys = await ApiKey.findAll({
        isActive: true // Only filter for generally active keys
      });

      // --- Daily Reset Logic ---
      let keysWereReset = false; // Flag to track if any key was updated
      const updatedKeysMap = new Map<string, ApiKey>(); // Store updated keys by ID

      for (const key of allActiveKeys) {
        const lastReset = key.lastResetDate ? new Date(key.lastResetDate) : null;
        let needsUpdate = false;

        // Check if last reset was before today (local time)
        if (!lastReset || !isSameLocalDay(lastReset, now)) {
           if (key.dailyRequestsUsed > 0 || key.isDisabledByRateLimit) { // Only reset if needed
              key.dailyRequestsUsed = 0;
              key.isDisabledByRateLimit = false; // Re-enable if it was disabled by rate limit
              key.lastResetDate = now.toISOString();
              needsUpdate = true;
              logKeyEvent('Daily Limit Reset', { keyId: key._id, date: todayLocalString });
           } else if (!key.lastResetDate) {
             // Set initial reset date if it's null
             key.lastResetDate = now.toISOString();
             needsUpdate = true;
           }
        }

        if (needsUpdate) {
            keysWereReset = true;
            updatedKeysMap.set(key._id, key); // Store the updated key instance
        }
      }
      
      // If any keys were reset, perform a single bulk write
      if (keysWereReset) {
          await ApiKey.bulkUpdate(updatedKeysMap);
      }
      // --- End Daily Reset Logic ---

      // --- NOW: Get available keys for use (after potential resets) ---
      let availableKeys = await ApiKey.findAll({
        isActive: true, // Must be generally active
        isDisabledByRateLimit: false, // Must not be disabled by daily limit
        $or: [ // Must not be in global rate limit cooldown
          { rateLimitResetAt: null },
          { rateLimitResetAt: { $lte: now.toISOString() } }
        ]
      } as any); // <-- Type assertion added here

      if (availableKeys.length === 0) {
        const error = new Error('No available API keys (all active keys might be rate-limited or disabled)');
        logError(error, { context: 'Key rotation - post daily reset' });
        throw error;
      }

      // --- Hybrid LRU + New Key Priority Logic ---
      // 1. Prioritize unused keys
      let key = availableKeys.find(k => k.lastUsed === null);

      // 2. If no unused keys, fall back to LRU
      if (!key) {
        const sortedKeys = availableKeys.sort((a, b) => {
          // Should not happen based on find above, but defensive check
          if (!a.lastUsed) return -1;
          if (!b.lastUsed) return 1;
          return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
        });
        key = sortedKeys[0]; // Select the least recently used
      }
      // --- End of Hybrid Logic ---

      if (!key) {
        // This should theoretically not be reached if availableKeys.length > 0 check passed
        const error = new Error('Failed to select a key after filtering and sorting');
        logError(error, { context: 'Key rotation - selection phase' });
        throw error;
      }

      this.currentKey = key;
      this.requestCounter = 0; // Reset counter on key rotation
      
      // Log key rotation
      logKeyEvent('Key Rotation', {
        keyId: key._id,
        lastUsed: key.lastUsed,
        failureCount: key.failureCount,
        rotationType: 'scheduled'
      });

      return { key: key.key, id: key._id };
    } catch (error: any) {
      logError(error, { action: 'rotateKey' });
      throw error;
    }
  }

  async markKeySuccess() {
    if (this.currentKey) {
      try {
        const now = new Date().toISOString();
        this.currentKey.lastUsed = now;
        this.currentKey.requestCount += 1; // Increment total request count
        this.currentKey.dailyRequestsUsed += 1; // Increment daily request count
        await this.currentKey.save();
        
        logKeyEvent('Key Success', {
          keyId: this.currentKey._id,
          lastUsed: this.currentKey.lastUsed,
          requestCount: this.currentKey.requestCount,
          dailyRequestsUsed: this.currentKey.dailyRequestsUsed,
          dailyRateLimit: this.currentKey.dailyRateLimit
        });
      } catch (error: any) {
        logError(error, { action: 'markKeySuccess' });
      }
    }
  }

  async markKeyError(error: any): Promise<boolean> {
    // Acquire lock before potentially modifying currentKey
    return await this.mutex.runExclusive(async () => {
      if (!this.currentKey) return false;

      const keyToUpdate = this.currentKey; // Work with a stable reference inside the lock

      try {
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        // Fetch settings to get the configured cooldown
        const settings = await readSettings();
        const fallbackCooldownMs = settings.rateLimitCooldown * 1000; // Convert seconds to ms

        this.currentKey.rateLimitResetAt = resetTime
          ? new Date(resetTime * 1000).toISOString() // Use API provided reset time if available
          : new Date(Date.now() + fallbackCooldownMs).toISOString(); // Use configured fallback
        
        logKeyEvent('Rate Limit Hit', {
          keyId: this.currentKey._id,
          resetTime: this.currentKey.rateLimitResetAt
        });

        await keyToUpdate.save();
        // Clear current key ONLY if it's still the one we were working on
        if (this.currentKey?._id === keyToUpdate._id) {
            this.currentKey = null;
        }
        return true; // Indicate it was a rate limit error
      }

      keyToUpdate.failureCount += 1;
      
      // Fetch current settings to get the threshold
      const settings = await readSettings();
      const maxFailures = settings.maxFailureCount;

      // If too many failures, deactivate the key
      if (keyToUpdate.failureCount >= maxFailures) {
        keyToUpdate.isActive = false;
        
        logKeyEvent('Key Deactivated', {
          keyId: keyToUpdate._id, // Corrected variable name
          reason: `Failure count reached threshold (${maxFailures})`,
          failureCount: keyToUpdate.failureCount
        });

        await keyToUpdate.save();
        // Clear current key ONLY if it's still the one we were working on
        if (this.currentKey?._id === keyToUpdate._id) {
            this.currentKey = null;
        }
      } else {
        // If not deactivated, save the incremented failure count
        // If not deactivated, save the incremented failure count
        await keyToUpdate.save();
      }
      
      return false; // Indicate it was not a rate limit error
      } catch (error: any) {
        logError(error, {
          action: 'markKeyError',
          keyId: keyToUpdate._id // Use the stable reference
        });
        // Ensure we still return false within the catch block
        return false;
      }
      // Return false if it wasn't a rate limit error and didn't throw
      return false;
    }); // End mutex runExclusive
  }

  async getKey(): Promise<{ key: string; id: string }> {
    // Wrap the entire key getting/rotation logic in a mutex
    return await this.mutex.runExclusive(async () => {
      try {
      const now = new Date();
      const todayLocalString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format for local date

      // --- Check 1: Is there a current key? ---
      if (this.currentKey) {
        // --- Check 2: Does the current key need daily reset? ---
        const lastReset = this.currentKey.lastResetDate ? new Date(this.currentKey.lastResetDate) : null;
        if (!lastReset || !isSameLocalDay(lastReset, now)) {
          logKeyEvent('Daily Limit Reset (getKey)', { keyId: this.currentKey._id, date: todayLocalString });
          this.currentKey.dailyRequestsUsed = 0;
          this.currentKey.isDisabledByRateLimit = false; // Ensure re-enabled
          this.currentKey.lastResetDate = now.toISOString();
          await this.currentKey.save(); // Save the reset state
        }

        // --- Check 3: Is the current key globally rate-limited? ---
        const globalResetTime = this.currentKey.rateLimitResetAt ? new Date(this.currentKey.rateLimitResetAt) : null;
        if (globalResetTime && globalResetTime > now) {
          // Globally rate-limited, force rotation
          logKeyEvent('Global Rate Limit Active (getKey)', { keyId: this.currentKey._id, resetTime: this.currentKey.rateLimitResetAt });
          this.currentKey = null; // Clear the invalid key
          // Fall through to rotateKey below
        } else {
           // --- Check 4: Is the current key daily rate-limited? ---
           const limit = this.currentKey.dailyRateLimit;
           // Ensure limit is a positive number before checking usage
           if (typeof limit === 'number' && limit > 0 && this.currentKey.dailyRequestsUsed >= limit) {
             // Daily limit reached, disable and force rotation
             logKeyEvent('Daily Rate Limit Hit (getKey)', {
               keyId: this.currentKey._id,
               dailyRequestsUsed: this.currentKey.dailyRequestsUsed,
               dailyRateLimit: limit
             });
             this.currentKey.isDisabledByRateLimit = true;
             await this.currentKey.save();
             this.currentKey = null; // Clear the invalid key
             // Fall through to rotateKey below
           } else {
              // --- Check 5: Is rotation by request count needed? ---
              // Fetch current settings dynamically
              const settings = await readSettings();
              const rotationThreshold = settings.keyRotationRequestCount; // Assuming this is the setting name

              if (rotationThreshold > 0 && this.requestCounter >= rotationThreshold) {
                logKeyEvent('Request Count Rotation Triggered (getKey)', {
                  keyId: this.currentKey._id,
                  requestCounter: this.requestCounter,
                  rotationThreshold: rotationThreshold
                });
                // Fall through to rotateKey below
              } else {
                 // --- Key is valid! ---
                 this.requestCounter++; // Increment request counter for rotation logic
                 return { key: this.currentKey.key, id: this.currentKey._id };
              }
           }
        }
      }

      // --- Rotation Needed ---
      // Either no current key, or one of the checks above failed/triggered rotation
      // Otherwise rotate to a new key
      // Call the internal rotation logic which assumes lock is held
      return await this._internalRotateKey();
      } catch (error: any) {
        logError(error, { action: 'getKey' });
        throw error;
      }
    }); // End mutex runExclusive
  }

  async addKey(data: { key: string, name?: string, dailyRateLimit?: number | null }): Promise<ApiKey> {
    // Although less critical, lock addKey to prevent potential race conditions
    // if a rotation happens while adding/reactivating a key.
    return await this.mutex.runExclusive(async () => {
      const { key, name, dailyRateLimit } = data; // Destructure input, including dailyRateLimit
      try {
      const existingKey = await ApiKey.findOne({ key });
      
      if (existingKey) {
        existingKey.isActive = true;
        existingKey.failureCount = 0; // Reset failure count
        existingKey.rateLimitResetAt = null; // Clear global rate limit
        existingKey.dailyRequestsUsed = 0; // Reset daily usage
        existingKey.lastResetDate = null; // Clear last reset date
        existingKey.isDisabledByRateLimit = false; // Ensure not disabled by daily limit
        await existingKey.save();

        logKeyEvent('Key Reactivated', {
          keyId: existingKey._id
        });

        return existingKey;
      }

      // Pass dailyRateLimit when creating the key
      const newKey = await ApiKey.create({ key, name, dailyRateLimit });
      
      logKeyEvent('New Key Added', {
        keyId: newKey._id
      });

      return newKey;
      } catch (error: any) {
        logError(error, { action: 'addKey' });
        throw error;
      }
    }); // End mutex runExclusive
  }
}

// Export a singleton instance
const keyManager = new KeyManager();
export default keyManager;
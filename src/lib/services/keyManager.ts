import { ApiKey } from '../models/ApiKey';
import { logKeyEvent, logError } from './logger';
import { readSettings } from '@/lib/settings';
import { Settings } from '@/lib/db'; // Import Settings type
import { Mutex } from 'async-mutex'; // Import Mutex
import { LoadBalancer } from './loadBalancer';

// Helper function to check if two date objects represent the same day in UTC
function isSameUTCDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

// Helper function to get UTC start of day
function getUTCStartOfDay(date: Date): Date {
  const utcDate = new Date(date);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
}
class KeyManager {
  private currentKey: ApiKey | null = null;
  private requestCounter: number = 0;
  private mutex = new Mutex(); // Create a mutex instance
  private isInitialized: boolean = false;

  constructor() {
    // Constructor no longer needs to set rotationRequestCount
  }

  async initialize() {
    return await this.mutex.runExclusive(async () => {
      if (this.isInitialized) return;
      
      // Call getKey() which will handle initial rotation if needed
      if (!this.currentKey) {
        await this._internalRotateKey();
      }
      this.isInitialized = true;
    });
  }

  // Internal rotateKey logic, now wrapped by getKey's mutex
  private async _internalRotateKey(): Promise<{ key: string; id: string }> {
    // Note: This method assumes it's already being called within a mutex lock
    try {
      // Get a working key that's not in cooldown
      const now = new Date();
      const todayUTCString = now.toISOString().split('T')[0]; // YYYY-MM-DD format for UTC date

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

        // Check if last reset was before today (UTC time)
        if (!lastReset || !isSameUTCDay(lastReset, now)) {
           if (key.dailyRequestsUsed > 0 || key.isDisabledByRateLimit) { // Only reset if needed
              key.dailyRequestsUsed = 0;
              key.isDisabledByRateLimit = false; // Re-enable if it was disabled by rate limit
              key.lastResetDate = now.toISOString();
              needsUpdate = true;
              logKeyEvent('Daily Limit Reset', { keyId: key._id, date: todayUTCString });
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

      // --- Profile-based Key Selection Logic ---
      // Get the current key's profile (if any)
      const currentProfile = this.currentKey?.profile || '';

      // Filter keys to get those from different profiles
      let differentProfileKeys = availableKeys.filter(k => k.profile !== currentProfile && k.profile !== '');

      // If we have keys from different profiles, use only those
      if (differentProfileKeys.length > 0) {
        logKeyEvent('Profile-Based Rotation', {
          currentProfile: currentProfile || 'none',
          availableProfiles: [...new Set(differentProfileKeys.map(k => k.profile || 'none'))].join(', ')
        });
        availableKeys = differentProfileKeys;
      } else {
        logKeyEvent('No Different Profile Keys', {
          currentProfile: currentProfile || 'none',
          fallbackToSameProfile: true
        });
        // If no keys from different profiles, we'll use all available keys
      }

      // --- Load Balancing Strategy Selection ---
      // Use the configured load balancing strategy
      const key = await LoadBalancer.selectKey(availableKeys);
      // --- End of Load Balancing Logic ---

      if (!key) {
        // This should theoretically not be reached if availableKeys.length > 0 check passed
        const error = new Error('Failed to select a key after filtering and sorting');
        logError(error, { context: 'Key rotation - selection phase' });
        throw error;
      }

      this.currentKey = key;
      this.requestCounter = 0; // Reset counter on key rotation

      // Track connection for least-connections strategy
      LoadBalancer.incrementConnections(key._id);

      // Log key rotation
      logKeyEvent('Key Rotation', {
        keyId: key._id,
        lastUsed: key.lastUsed,
        failureCount: key.failureCount,
        profile: key.profile || 'none',
        rotationType: 'scheduled',
        activeConnections: LoadBalancer.getConnectionCount(key._id)
      });

      return { key: key.key, id: key._id };
    } catch (error: any) {
      logError(error, { action: 'rotateKey' });
      throw error;
    }
  }

  async markKeySuccess() {
    return await this.mutex.runExclusive(async () => {
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
    });
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
        // Fetch settings to get the configured cooldown and failover delay
        const settings = await readSettings();
        const fallbackCooldownMs = settings.rateLimitCooldown * 1000; // Convert seconds to ms
        const failoverDelayMs = settings.failoverDelay * 1000; // Convert seconds to ms

        this.currentKey.rateLimitResetAt = resetTime
          ? new Date(resetTime * 1000).toISOString() // Use API provided reset time if available
          : new Date(Date.now() + fallbackCooldownMs).toISOString(); // Use configured fallback

        // Store the current profile before switching
        const currentProfile = this.currentKey.profile || '';

        logKeyEvent('Rate Limit Hit', {
          keyId: this.currentKey._id,
          resetTime: this.currentKey.rateLimitResetAt,
          failoverDelay: settings.failoverDelay,
          profile: currentProfile || 'none'
        });

        await keyToUpdate.save();

        // Apply failover delay if configured (greater than 0)
        if (failoverDelayMs > 0) {
          logKeyEvent('Failover Delay', {
            keyId: this.currentKey._id,
            delayMs: failoverDelayMs,
            profile: currentProfile || 'none'
          });

          // Wait for the configured delay before switching keys
          await new Promise(resolve => setTimeout(resolve, failoverDelayMs));
        }

        // Clear current key ONLY if it's still the one we were working on
        if (this.currentKey?._id === keyToUpdate._id) {
            // Decrement connection count when clearing key
            LoadBalancer.decrementConnections(keyToUpdate._id);
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
            // Decrement connection count when clearing key
            LoadBalancer.decrementConnections(keyToUpdate._id);
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
      const todayUTCString = now.toISOString().split('T')[0]; // YYYY-MM-DD format for UTC date

      // --- Check 1: Is there a current key? ---
      if (this.currentKey) {
        // --- Check 2: Perform daily reset for the current key FIRST ---
        const lastReset = this.currentKey.lastResetDate ? new Date(this.currentKey.lastResetDate) : null;
        if (!lastReset || !isSameUTCDay(lastReset, now)) {
          logKeyEvent('Daily Limit Reset (getKey)', { keyId: this.currentKey._id, date: todayUTCString });
          this.currentKey.dailyRequestsUsed = 0;
          this.currentKey.isDisabledByRateLimit = false; // Ensure re-enabled *before* other checks
          this.currentKey.lastResetDate = now.toISOString();
          await this.currentKey.save(); // Save the reset state
        }

        // --- Check 3: Is the current key (potentially after reset) globally rate-limited? ---
        const globalResetTime = this.currentKey.rateLimitResetAt ? new Date(this.currentKey.rateLimitResetAt) : null;
        if (globalResetTime && globalResetTime > now) {
          // Globally rate-limited, force rotation
          logKeyEvent('Global Rate Limit Active (getKey)', { keyId: this.currentKey._id, resetTime: this.currentKey.rateLimitResetAt });
          this.currentKey = null; // Clear the invalid key
          // Fall through to rotateKey below
        } else if (this.currentKey.isDisabledByRateLimit) {
          // --- Check 4a: Was it disabled by a daily limit that wasn't reset (shouldn't happen if reset logic is correct)? ---
          // This case implies it was disabled by daily limit, and the daily reset above didn't clear it.
          // This might indicate an issue or a specific scenario where it remains disabled.
          // For safety, if it's still marked as disabled by rate limit, force rotation.
          logKeyEvent('Persistently Daily Rate Limited (getKey)', {
            keyId: this.currentKey._id,
            dailyRequestsUsed: this.currentKey.dailyRequestsUsed,
            dailyRateLimit: this.currentKey.dailyRateLimit
          });
          this.currentKey = null; // Clear the invalid key
          // Fall through to rotateKey below
        }
        else {
           // --- Check 4b: Is the current key (active and not globally/daily limited yet) about to hit its daily rate limit? ---
           const limit = this.currentKey.dailyRateLimit;
           // Ensure limit is a positive number before checking usage
           if (typeof limit === 'number' && limit > 0 && this.currentKey.dailyRequestsUsed >= limit) {
             // Daily limit reached *now*, disable and force rotation
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

  async addKey(data: { key: string, name?: string, profile?: string, dailyRateLimit?: number | null }): Promise<ApiKey> {
    // Although less critical, lock addKey to prevent potential race conditions
    // if a rotation happens while adding/reactivating a key.
    return await this.mutex.runExclusive(async () => {
      const { key, name, profile, dailyRateLimit } = data; // Destructure input, including profile and dailyRateLimit
      try {
      const existingKey = await ApiKey.findOne({ key });

      if (existingKey) {
        existingKey.isActive = true;
        existingKey.failureCount = 0; // Reset failure count
        existingKey.rateLimitResetAt = null; // Clear global rate limit
        existingKey.dailyRequestsUsed = 0; // Reset daily usage
        existingKey.lastResetDate = null; // Clear last reset date
        existingKey.isDisabledByRateLimit = false; // Ensure not disabled by daily limit

        // Update profile if provided
        if (profile !== undefined) {
          existingKey.profile = profile;
        }

        await existingKey.save();

        logKeyEvent('Key Reactivated', {
          keyId: existingKey._id,
          profile: existingKey.profile || 'none'
        });

        return existingKey;
      }

      // Pass all parameters when creating the key
      const newKey = await ApiKey.create({ key, name, profile, dailyRateLimit });

      logKeyEvent('New Key Added', {
        keyId: newKey._id,
        profile: newKey.profile || 'none'
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
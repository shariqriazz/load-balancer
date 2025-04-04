import { getDb, Settings, DEFAULT_SETTINGS } from './db'; // Import DB connection and types/defaults
import { logError } from '@/lib/services/logger';

// In-memory cache for settings
let cachedSettings: Settings | null = null;
let lastReadTime: number | null = null;
const CACHE_DURATION_MS = 60 * 1000; // Cache settings for 60 seconds

// Function to write settings to the database
async function writeSettingsToDb(settings: Settings): Promise<void> {
  const db = await getDb();
  try {
    // Use INSERT OR REPLACE (UPSERT) to ensure the single row (id=1) is updated or inserted
    await db.run(
      'INSERT OR REPLACE INTO settings (id, config) VALUES (?, ?)',
      1, // Fixed ID for the single settings row
      JSON.stringify(settings)
    );
    // Invalidate cache after writing
    cachedSettings = settings; // Update cache immediately
    lastReadTime = Date.now();
  } catch (error) {
    logError(error, { context: 'writeSettingsToDb' });
    throw error; // Re-throw write errors as they are critical
  }
}

// Function to read settings from the database
async function readSettingsFromDb(): Promise<Settings> {
  const db = await getDb();
  try {
    const row = await db.get<{ config: string }>('SELECT config FROM settings WHERE id = 1');
    if (row?.config) {
      // Merge defaults with loaded settings to ensure all keys are present
      // in case new defaults were added since last save
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.config) };
    } else {
      // Should not happen if DB initialization worked, but handle defensively
      logError(new Error('Settings row not found in database'), { context: 'readSettingsFromDb' });
      // Attempt to write defaults back
      await writeSettingsToDb(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  } catch (error: any) {
    logError(error, { context: 'readSettingsFromDb' });
    // Return defaults on read errors to avoid crashing
    return DEFAULT_SETTINGS;
  }
}

// Exported function to read settings (uses cache)
export async function readSettings(): Promise<Settings> {
    const now = Date.now();
    // Check if cache is valid
    if (cachedSettings && lastReadTime && (now - lastReadTime < CACHE_DURATION_MS)) {
        // console.log('Returning cached settings'); // Optional: for debugging
        return cachedSettings;
    }

    // console.log('Fetching settings from DB'); // Optional: for debugging
    // Cache is invalid or doesn't exist, read from DB
    cachedSettings = await readSettingsFromDb();
    lastReadTime = now;
    return cachedSettings;
}

// Exported function to write settings (updates DB and cache)
export async function writeSettings(settings: Settings): Promise<void> {
    // Perform validation or merging if necessary before writing
    // For now, assume 'settings' object is complete and valid
    await writeSettingsToDb(settings);
}

// Function to explicitly clear the cache if needed (e.g., after manual DB change)
export function clearSettingsCache(): void {
    cachedSettings = null;
    lastReadTime = null;
    console.log('Settings cache cleared.');
}

// Re-export the Settings type for consumers of this module
export type { Settings };
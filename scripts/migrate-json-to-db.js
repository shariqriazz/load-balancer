// Migration script to move data from keys.json and settings.json to the SQLite DB
const fs = require('fs/promises');
const path = require('path');
// Use require for the db module. tsx should handle the TS->JS conversion.
const { getDb } = require('../src/lib/db');

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_JSON_FILE = path.join(DATA_DIR, 'keys.json');
const SETTINGS_JSON_FILE = path.join(DATA_DIR, 'settings.json');

// Helper to convert boolean to DB value (0/1) - Copied from ApiKey model
function booleanToDb(value) {
  return value ? 1 : 0;
}

async function migrate() {
  console.log('Starting migration from JSON files to SQLite DB...');

  let db;
  try {
    db = await getDb(); // Get DB connection (initializes if needed)
    console.log('Database connection established.');

    // --- Migrate Settings ---
    try {
      console.log(`Reading settings from ${SETTINGS_JSON_FILE}...`);
      const settingsJsonData = await fs.readFile(SETTINGS_JSON_FILE, 'utf-8');
      const settings = JSON.parse(settingsJsonData);

      if (settings && typeof settings === 'object') {
        console.log('Updating settings in database...');
        await db.run(
          'INSERT OR REPLACE INTO settings (id, config) VALUES (?, ?)',
          1,
          JSON.stringify(settings)
        );
        console.log('Settings migrated successfully.');
      } else {
        console.warn('Settings JSON data is invalid or empty. Skipping settings migration.');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`${SETTINGS_JSON_FILE} not found. Skipping settings migration.`);
      } else {
        console.error('Error migrating settings:', error);
        // Decide if you want to stop the whole migration on settings error
      }
    }

    // --- Migrate API Keys ---
    try {
      console.log(`Reading API keys from ${KEYS_JSON_FILE}...`);
      const keysJsonData = await fs.readFile(KEYS_JSON_FILE, 'utf-8');
      const keys = JSON.parse(keysJsonData);

      if (Array.isArray(keys)) {
        console.log(`Found ${keys.length} keys in JSON file. Migrating...`);
        let migratedCount = 0;
        let skippedCount = 0;

        // Use a transaction for bulk inserts
        await db.run('BEGIN TRANSACTION');

        for (const keyData of keys) {
          // Basic validation
          if (!keyData || typeof keyData !== 'object' || !keyData.key || !keyData._id) {
            console.warn('Skipping invalid key data:', keyData);
            skippedCount++;
            continue;
          }

          // Prepare data for insertion, ensuring defaults for missing fields if necessary
          const dataToInsert = {
            _id: keyData._id,
            key: keyData.key,
            name: keyData.name || null,
            isActive: keyData.isActive ?? true,
            lastUsed: keyData.lastUsed || null,
            rateLimitResetAt: keyData.rateLimitResetAt || null,
            failureCount: keyData.failureCount ?? 0,
            requestCount: keyData.requestCount ?? 0,
            dailyRateLimit: keyData.dailyRateLimit === undefined ? null : keyData.dailyRateLimit,
            dailyRequestsUsed: keyData.dailyRequestsUsed ?? 0,
            lastResetDate: keyData.lastResetDate || null,
            isDisabledByRateLimit: keyData.isDisabledByRateLimit ?? false,
          };

          try {
            // Use INSERT OR IGNORE to avoid errors if the key._id already exists
            const result = await db.run(
              `INSERT OR IGNORE INTO api_keys (_id, key, name, isActive, lastUsed, rateLimitResetAt, failureCount, requestCount, dailyRateLimit, dailyRequestsUsed, lastResetDate, isDisabledByRateLimit)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              dataToInsert._id,
              dataToInsert.key,
              dataToInsert.name,
              booleanToDb(dataToInsert.isActive),
              dataToInsert.lastUsed,
              dataToInsert.rateLimitResetAt,
              dataToInsert.failureCount,
              dataToInsert.requestCount,
              dataToInsert.dailyRateLimit,
              dataToInsert.dailyRequestsUsed,
              dataToInsert.lastResetDate,
              booleanToDb(dataToInsert.isDisabledByRateLimit)
            );
            if (result.changes > 0) {
              migratedCount++;
            } else {
              console.log(`Key with _id ${dataToInsert._id} already exists. Skipping.`);
              skippedCount++;
            }
          } catch (insertError) {
            console.error(`Error inserting key with _id ${dataToInsert._id}:`, insertError);
            // Optionally rollback transaction and stop, or just skip this key
            skippedCount++;
          }
        }

        await db.run('COMMIT');
        console.log(`API Keys migration finished. Migrated: ${migratedCount}, Skipped/Existing: ${skippedCount}`);

      } else {
        console.warn('Keys JSON data is not an array. Skipping API keys migration.');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`${KEYS_JSON_FILE} not found. Skipping API keys migration.`);
      } else {
        console.error('Error migrating API keys:', error);
        // Attempt to rollback if transaction was started
        try { await db.run('ROLLBACK'); } catch (rbError) { /* ignore rollback error */ }
      }
    }

    console.log('Migration script finished.');

  } catch (error) {
    console.error('Failed to run migration script:', error);
  } finally {
    // Ensure the database connection is closed if it was opened
    if (db) {
      await db.close();
      console.log('Database connection closed.');
    }
  }
}

// Run the migration
migrate();
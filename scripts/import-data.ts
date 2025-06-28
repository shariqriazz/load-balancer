import fs from 'fs/promises';
import path from 'path';
import { getDb, DEFAULT_SETTINGS } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface OldApiKey {
  _id?: string;
  key: string;
  name?: string;
  profile?: string;
  isActive?: boolean;
  lastUsed?: string;
  rateLimitResetAt?: string;
  failureCount?: number;
  requestCount?: number;
  dailyRateLimit?: number;
  dailyRequestsUsed?: number;
  lastResetDate?: string;
  isDisabledByRateLimit?: boolean;
}

interface OldRequestLog {
  _id?: string;
  apiKeyId: string;
  timestamp: string;
  modelUsed?: string;
  responseTime?: number;
  statusCode: number;
  isError: boolean;
  errorType?: string;
  errorMessage?: string;
  ipAddress?: string;
}

interface OldSettings {
  keyRotationRequestCount: number;
  maxFailureCount: number;
  rateLimitCooldown: number;
  logRetentionDays: number;
  maxRetries?: number;
  endpoint?: string;
  failoverDelay?: number;
  // New field in the current schema
}

interface ImportData {
  apiKeys?: OldApiKey[];
  requestLogs?: OldRequestLog[];
  settings?: OldSettings;
  version?: string;
  exportDate?: string;
}

async function importData(filePath: string) {
  console.log(`Starting data import from ${filePath}...`);
  
  try {
    // Read and parse the import file
    const fileData = await fs.readFile(filePath, 'utf-8');
    const importData: ImportData = JSON.parse(fileData);
    
    console.log(`Import file contains:`);
    console.log(`- API Keys: ${importData.apiKeys?.length || 0}`);
    console.log(`- Request Logs: ${importData.requestLogs?.length || 0}`);
    console.log(`- Settings: ${importData.settings ? 'Yes' : 'No'}`);
    console.log(`- Export version: ${importData.version || 'Not specified'}`);
    console.log(`- Export date: ${importData.exportDate || 'Not specified'}`);
    
    const db = await getDb();
    
    // Begin a transaction - ensures all-or-nothing import
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Import settings if present
      if (importData.settings) {
        const settingsRow = await db.get('SELECT config FROM settings WHERE id = 1');
        
        if (settingsRow) {
          // Merge with existing settings (prioritize existing settings for safety)
          const currentSettings = JSON.parse(settingsRow.config);
          
          // Use the imported settings as a base but ensure required fields exist
          const mergedSettings = {
            ...DEFAULT_SETTINGS,                // Default values for any missing fields
            ...importData.settings,             // Imported settings
            ...currentSettings,                 // Current settings take priority
          };
          
          await db.run(
            'UPDATE settings SET config = ? WHERE id = 1',
            JSON.stringify(mergedSettings)
          );
          console.log('Settings updated');
        } else {
          // No existing settings, create new with defaults for missing fields
          const newSettings = {
            ...DEFAULT_SETTINGS,
            ...importData.settings,
          };
          
          await db.run(
            'INSERT INTO settings (id, config) VALUES (?, ?)',
            1,
            JSON.stringify(newSettings)
          );
          console.log('Settings created');
        }
      }
      
      // Import API keys if present
      if (importData.apiKeys && importData.apiKeys.length > 0) {
        for (const key of importData.apiKeys) {
          // Ensure all required fields are present
          const apiKeyData = {
            _id: key._id || uuidv4(),
            key: key.key,
            name: key.name || null,
            profile: key.profile || null,
            isActive: key.isActive === undefined ? true : key.isActive,
            lastUsed: key.lastUsed || null,
            rateLimitResetAt: key.rateLimitResetAt || null,
            failureCount: key.failureCount || 0,
            requestCount: key.requestCount || 0,
            dailyRateLimit: key.dailyRateLimit || null,
            dailyRequestsUsed: key.dailyRequestsUsed || 0,
            lastResetDate: key.lastResetDate || null,
            isDisabledByRateLimit: key.isDisabledByRateLimit || false
          };
          
          // Check if key already exists by ID or key value
          const existingKey = await db.get(
            'SELECT _id FROM api_keys WHERE _id = ? OR key = ?', 
            apiKeyData._id, 
            apiKeyData.key
          );
          
          if (existingKey) {
            console.log(`Updating existing API key: ${apiKeyData._id}`);
            await db.run(
              `UPDATE api_keys SET 
               key = ?, name = ?, profile = ?, isActive = ?, 
               lastUsed = ?, rateLimitResetAt = ?, failureCount = ?, 
               requestCount = ?, dailyRateLimit = ?, dailyRequestsUsed = ?, 
               lastResetDate = ?, isDisabledByRateLimit = ?
               WHERE _id = ?`,
              apiKeyData.key,
              apiKeyData.name,
              apiKeyData.profile,
              apiKeyData.isActive ? 1 : 0,
              apiKeyData.lastUsed,
              apiKeyData.rateLimitResetAt,
              apiKeyData.failureCount,
              apiKeyData.requestCount,
              apiKeyData.dailyRateLimit,
              apiKeyData.dailyRequestsUsed,
              apiKeyData.lastResetDate,
              apiKeyData.isDisabledByRateLimit ? 1 : 0,
              apiKeyData._id
            );
          } else {
            console.log(`Importing new API key: ${apiKeyData._id}`);
            await db.run(
              `INSERT INTO api_keys (
                _id, key, name, profile, isActive, lastUsed, 
                rateLimitResetAt, failureCount, requestCount, 
                dailyRateLimit, dailyRequestsUsed, lastResetDate, 
                isDisabledByRateLimit
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              apiKeyData._id,
              apiKeyData.key,
              apiKeyData.name,
              apiKeyData.profile,
              apiKeyData.isActive ? 1 : 0,
              apiKeyData.lastUsed,
              apiKeyData.rateLimitResetAt,
              apiKeyData.failureCount,
              apiKeyData.requestCount,
              apiKeyData.dailyRateLimit,
              apiKeyData.dailyRequestsUsed,
              apiKeyData.lastResetDate,
              apiKeyData.isDisabledByRateLimit ? 1 : 0
            );
          }
        }
        console.log(`Imported ${importData.apiKeys.length} API keys`);
      }
      
      // Import request logs if present
      if (importData.requestLogs && importData.requestLogs.length > 0) {
        let importedLogs = 0;
        let skippedLogs = 0;
        
        for (const log of importData.requestLogs) {
          // Check if the API key referenced by this log exists
          const keyExists = await db.get(
            'SELECT _id FROM api_keys WHERE _id = ?',
            log.apiKeyId
          );
          
          if (!keyExists) {
            skippedLogs++;
            continue; // Skip logs with non-existent API keys
          }
          
          const logData = {
            _id: log._id || uuidv4(),
            apiKeyId: log.apiKeyId,
            timestamp: log.timestamp,
            modelUsed: log.modelUsed || null,
            responseTime: log.responseTime || null,
            statusCode: log.statusCode,
            isError: log.isError ? 1 : 0,
            errorType: log.errorType || null,
            errorMessage: log.errorMessage || null,
            ipAddress: log.ipAddress || null
          };
          
          // Check if log already exists
          const existingLog = await db.get(
            'SELECT _id FROM request_logs WHERE _id = ?',
            logData._id
          );
          
          if (!existingLog) {
            await db.run(
              `INSERT INTO request_logs (
                _id, apiKeyId, timestamp, modelUsed, 
                responseTime, statusCode, isError, 
                errorType, errorMessage, ipAddress
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              logData._id,
              logData.apiKeyId,
              logData.timestamp,
              logData.modelUsed,
              logData.responseTime,
              logData.statusCode,
              logData.isError,
              logData.errorType,
              logData.errorMessage,
              logData.ipAddress
            );
            importedLogs++;
          } else {
            skippedLogs++;
          }
        }
        
        console.log(`Imported ${importedLogs} request logs (${skippedLogs} skipped)`);
      }
      
      // Commit the transaction
      await db.run('COMMIT');
      console.log('Data import completed successfully!');
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error during data import:', error);
    throw error;
  }
}

// Get the file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error('Please provide a file path to import data from.');
  console.error('Usage: bun run scripts/import-data.ts <path-to-import-file.json>');
  process.exit(1);
}

// Run the import
importData(filePath).catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
}); 
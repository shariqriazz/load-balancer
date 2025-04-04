import { NextRequest, NextResponse } from 'next/server';
import { ApiKey, ApiKeyData } from '@/lib/models/ApiKey'; // Keep for type checking if needed
import { RequestLogData } from '@/lib/models/RequestLog'; // Keep for type checking
import { Settings } from '@/lib/db'; // Import Settings type
import { logError, logKeyEvent } from '@/lib/services/logger';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db'; // Import getDb for transaction

// Helper to convert boolean to DB value (0/1) - needed if inserting raw
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}


export async function POST(req: NextRequest) {
  // --- Authentication Check ---
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // --- End Authentication Check ---

  let results = {
    keys: 0,
    settings: 0,
    logs: 0,
    errors: [] as string[],
  };

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/json') {
      return NextResponse.json({ message: 'Invalid file type. Please upload a JSON file.' }, { status: 400 });
    }

    const fileContent = await file.text();
    let importData: { version?: number; exportedAt?: string; data?: { api_keys?: any[], settings?: any, request_logs?: any[] } };

    try {
      importData = JSON.parse(fileContent);
      // Basic validation of structure
      if (!importData || typeof importData !== 'object' || !importData.data || typeof importData.data !== 'object') {
          throw new Error('Invalid JSON structure: Missing top-level "data" object.');
      }
       if (!Array.isArray(importData.data.api_keys)) {
           throw new Error('Invalid JSON structure: "data.api_keys" is not an array.');
       }
       if (typeof importData.data.settings !== 'object' || importData.data.settings === null) {
           throw new Error('Invalid JSON structure: "data.settings" is not an object.');
       }
       if (!Array.isArray(importData.data.request_logs)) {
           throw new Error('Invalid JSON structure: "data.request_logs" is not an array.');
       }
       // Add version check if needed in the future
       // if (importData.version !== 1) { ... }

    } catch (parseError: any) {
      logError(parseError, { context: 'Import All Data - JSON Parsing' });
      return NextResponse.json(
        { message: 'Failed to parse JSON file or invalid structure', error: parseError.message },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION'); // Start transaction

    try {
      // Clear existing data
      await db.run('DELETE FROM request_logs');
      await db.run('DELETE FROM api_keys');
      await db.run('DELETE FROM settings'); // Should only be one row, but DELETE is safe

      // Import Settings (only one row expected)
      if (importData.data.settings) {
          const settingsString = JSON.stringify(importData.data.settings);
          await db.run('INSERT INTO settings (id, config) VALUES (?, ?)', 1, settingsString);
          results.settings = 1;
      }

      // Import API Keys
      if (importData.data.api_keys) {
        const stmtKeys = await db.prepare(
          `INSERT INTO api_keys (_id, key, name, isActive, lastUsed, rateLimitResetAt, failureCount, requestCount, dailyRateLimit, dailyRequestsUsed, lastResetDate, isDisabledByRateLimit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const key of importData.data.api_keys) {
          // Add basic validation if needed, or rely on DB constraints
          await stmtKeys.run(
            key._id, key.key, key.name,
            booleanToDb(key.isActive), // Convert boolean
            key.lastUsed, key.rateLimitResetAt,
            key.failureCount ?? 0, key.requestCount ?? 0,
            key.dailyRateLimit, key.dailyRequestsUsed ?? 0,
            key.lastResetDate,
            booleanToDb(key.isDisabledByRateLimit) // Convert boolean
          );
          results.keys++;
        }
        await stmtKeys.finalize();
      }

      // Import Request Logs
      if (importData.data.request_logs) {
        const stmtLogs = await db.prepare(
          `INSERT INTO request_logs (_id, apiKeyId, timestamp, modelUsed, responseTime, statusCode, isError, errorType, errorMessage, ipAddress)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const log of importData.data.request_logs) {
           // Add basic validation if needed
           await stmtLogs.run(
             log._id, log.apiKeyId, log.timestamp,
             log.modelUsed, log.responseTime, log.statusCode,
             booleanToDb(log.isError), // Convert boolean
             log.errorType, log.errorMessage, log.ipAddress
           );
           results.logs++;
        }
        await stmtLogs.finalize();
      }

      await db.run('COMMIT'); // Commit transaction

    } catch (importError: any) {
        await db.run('ROLLBACK'); // Rollback on any error during import
        logError(importError, { context: 'Import All Data - DB Operation' });
        results.errors.push(`Database import failed: ${importError.message}`);
        // Re-throw or handle differently if needed
         return NextResponse.json(
            { message: 'Database import failed during transaction.', error: importError.message, results },
            { status: 500 }
         );
    }

    return NextResponse.json({
      message: 'Data import completed successfully.',
      results
    });

  } catch (error: any) {
    // Catch errors outside the transaction (e.g., file read)
    logError(error, { context: 'Import All Data - General' });
    return NextResponse.json(
      { message: 'Failed to import data', error: error.message },
      { status: 500 }
    );
  }
}
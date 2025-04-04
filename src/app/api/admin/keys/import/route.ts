import { NextRequest, NextResponse } from 'next/server';
import { ApiKey, ApiKeyData } from '@/lib/models/ApiKey';
import { logError, logKeyEvent } from '@/lib/services/logger';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db'; // Import getDb for transaction

export async function POST(req: NextRequest) {
  // --- Authentication Check ---
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // --- End Authentication Check ---

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

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
    let importedKeys: Partial<ApiKeyData>[];

    try {
      importedKeys = JSON.parse(fileContent);
      if (!Array.isArray(importedKeys)) {
        throw new Error('Invalid JSON format: Expected an array of key objects.');
      }
    } catch (parseError: any) {
      logError(parseError, { context: 'Import API Keys - JSON Parsing' });
      return NextResponse.json(
        { message: 'Failed to parse JSON file', error: parseError.message },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION'); // Start transaction

    try {
      for (const keyData of importedKeys) {
        // Basic validation
        if (!keyData.key || typeof keyData.key !== 'string') {
          errors.push(`Skipped entry due to missing or invalid 'key' field: ${JSON.stringify(keyData)}`);
          skippedCount++;
          continue;
        }

        try {
          // Use provided _id if available and valid, otherwise find by key
          const existingKey = keyData._id
            ? await ApiKey.findOne({ _id: keyData._id })
            : await ApiKey.findOne({ key: keyData.key });

          if (existingKey) {
            // Update existing key - carefully choose which fields to update
            // Example: Update name, isActive, dailyRateLimit, but keep existing stats
            existingKey.name = keyData.name !== undefined ? keyData.name : existingKey.name;
            existingKey.isActive = keyData.isActive !== undefined ? keyData.isActive : existingKey.isActive;
            existingKey.dailyRateLimit = keyData.dailyRateLimit !== undefined ? keyData.dailyRateLimit : existingKey.dailyRateLimit;
            // Add other fields as needed, be cautious about overwriting stats like requestCount unless intended

            await existingKey.save(); // Assumes save() works within transaction
            updatedCount++;
            logKeyEvent('Key Updated (Import)', { keyId: existingKey._id });
          } else {
            // Create new key - ensure all required fields have defaults if not provided
            // Use the _id from import if provided, otherwise let create generate one
            const createData: Partial<ApiKeyData> = {
                ...keyData, // Spread imported data
                // Ensure defaults for fields not typically in export/import or that need resetting
                failureCount: keyData.failureCount ?? 0,
                requestCount: keyData.requestCount ?? 0, // Or maybe reset to 0 on import? Decide policy.
                dailyRequestsUsed: keyData.dailyRequestsUsed ?? 0, // Or reset?
                lastUsed: keyData.lastUsed ?? null, // Or reset?
                rateLimitResetAt: keyData.rateLimitResetAt ?? null,
                lastResetDate: keyData.lastResetDate ?? null,
                isDisabledByRateLimit: keyData.isDisabledByRateLimit ?? false,
                isActive: keyData.isActive ?? true,
            };
             // Remove undefined fields that might cause issues with DB constraints if not nullable
            Object.keys(createData).forEach(k => createData[k as keyof Partial<ApiKeyData>] === undefined && delete createData[k as keyof Partial<ApiKeyData>]);


            const newKey = await ApiKey.create(createData); // Assumes create() works within transaction
            addedCount++;
            logKeyEvent('Key Added (Import)', { keyId: newKey._id });
          }
        } catch (keyError: any) {
          errors.push(`Error processing key '${keyData.key}': ${keyError.message}`);
          errorCount++;
          // Continue processing other keys
        }
      }

      await db.run('COMMIT'); // Commit transaction if all loops succeed

    } catch (transactionError: any) {
        await db.run('ROLLBACK'); // Rollback on error during loop/commit
        throw transactionError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      message: 'Import process completed.',
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorDetails: errors,
    });

  } catch (error: any) {
    logError(error, { context: 'Import API Keys' });
    return NextResponse.json(
      { message: 'Failed to import API keys', error: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/services/logger';
import { Settings, readSettings, writeSettings } from '@/lib/settings';

// GET /api/settings - Get application settings
export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    logError(error, { context: 'GET /api/settings' });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings - Update application settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await readSettings();
    
    // Validate and update settings
    // Validate and update settings, including the new maxRetries
    const newSettings: Settings = {
      keyRotationRequestCount: validateNumber(body.keyRotationRequestCount, currentSettings.keyRotationRequestCount, 1, 100),
      maxFailureCount: validateNumber(body.maxFailureCount, currentSettings.maxFailureCount, 1, 20),
      rateLimitCooldown: validateNumber(body.rateLimitCooldown, currentSettings.rateLimitCooldown, 10, 3600), // seconds
      logRetentionDays: validateNumber(body.logRetentionDays, currentSettings.logRetentionDays, 1, 90), // days
      maxRetries: validateNumber(body.maxRetries, currentSettings.maxRetries, 0, 10), // 0-10 retries
    };
    
    await writeSettings(newSettings);
    
    // Remove incorrect environment variable update
    // process.env.KEY_ROTATION_REQUEST_COUNT = newSettings.keyRotationRequestCount.toString();

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: newSettings
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/settings' });
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// Helper function to validate number settings
function validateNumber(value: any, defaultValue: number, min: number, max: number): number {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}
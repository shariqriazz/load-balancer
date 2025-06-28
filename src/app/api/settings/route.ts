import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/services/logger';
import { Settings, readSettings, writeSettings } from '@/lib/settings';

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

function validateString(value: any, defaultValue: string): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return defaultValue;
}

function validateEndpoint(value: any, defaultValue: string): string {
  if (typeof value !== 'string') return defaultValue;
  
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  
  try {
    const url = new URL(trimmed);
    // Only allow https in production
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new Error('Only HTTPS endpoints are allowed in production');
    }
    return trimmed;
  } catch (error) {
    console.warn('Invalid endpoint URL provided:', trimmed);
    return defaultValue;
  }
}

function validateLoadBalancingStrategy(value: any, defaultValue: 'round-robin' | 'random' | 'least-connections'): 'round-robin' | 'random' | 'least-connections' {
  const validStrategies = ['round-robin', 'random', 'least-connections'] as const;
  if (typeof value === 'string' && validStrategies.includes(value as any)) {
    return value as 'round-robin' | 'random' | 'least-connections';
  }
  return defaultValue;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await readSettings();

    console.log('Received settings update:', body);

    const newSettings: Settings = {
      keyRotationRequestCount: validateNumber(body.keyRotationRequestCount, currentSettings.keyRotationRequestCount, 1, 100),
      maxFailureCount: validateNumber(body.maxFailureCount, currentSettings.maxFailureCount, 1, 20),
      rateLimitCooldown: validateNumber(body.rateLimitCooldown, currentSettings.rateLimitCooldown, 10, 3600),
      logRetentionDays: validateNumber(body.logRetentionDays, currentSettings.logRetentionDays, 1, 90),
      maxRetries: validateNumber(body.maxRetries, currentSettings.maxRetries, 0, 10),
      endpoint: validateEndpoint(body.endpoint, currentSettings.endpoint),
      failoverDelay: validateNumber(body.failoverDelay, currentSettings.failoverDelay, 0, 60),
      loadBalancingStrategy: validateLoadBalancingStrategy(body.loadBalancingStrategy, currentSettings.loadBalancingStrategy),
      requestRateLimit: validateNumber(body.requestRateLimit, currentSettings.requestRateLimit, 0, 1000),
    };

    console.log('Saving settings:', newSettings);

    await writeSettings(newSettings);

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

function validateNumber(value: any, defaultValue: number, min: number, max: number): number {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}
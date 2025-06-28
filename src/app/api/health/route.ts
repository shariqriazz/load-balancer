import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApiKey } from '@/lib/models/ApiKey';
import { readSettings } from '@/lib/settings';

export async function GET() {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown', responseTime: 0 },
      settings: { status: 'unknown', responseTime: 0 },
      apiKeys: { status: 'unknown', count: 0, activeCount: 0 },
    },
    responseTime: 0,
  };

  // Database health check
  try {
    const dbStart = Date.now();
    const db = await getDb();
    await db.get('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }

  // Settings health check
  try {
    const settingsStart = Date.now();
    await readSettings();
    health.checks.settings = {
      status: 'healthy',
      responseTime: Date.now() - settingsStart,
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.settings = {
      status: 'unhealthy',
      responseTime: Date.now() - settingsStart,
      error: error instanceof Error ? error.message : 'Unknown settings error',
    };
  }

  // API Keys health check
  try {
    const keysStart = Date.now();
    const allKeys = await ApiKey.findAll({});
    const activeKeys = allKeys.filter(key => key.isActive && !key.isDisabledByRateLimit);
    
    health.checks.apiKeys = {
      status: activeKeys.length > 0 ? 'healthy' : 'warning',
      count: allKeys.length,
      activeCount: activeKeys.length,
      responseTime: Date.now() - keysStart,
    };
    
    if (activeKeys.length === 0 && health.status === 'healthy') {
      health.status = 'degraded';
    }
  } catch (error) {
    health.status = 'degraded';
    health.checks.apiKeys = {
      status: 'unhealthy',
      count: 0,
      activeCount: 0,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown API keys error',
    };
  }

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
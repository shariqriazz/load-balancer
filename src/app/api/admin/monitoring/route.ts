import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApiKey } from '@/lib/models/ApiKey';
import { LoadBalancer } from '@/lib/services/loadBalancer';
import { readSettings } from '@/lib/settings';
import { logError } from '@/lib/services/logger';

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Get basic system info
    const monitoring = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      
      // Database metrics
      database: {
        status: 'unknown',
        responseTime: 0,
        connectionCount: 0,
      },
      
      // API Key metrics
      apiKeys: {
        total: 0,
        active: 0,
        rateLimited: 0,
        failed: 0,
        byProfile: {} as Record<string, number>,
      },
      
      // Load balancer metrics
      loadBalancer: {
        strategy: 'round-robin',
        connectionCounts: {} as Record<string, number>,
      },
      
      // Request metrics (last 24 hours)
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
      },
      
      // Performance metrics
      performance: {
        responseTime: 0,
        cpuUsage: process.cpuUsage(),
      },
    };

    // Database health check
    try {
      const dbStart = Date.now();
      const db = await getDb();
      await db.get('SELECT 1');
      monitoring.database.status = 'healthy';
      monitoring.database.responseTime = Date.now() - dbStart;
    } catch (error) {
      monitoring.database.status = 'unhealthy';
      logError(error, { context: 'Monitoring - Database check' });
    }

    // API Keys metrics
    try {
      const allKeys = await ApiKey.findAll({});
      monitoring.apiKeys.total = allKeys.length;
      monitoring.apiKeys.active = allKeys.filter(k => k.isActive && !k.isDisabledByRateLimit).length;
      monitoring.apiKeys.rateLimited = allKeys.filter(k => k.isDisabledByRateLimit).length;
      monitoring.apiKeys.failed = allKeys.filter(k => !k.isActive).length;
      
      // Group by profile
      const profileCounts: Record<string, number> = {};
      allKeys.forEach(key => {
        const profile = key.profile || 'default';
        profileCounts[profile] = (profileCounts[profile] || 0) + 1;
      });
      monitoring.apiKeys.byProfile = profileCounts;
    } catch (error) {
      logError(error, { context: 'Monitoring - API Keys metrics' });
    }

    // Load balancer metrics
    try {
      const settings = await readSettings();
      monitoring.loadBalancer.strategy = settings.loadBalancingStrategy;
      monitoring.loadBalancer.connectionCounts = Object.fromEntries(
        LoadBalancer.getAllConnectionCounts()
      );
    } catch (error) {
      logError(error, { context: 'Monitoring - Load balancer metrics' });
    }

    // Request metrics (last 24 hours)
    try {
      const db = await getDb();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const requestStats = await db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN isError = 0 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN isError = 1 THEN 1 ELSE 0 END) as failed,
          AVG(CASE WHEN isError = 0 AND responseTime IS NOT NULL THEN responseTime END) as avgResponseTime
        FROM request_logs 
        WHERE timestamp >= ?
      `, yesterday);
      
      if (requestStats) {
        monitoring.requests = {
          total: requestStats.total || 0,
          successful: requestStats.successful || 0,
          failed: requestStats.failed || 0,
          avgResponseTime: Math.round(requestStats.avgResponseTime || 0),
        };
      }
    } catch (error) {
      logError(error, { context: 'Monitoring - Request metrics' });
    }

    monitoring.performance.responseTime = Date.now() - startTime;

    return NextResponse.json(monitoring);
  } catch (error: any) {
    logError(error, { context: 'GET /api/admin/monitoring' });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}
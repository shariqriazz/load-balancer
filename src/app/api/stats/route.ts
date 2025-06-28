export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ApiKey } from '@/lib/models/ApiKey';
import { RequestLogData } from '@/lib/models/RequestLog';
import { getDb } from '@/lib/db';
import { logError } from '@/lib/services/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    
    const stats = await generateStats(timeRange);
    return NextResponse.json(stats);
  } catch (error: any) {
    logError(error, { context: 'GET /api/stats' });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

function getDateRange(timeRange: string): { startDate: Date, endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();
  
  switch (timeRange) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }
  
  if (timeRange !== '24h') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }
  
  return { startDate, endDate };
}

function formatDate(date: Date, timeRange: string): string {
  if (timeRange === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function generateTimePeriods(startDate: Date, endDate: Date, timeRange: string): Date[] {
  const periods: Date[] = [];
  let current: Date;

  if (timeRange === '24h') {
    current = new Date(startDate.toISOString());
    current.setUTCMinutes(0, 0, 0);
    const finalEndDateUTC = new Date(endDate.toISOString());

    let safetyCounter = 0;
    while (current <= finalEndDateUTC && safetyCounter < 48) {
      periods.push(new Date(current));
      current.setUTCHours(current.getUTCHours() + 1);
      safetyCounter++;
    }
     if (safetyCounter >= 48) {
        console.warn("generateTimePeriods 24h loop exceeded safety limit");
     }
  } else {
    current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const finalEndDate = new Date(endDate);
    finalEndDate.setHours(23, 59, 59, 999);

    let safetyCounter = 0;
    while (current <= finalEndDate && safetyCounter < 180) {
      periods.push(new Date(current));
      current.setDate(current.getDate() + 1);
      safetyCounter++;
    }
     if (safetyCounter >= 180) {
        console.warn("generateTimePeriods daily loop exceeded safety limit");
     }
  }

  return periods;
}

async function generateStats(timeRange: string) {
  const { startDate: requestStartDate, endDate: requestEndDate } = getDateRange(timeRange);
  const requestStartDateISO = requestStartDate.toISOString();
  const requestEndDateISO = requestEndDate.toISOString();

  const hourlyEndDateUTC = new Date(); // Current time is the end point
  const hourlyStartDateUTC = new Date(hourlyEndDateUTC.getTime() - 24 * 60 * 60 * 1000); // Exactly 24 hours prior
  const hourlyStartDateISO = hourlyStartDateUTC.toISOString();
  const hourlyEndDateISO = hourlyEndDateUTC.toISOString();

  try {
    const db = await getDb();
    const keys = await ApiKey.findAll({});
    
    let totalRequests = keys.reduce((sum, key) => sum + (key.requestCount || 0), 0);
    let totalRequestsToday = keys.reduce((sum, key) => sum + (key.dailyRequestsUsed || 0), 0);
    let activeKeys = keys.filter(key => key.isActive && !key.isDisabledByRateLimit).length;

    let totalRequests24h = 0;
    let totalErrors = 0;
    let apiKeyErrors = 0;
    let avgResponseTime = 0;
    
    const timePeriods = generateTimePeriods(requestStartDate, requestEndDate, timeRange); // Use request dates for requestData chart periods
    

    const requests24hResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM request_logs WHERE isError = 0 AND timestamp >= ? AND timestamp <= ?`,
      hourlyStartDateISO, hourlyEndDateISO
    );
    totalRequests24h = requests24hResult?.count || 0;

    const errorsResult = await db.get<{ total: number, api: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN errorType = 'ApiKeyError' THEN 1 ELSE 0 END) as api
       FROM request_logs
       WHERE isError = 1 AND timestamp >= ? AND timestamp <= ?`,
      requestStartDateISO, requestEndDateISO
    );
    totalErrors = errorsResult?.total || 0;
    apiKeyErrors = errorsResult?.api || 0;

    const avgTimeResult = await db.get<{ avg: number }>(
      `SELECT AVG(responseTime) as avg
       FROM request_logs
       WHERE isError = 0 AND responseTime IS NOT NULL AND timestamp >= ? AND timestamp <= ?`,
      requestStartDateISO, requestEndDateISO
    );
    avgResponseTime = avgTimeResult?.avg ? Math.round(avgTimeResult.avg) : 0;

    let groupByFormat = '';
    if (timeRange === '24h') {
      groupByFormat = `strftime('%Y-%m-%d %H:00:00', timestamp)`;
    } else {
      groupByFormat = `strftime('%Y-%m-%d', timestamp)`;
    }
    // Optimized query with better aggregation
    const requestDataDbResult = await db.all<any[]>(
      `SELECT
         ${groupByFormat} as period,
         COUNT(*) as total_requests,
         SUM(CASE WHEN isError = 1 THEN 1 ELSE 0 END) as errors,
         SUM(CASE WHEN isError = 1 AND errorType = 'ApiKeyError' THEN 1 ELSE 0 END) as apiKeyErrors,
         AVG(CASE WHEN isError = 0 AND responseTime IS NOT NULL THEN responseTime END) as avg_response_time
       FROM request_logs
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY period
       ORDER BY period ASC`,
      requestStartDateISO, requestEndDateISO
    );

    // Fill in missing periods with zero values
    const periodMap = new Map();
    requestDataDbResult.forEach(row => {
      periodMap.set(row.period, row);
    });

    const completeRequestData = timePeriods.map(date => {
      let periodKey;
      if (timeRange === '24h') {
        periodKey = date.toISOString().substring(0, 13) + ':00:00';
      } else {
        periodKey = date.toISOString().substring(0, 10);
      }
      
      const data = periodMap.get(periodKey) || {
        period: periodKey,
        total_requests: 0,
        errors: 0,
        apiKeyErrors: 0,
        avg_response_time: null
      };
      
      return {
        ...data,
        avg_response_time: data.avg_response_time ? Math.round(data.avg_response_time) : 0
      };
    });

    // Process requestDataDbResult here if needed

    return {
      totalRequests,
      totalRequestsToday,
      totalRequests24h,
      totalErrors,
      apiKeyErrors,
      avgResponseTime,
      successRate: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0,
      activeKeys,
      requestData: completeRequestData, // Use the complete data with filled periods
      timePeriods: timePeriods.map(date => formatDate(date, timeRange)), // Format periods for chart labels
    };

  } catch (error) {
    logError('Error generating stats', error);
    // Re-throw the error to be caught by the route handler
    throw error;
  }
} // Closing brace for generateStats function

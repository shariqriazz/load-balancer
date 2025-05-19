export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ApiKey } from '@/lib/models/ApiKey';
import { RequestLogData } from '@/lib/models/RequestLog';
import { getDb } from '@/lib/db';
import { logError } from '@/lib/services/logger';

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
    const requestDataDbResult = await db.all<any[]>(
      `SELECT
         ${groupByFormat} as period,
         COUNT(*) as total_requests,
         SUM(CASE WHEN isError = 1 THEN 1 ELSE 0 END) as errors,
         SUM(CASE WHEN isError = 1 AND errorType = 'ApiKeyError' THEN 1 ELSE 0 END) as apiKeyErrors
       FROM request_logs
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY period
       ORDER BY period ASC`,
      requestStartDateISO, requestEndDateISO
    );

    const requestDataMap = new Map<string, { timestamp: string, name: string, requests: number, errors: number, apiKeyErrors: number, date: Date }>();

    timePeriods.forEach(date => {
      let key: string;
      let name: string = '';
      let timestamp: string = '';

      if (isNaN(date.getTime())) {
        console.warn(`Invalid date generated in timePeriods: ${date}`);
        return;
      }

      if (timeRange === '24h') {
        key = date.toISOString();
        timestamp = key;
      } else {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        key = `${year}-${month}-${day}`;
        name = formatDate(date, timeRange); // Format name for display
      }
      requestDataMap.set(key, { timestamp, name, requests: 0, errors: 0, apiKeyErrors: 0, date });
    });

    requestDataDbResult.forEach(row => {
      let keyToUpdate: string | null = null;

      try {
        if (timeRange === '24h') {
          const periodDateUTC = new Date(row.period.replace(' ', 'T') + 'Z'); // Parse DB period as UTC
          if (!isNaN(periodDateUTC.getTime())) {
            const isoKey = periodDateUTC.toISOString();
            if (requestDataMap.has(isoKey)) {
              keyToUpdate = isoKey;
            }
          } else {
            console.warn(`24h: Could not parse DB period ${row.period} as valid date.`);
          }
        } else {
          // For daily, match using local 'YYYY-MM-DD' keys
          const dateKey = row.period;
          if (requestDataMap.has(dateKey)) {
            keyToUpdate = dateKey;
          }
        }
      } catch (e) {
        console.error(`Error processing DB period ${row.period}:`, e);
        return; // Skip this row on error
      }


      if (keyToUpdate) {
        const entry = requestDataMap.get(keyToUpdate);
        // Ensure entry exists before trying to update it
        if (entry) {
            const totalRequests = Number(row.total_requests) || 0;
            const errors = Number(row.errors) || 0;
            const apiKeyErrors = Number(row.apiKeyErrors) || 0;

            entry.requests = totalRequests - errors; // Store successful requests
            entry.errors = errors;
            entry.apiKeyErrors = apiKeyErrors;
        } else {
             console.warn(`Entry not found for key ${keyToUpdate} derived from period ${row.period}`);
        }
      } else {
      }
    });

    const requestData = Array.from(requestDataMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime()) // Sort by original Date object
      .map(({ timestamp, name, requests, errors, apiKeyErrors }) =>
        timeRange === '24h'
          ? { timestamp, requests, errors, apiKeyErrors }
          : { name, requests, errors, apiKeyErrors }
      );


    const hourlyDbResult = await db.all<{ hour: string, requests: number }[]>(
      `SELECT
         strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) as hour,
         COUNT(*) as requests
       FROM request_logs
       WHERE isError = 0 AND timestamp >= ? AND timestamp <= ?
       GROUP BY hour
       ORDER BY hour ASC`,
      hourlyStartDateISO, hourlyEndDateISO
    );

    const hourlyMap = new Map<string, { hour: string, requests: number, timestamp: Date }>();
    let currentUTCHourMarker = new Date(hourlyStartDateUTC);
    currentUTCHourMarker.setUTCMinutes(0, 0, 0);
    for (let i = 0; i < 24; i++) {
      if (currentUTCHourMarker > hourlyEndDateUTC) break;
      const hourUTCSlotStart = new Date(currentUTCHourMarker);
      const hourKey = hourUTCSlotStart.toISOString();
      hourlyMap.set(hourKey, { hour: hourKey, requests: 0, timestamp: hourUTCSlotStart });
      currentUTCHourMarker.setUTCHours(currentUTCHourMarker.getUTCHours() + 1);
    }
    hourlyDbResult.forEach(row => {
      if (hourlyMap.has(row.hour)) {
        hourlyMap.get(row.hour)!.requests = row.requests;
      }
    });
    const finalHourlyData = Array.from(hourlyMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(({ hour, requests }) => ({ hour, requests }));


    const modelUsageDbResult = await db.all<{ modelUsed: string, count: number }[]>(
      `SELECT modelUsed, COUNT(*) as count
       FROM request_logs
       WHERE modelUsed IS NOT NULL AND timestamp >= ? AND timestamp <= ?
       GROUP BY modelUsed
       ORDER BY count DESC`,
      requestStartDateISO, requestEndDateISO
    );
    const modelUsageData = modelUsageDbResult.map(row => ({ name: row.modelUsed, value: row.count }));




    const keyUsageData = keys
        .filter(key => (key.requestCount || 0) > 0)
        .map(key => {
            const maskedKey = `Key ${key._id.substring(0, 4)}...`;
            return {
                name: key.name || maskedKey,
                value: key.requestCount || 0
            };
        })
        .sort((a, b) => b.value - a.value); // Sort by usage descending
    
    
    
    const totalRequestsTimeRangeResult = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM request_logs WHERE timestamp >= ? AND timestamp <= ?`,
        requestStartDateISO, requestEndDateISO
    );
    const totalRequestsTimeRange = totalRequestsTimeRangeResult?.count || 0;
    const successRate = totalRequestsTimeRange > 0
      ? ((totalRequestsTimeRange - totalErrors) / totalRequestsTimeRange) * 100
      : 100;
    

    return {
      totalRequests,
      totalRequestsToday,
      totalRequests24h,
      totalErrors,
      apiKeyErrors,
      successRate,
      avgResponseTime,
      requestData,
      hourlyData: finalHourlyData,
      keyUsageData,
      modelUsageData
    };
  } catch (error: any) {
    logError(error, { context: 'generateStats DB Query' });
    console.error('Error generating stats from DB:', error);
    return createEmptyStats(requestStartDate, requestEndDate, timeRange);
  }
}

function createEmptyStats(startDate: Date, endDate: Date, timeRange: string) {
  const timePeriods = generateTimePeriods(startDate, endDate, timeRange);
  const requestData = timePeriods.map(date => ({
    name: formatDate(date, timeRange),
    requests: 0,
    errors: 0,
    apiKeyErrors: 0
  }));

  const emptyHourlyData: { hour: string, requests: number }[] = [];
  const hourlyEndDate = new Date(); // Use current time as end
  const hourlyStartDate = new Date();
  hourlyStartDate.setHours(hourlyStartDate.getHours() - 24);
  let currentHour = new Date(hourlyStartDate);
  currentHour.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const hourTimestamp = new Date(currentHour);
    const hourKey = hourTimestamp.toISOString();
    emptyHourlyData.push({ hour: hourKey, requests: 0 });
    currentHour.setHours(currentHour.getHours() + 1);
  }
  
  return {
    totalRequests: 0,
    totalRequestsToday: 0,
    totalRequests24h: 0,
    totalErrors: 0,
    apiKeyErrors: 0,
    successRate: 100,
    avgResponseTime: 0,
    requestData,
    hourlyData: emptyHourlyData,
    keyUsageData: [],
    modelUsageData: []
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';
    
    const stats = await generateStats(timeRange);
    
    return NextResponse.json(stats);
  } catch (error: any) {
    logError(error, { context: 'Stats API' });
    
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Failed to generate statistics',
          type: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}
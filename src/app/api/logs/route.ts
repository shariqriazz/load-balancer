export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
import { getLogs, logError } from '@/lib/services/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'requests' | 'errors' | 'keys' | null;
    const limit = searchParams.get('limit');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    if (!type || !['requests', 'errors', 'keys'].includes(type)) {
      return NextResponse.json({ error: 'Invalid or missing log type specified. Use "requests", "errors", or "keys".' }, { status: 400 });
    }

    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
    };

    // Validate limit if provided
    if (options.limit !== undefined && (isNaN(options.limit) || options.limit <= 0)) {
        return NextResponse.json({ error: 'Invalid limit specified. Must be a positive number.' }, { status: 400 });
    }

    // Basic date validation (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (options.startDate && !dateRegex.test(options.startDate)) {
        return NextResponse.json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (options.endDate && !dateRegex.test(options.endDate)) {
        return NextResponse.json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const logsData = await getLogs(type, options);
    return NextResponse.json(logsData);

  } catch (error: any) {
    console.error('API Error fetching logs:', error);
    logError(error, { context: 'API /api/logs GET handler' });
    return NextResponse.json({ error: 'Failed to fetch logs', details: error.message || 'Unknown error' }, { status: 500 });
  }
}
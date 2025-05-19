import { NextResponse } from 'next/server';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError } from '@/lib/services/logger';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all keys from the database
    const keys = await ApiKey.findAll({}); // Assuming findAll returns instances or plain data

    // Convert instances to plain data objects if necessary (adjust based on ApiKey.findAll implementation)
    const keysData = keys.map(keyInstance => ({
        _id: keyInstance._id,
        key: keyInstance.key,
        name: keyInstance.name,
        isActive: keyInstance.isActive,
        lastUsed: keyInstance.lastUsed,
        rateLimitResetAt: keyInstance.rateLimitResetAt,
        failureCount: keyInstance.failureCount,
        requestCount: keyInstance.requestCount,
        dailyRateLimit: keyInstance.dailyRateLimit,
        dailyRequestsUsed: keyInstance.dailyRequestsUsed,
        lastResetDate: keyInstance.lastResetDate,
        isDisabledByRateLimit: keyInstance.isDisabledByRateLimit,
    }));


    // Create a JSON response with headers for file download
    const jsonString = JSON.stringify(keysData, null, 2); // Pretty print JSON
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Content-Disposition', `attachment; filename="lb-keys-export-${new Date().toISOString().split('T')[0]}.json"`);

    return new NextResponse(jsonString, { status: 200, headers });

  } catch (error: any) {
    logError(error, { context: 'Export API Keys' });
    return NextResponse.json(
      { message: 'Failed to export API keys', error: error.message },
      { status: 500 }
    );
  }
}
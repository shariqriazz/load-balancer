import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import rovodevKeyManager from '@/lib/services/rovodevKeyManager';
import { logError } from '@/lib/services/logger';

// GET /api/admin/rovodev-keys - Get all RovoDev keys
export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await rovodevKeyManager.getAllKeys();
    return NextResponse.json({ 
      keys: keys.map(key => key.toJSON()),
      total: keys.length
    });
  } catch (error: any) {
    logError(error, { context: 'GET /api/admin/rovodev-keys' });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/rovodev-keys - Create a new RovoDev key
export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.profile || !body.email || !body.apiToken) {
      return NextResponse.json(
        { error: 'Missing required fields: profile, email, apiToken' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate API token length
    if (body.apiToken.length < 10) {
      return NextResponse.json(
        { error: 'API token must be at least 10 characters long' },
        { status: 400 }
      );
    }

    const rovoDevKey = await rovodevKeyManager.createKey({
      profile: body.profile,
      email: body.email,
      apiToken: body.apiToken,
      cloudId: body.cloudId,
      dailyTokenLimit: body.dailyTokenLimit
    });

    return NextResponse.json({ 
      message: 'RovoDev key created successfully',
      key: rovoDevKey.toJSON()
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/rovodev-keys' });
    
    if (error.message.includes('Failed to authenticate')) {
      return NextResponse.json(
        { error: 'Invalid RovoDev credentials - authentication failed' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
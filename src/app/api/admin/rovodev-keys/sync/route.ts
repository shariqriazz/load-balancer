import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import rovodevKeyManager from '@/lib/services/rovodevKeyManager';
import { logError } from '@/lib/services/logger';

// POST /api/admin/rovodev-keys/sync - Sync usage for all RovoDev keys
export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const profile = body.profile;

    if (profile) {
      // Sync usage for specific profile
      await rovodevKeyManager.syncUsageForProfile(profile);
      return NextResponse.json({ 
        message: `Usage synced successfully for profile: ${profile}`
      });
    } else {
      // Sync usage for all keys
      await rovodevKeyManager.syncAllUsage();
      return NextResponse.json({ 
        message: 'Usage synced successfully for all RovoDev keys'
      });
    }
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/rovodev-keys/sync' });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
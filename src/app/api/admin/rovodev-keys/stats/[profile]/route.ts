import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import rovodevKeyManager from '@/lib/services/rovodevKeyManager';
import { logError } from '@/lib/services/logger';

// GET /api/admin/rovodev-keys/stats/[profile] - Get usage statistics for a profile
export async function GET(
  request: NextRequest,
  { params }: { params: { profile: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await rovodevKeyManager.getProfileUsageStats(params.profile);
    const keys = await rovodevKeyManager.getKeysByProfile(params.profile);
    
    // Calculate additional statistics
    const usagePercentage = stats.totalDailyLimit > 0 
      ? (stats.totalTokensUsed / stats.totalDailyLimit) * 100 
      : 0;
    
    const keyDetails = keys.map(key => ({
      id: key._id,
      email: key.email,
      isActive: key.isActive,
      tokensUsed: key.dailyTokensUsed,
      tokensRemaining: key.getRemainingTokens(),
      tokenLimit: key.dailyTokenLimit,
      usagePercentage: key.dailyTokenLimit > 0 
        ? (key.dailyTokensUsed / key.dailyTokenLimit) * 100 
        : 0,
      isDisabledByRateLimit: key.isDisabledByRateLimit,
      lastUsed: key.lastUsed,
      failureCount: key.failureCount
    }));

    return NextResponse.json({
      profile: params.profile,
      summary: {
        ...stats,
        usagePercentage: Math.round(usagePercentage * 100) / 100
      },
      keys: keyDetails
    });
  } catch (error: any) {
    logError(error, { context: 'GET /api/admin/rovodev-keys/stats/[profile]', profile: params.profile });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
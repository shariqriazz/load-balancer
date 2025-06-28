import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError } from '@/lib/services/logger';

// GET /api/admin/profiles - Get all profiles with statistics
export async function GET() {
  try {
    const db = await getDb();
    
    // Get all profiles with key counts and statistics
    const profileStats = await db.all(`
      SELECT 
        COALESCE(profile, 'default') as name,
        COUNT(*) as keyCount,
        SUM(CASE WHEN isActive = 1 AND isDisabledByRateLimit = 0 THEN 1 ELSE 0 END) as activeKeys,
        SUM(CASE WHEN isDisabledByRateLimit = 1 THEN 1 ELSE 0 END) as rateLimitedKeys,
        SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactiveKeys,
        SUM(requestCount) as totalRequests,
        SUM(dailyRequestsUsed) as dailyRequestsUsed,
        AVG(CASE WHEN dailyRateLimit IS NOT NULL THEN dailyRateLimit END) as avgDailyLimit,
        MAX(lastUsed) as lastUsed
      FROM api_keys 
      GROUP BY COALESCE(profile, 'default')
      ORDER BY name
    `);

    // Get profile descriptions from a profiles table (we'll create this)
    let profileDescriptions: Record<string, { description: string; color: string; icon: string }> = {};
    try {
      const descriptions = await db.all(`
        SELECT name, description, color, icon 
        FROM profiles 
        ORDER BY name
      `);
      profileDescriptions = descriptions.reduce((acc: any, row: any) => {
        acc[row.name] = {
          description: row.description || '',
          color: row.color || '#6366f1',
          icon: row.icon || 'key'
        };
        return acc;
      }, {});
    } catch (error) {
      // Profiles table doesn't exist yet, that's okay
    }

    const profiles = profileStats.map((stat: any) => ({
      name: stat.name,
      description: profileDescriptions[stat.name]?.description || '',
      color: profileDescriptions[stat.name]?.color || '#6366f1',
      icon: profileDescriptions[stat.name]?.icon || 'key',
      keyCount: stat.keyCount,
      activeKeys: stat.activeKeys,
      rateLimitedKeys: stat.rateLimitedKeys,
      inactiveKeys: stat.inactiveKeys,
      totalRequests: stat.totalRequests || 0,
      dailyRequestsUsed: stat.dailyRequestsUsed || 0,
      avgDailyLimit: stat.avgDailyLimit ? Math.round(stat.avgDailyLimit) : null,
      lastUsed: stat.lastUsed,
      isDefault: stat.name === 'default'
    }));

    return NextResponse.json(profiles);
  } catch (error: any) {
    logError(error, { context: 'GET /api/admin/profiles' });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

// POST /api/admin/profiles - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      );
    }

    const profileName = name.trim();
    
    // Validate profile name
    if (profileName === 'default') {
      return NextResponse.json(
        { error: 'Cannot create profile named "default"' },
        { status: 400 }
      );
    }

    if (profileName.length > 50) {
      return NextResponse.json(
        { error: 'Profile name must be 50 characters or less' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Create profiles table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        name TEXT PRIMARY KEY,
        description TEXT,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT 'key',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if profile already exists
    const existingProfile = await db.get(
      'SELECT name FROM profiles WHERE name = ?',
      profileName
    );

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists' },
        { status: 409 }
      );
    }

    // Insert new profile
    await db.run(
      `INSERT INTO profiles (name, description, color, icon) 
       VALUES (?, ?, ?, ?)`,
      profileName,
      description || '',
      color || '#6366f1',
      icon || 'key'
    );

    const newProfile = {
      name: profileName,
      description: description || '',
      color: color || '#6366f1',
      icon: icon || 'key',
      keyCount: 0,
      activeKeys: 0,
      rateLimitedKeys: 0,
      inactiveKeys: 0,
      totalRequests: 0,
      dailyRequestsUsed: 0,
      avgDailyLimit: null,
      lastUsed: null,
      isDefault: false
    };

    return NextResponse.json({
      message: 'Profile created successfully',
      profile: newProfile
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/profiles' });
    return NextResponse.json(
      { error: error.message || 'Failed to create profile' },
      { status: 500 }
    );
  }
}
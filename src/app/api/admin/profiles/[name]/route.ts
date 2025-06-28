import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError } from '@/lib/services/logger';

// GET /api/admin/profiles/[name] - Get specific profile with keys
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const profileName = decodeURIComponent(params.name);
    const db = await getDb();

    // Get profile details
    let profileDetails = {
      name: profileName,
      description: '',
      color: '#6366f1',
      icon: 'key'
    };

    try {
      const profile = await db.get(
        'SELECT * FROM profiles WHERE name = ?',
        profileName
      );
      if (profile) {
        profileDetails = {
          name: profile.name,
          description: profile.description || '',
          color: profile.color || '#6366f1',
          icon: profile.icon || 'key'
        };
      }
    } catch (error) {
      // Profiles table might not exist, use defaults
    }

    // Get keys for this profile
    const keys = await ApiKey.findAll({ 
      profile: profileName === 'default' ? '' : profileName 
    });

    const maskedKeys = keys.map(key => ({
      ...key,
      key: `${key.key.substring(0, 10)}...${key.key.substring(key.key.length - 4)}`
    }));

    return NextResponse.json({
      profile: profileDetails,
      keys: maskedKeys
    });
  } catch (error: any) {
    logError(error, { context: `GET /api/admin/profiles/${params.name}` });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/profiles/[name] - Update profile
export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const profileName = decodeURIComponent(params.name);
    const body = await request.json();
    const { description, color, icon } = body;

    if (profileName === 'default') {
      return NextResponse.json(
        { error: 'Cannot modify default profile' },
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

    // Update or insert profile
    await db.run(
      `INSERT OR REPLACE INTO profiles (name, description, color, icon, updated_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      profileName,
      description || '',
      color || '#6366f1',
      icon || 'key'
    );

    return NextResponse.json({
      message: 'Profile updated successfully'
    });
  } catch (error: any) {
    logError(error, { context: `PUT /api/admin/profiles/${params.name}` });
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/profiles/[name] - Delete profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const profileName = decodeURIComponent(params.name);

    if (profileName === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete default profile' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if profile has keys (handle both empty string and null cases)
    const keyCount = await db.get(
      `SELECT COUNT(*) as count FROM api_keys WHERE profile = ? OR (profile IS NULL AND ? = 'default') OR (profile = '' AND ? = 'default')`,
      profileName, profileName, profileName
    );
    
    if (keyCount && keyCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete profile with ${keyCount.count} keys. Move or delete keys first.` },
        { status: 409 }
      );
    }

    // Delete profile
    const result = await db.run(
      'DELETE FROM profiles WHERE name = ?',
      profileName
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Profile deleted successfully'
    });
  } catch (error: any) {
    logError(error, { context: `DELETE /api/admin/profiles/${params.name}` });
    return NextResponse.json(
      { error: error.message || 'Failed to delete profile' },
      { status: 500 }
    );
  }
}
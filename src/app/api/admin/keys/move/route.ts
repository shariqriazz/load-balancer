import { NextRequest, NextResponse } from 'next/server';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError } from '@/lib/services/logger';

// POST /api/admin/keys/move - Move keys between profiles
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyIds, targetProfile } = body;

    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return NextResponse.json(
        { error: 'keyIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (typeof targetProfile !== 'string') {
      return NextResponse.json(
        { error: 'targetProfile must be a string' },
        { status: 400 }
      );
    }

    // Validate all key IDs exist
    const keys = await Promise.all(
      keyIds.map(async (id: string) => {
        const key = await ApiKey.findOne({ _id: id });
        if (!key) {
          throw new Error(`Key with ID ${id} not found`);
        }
        return key;
      })
    );

    // Update all keys to new profile
    const updatedKeys = new Map<string, ApiKey>();
    for (const key of keys) {
      key.profile = targetProfile === 'default' ? '' : targetProfile;
      updatedKeys.set(key._id, key);
    }

    // Bulk update
    await ApiKey.bulkUpdate(updatedKeys);

    return NextResponse.json({
      message: `Successfully moved ${keyIds.length} keys to profile "${targetProfile}"`,
      movedCount: keyIds.length
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/keys/move' });
    return NextResponse.json(
      { error: error.message || 'Failed to move keys' },
      { status: 500 }
    );
  }
}
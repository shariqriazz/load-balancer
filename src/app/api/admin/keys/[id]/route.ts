import { NextRequest, NextResponse } from 'next/server';
import { ApiKey } from '@/lib/models/ApiKey';
import { logError, logKeyEvent } from '@/lib/services/logger';

// DELETE /api/admin/keys/:id - Delete an API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    const deleted = await ApiKey.deleteById(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'API key deleted successfully'
    });
  } catch (error: any) {
    logError(error, { context: 'DELETE /api/admin/keys' });
    return NextResponse.json(
      { error: error.message || 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/keys/:id - Toggle API key active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    const key = await ApiKey.findOne({ _id: id });

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Toggle the active status
    const wasActive = key.isActive;
    key.isActive = !key.isActive;

    // If activating the key, reset failure count and rate limit
    if (!wasActive && key.isActive) {
      key.failureCount = 0;
      key.rateLimitResetAt = null;
      key.isDisabledByRateLimit = false;
      logKeyEvent('Key Reactivated', { keyId: key._id, reason: 'Manual activation' });
    } else if (wasActive && !key.isActive) {
      logKeyEvent('Key Deactivated', { keyId: key._id, reason: 'Manual deactivation' });
    }

    await key.save();

    return NextResponse.json({
      message: `API key ${key.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: key.isActive
    });
  } catch (error: any) {
    logError(error, { context: 'PATCH /api/admin/keys' });
    return NextResponse.json(
      { error: error.message || 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/keys/:id - Update API key details (e.g., name)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    const { name, profile, dailyRateLimit } = body; // Expecting 'name', 'profile', and optionally 'dailyRateLimit'

    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Basic validation for name (optional, adjust as needed)
    if (name !== undefined && typeof name !== 'string') {
       return NextResponse.json(
        { error: 'Invalid name format' },
        { status: 400 }
      );
    }

    // Basic validation for profile (optional)
    if (profile !== undefined && profile !== null && typeof profile !== 'string') {
       return NextResponse.json(
        { error: 'Invalid profile format. Must be a string or null.' },
        { status: 400 }
      );
    }

    // Validate dailyRateLimit
    let validatedRateLimit: number | null | undefined = undefined; // Keep track of validated value
    if (dailyRateLimit !== undefined) {
      if (dailyRateLimit === null) {
        validatedRateLimit = null; // Allow setting to null (disable limit)
      } else if (typeof dailyRateLimit === 'number' && Number.isInteger(dailyRateLimit) && dailyRateLimit >= 0) {
        validatedRateLimit = dailyRateLimit; // Valid positive integer or zero
      } else {
        return NextResponse.json(
          { error: 'Invalid dailyRateLimit format. Must be a non-negative integer or null.' },
          { status: 400 }
        );
      }
    }

    const key = await ApiKey.findOne({ _id: id });

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    const updatedFields: string[] = [];
    if (name !== undefined) {
      key.name = name?.trim() || undefined; // Trim whitespace or set to undefined if empty
      updatedFields.push('name');
    }
    if (profile !== undefined) {
      key.profile = profile === null ? '' : profile.trim() || ''; // Trim whitespace or set to empty string if empty
      updatedFields.push('profile');
    }
    if (validatedRateLimit !== undefined) {
      key.dailyRateLimit = validatedRateLimit;
      updatedFields.push('dailyRateLimit');
      // If the limit is removed or set to 0, ensure the key isn't disabled by the limit anymore
      if (validatedRateLimit === null || validatedRateLimit === 0) {
          key.isDisabledByRateLimit = false;
      }
    }

    await key.save();

    if (updatedFields.length > 0) {
      logKeyEvent('Key Updated', { keyId: key._id, updatedFields: updatedFields });
    }

    const maskedKey = {
      ...key,
      key: `${key.key.substring(0, 10)}...${key.key.substring(
        key.key.length - 4
      )}`,
    };

    return NextResponse.json({
      message: 'API key updated successfully',
      key: maskedKey
    });
  } catch (error: any) {
    logError(error, { context: 'PUT /api/admin/keys' });
    return NextResponse.json(
      { error: error.message || 'Failed to update API key' },
      { status: 500 }
    );
  }
}
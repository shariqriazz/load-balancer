import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import rovodevKeyManager from '@/lib/services/rovodevKeyManager';
import { logError } from '@/lib/services/logger';

// GET /api/admin/rovodev-keys/[id] - Get a specific RovoDev key
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rovoDevKey = await rovodevKeyManager.getKey(params.id);
    if (!rovoDevKey) {
      return NextResponse.json({ error: 'RovoDev key not found' }, { status: 404 });
    }

    return NextResponse.json({ key: rovoDevKey.toJSON() });
  } catch (error: any) {
    logError(error, { context: 'GET /api/admin/rovodev-keys/[id]', id: params.id });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/rovodev-keys/[id] - Update a RovoDev key
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate email if provided
    if (body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Validate API token if provided
    if (body.apiToken && body.apiToken.length < 10) {
      return NextResponse.json(
        { error: 'API token must be at least 10 characters long' },
        { status: 400 }
      );
    }

    const rovoDevKey = await rovodevKeyManager.updateKey(params.id, body);

    return NextResponse.json({ 
      message: 'RovoDev key updated successfully',
      key: rovoDevKey.toJSON()
    });
  } catch (error: any) {
    logError(error, { context: 'PUT /api/admin/rovodev-keys/[id]', id: params.id });
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'RovoDev key not found' },
        { status: 404 }
      );
    }
    
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

// DELETE /api/admin/rovodev-keys/[id] - Delete a RovoDev key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await rovodevKeyManager.deleteKey(params.id);
    if (!success) {
      return NextResponse.json({ error: 'RovoDev key not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'RovoDev key deleted successfully' });
  } catch (error: any) {
    logError(error, { context: 'DELETE /api/admin/rovodev-keys/[id]', id: params.id });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
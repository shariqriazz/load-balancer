import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import rovodevKeyManager from '@/lib/services/rovodevKeyManager';
import { logError } from '@/lib/services/logger';

// POST /api/admin/rovodev-keys/test/[id] - Test a RovoDev key
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isValid = await rovodevKeyManager.testKey(params.id);
    
    return NextResponse.json({ 
      valid: isValid,
      message: isValid ? 'RovoDev key is valid and working' : 'RovoDev key is invalid or not working'
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/rovodev-keys/test/[id]', id: params.id });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
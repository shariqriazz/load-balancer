import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logError, logKeyEvent } from '@/lib/services/logger';

export async function POST() {
  try {
    logKeyEvent('Admin Action', { action: 'Stats reset initiated' });
    
    const db = await getDb();
    
    // Begin a transaction to ensure data consistency
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Reset request counts on all API keys
      await db.run(`
        UPDATE api_keys 
        SET requestCount = 0, 
            dailyRequestsUsed = 0, 
            failureCount = 0,
            lastResetDate = ?
      `, new Date().toISOString());
      
      // Clear recent logs (last 24 hours) while keeping older logs for historical reference
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      await db.run(`
        DELETE FROM request_logs 
        WHERE timestamp > ?
      `, oneDayAgo.toISOString());
      
      // Update key counts and status
      const updatedKeysCount = await db.get('SELECT COUNT(*) as count FROM api_keys');
      
      // Commit the changes
      await db.run('COMMIT');
      
      logKeyEvent('Admin Action', { 
        action: 'Stats reset completed', 
        keysAffected: updatedKeysCount?.count || 0 
      });
      
      return NextResponse.json({
        message: 'Statistics reset successfully',
        keysUpdated: updatedKeysCount?.count || 0
      });
      
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/reset-stats' });
    return NextResponse.json(
      { error: error.message || 'Failed to reset statistics' },
      { status: 500 }
    );
  }
} 
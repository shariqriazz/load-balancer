import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData, getPasswordHash } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Server-side session validation with crypto operations
 * This runs in Node.js runtime, not Edge Runtime
 */
export async function validateSession(): Promise<{ isValid: boolean; session: SessionData }> {
  try {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    
    // Comprehensive session validation with password hash check
    const currentPasswordHash = getPasswordHash();
    const isValid = session.isLoggedIn && 
                   session.passwordHash === currentPasswordHash &&
                   session.loginTime &&
                   (Date.now() - session.loginTime) < (7 * 24 * 60 * 60 * 1000); // 7 days max

    return { isValid, session };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false, session: {} as SessionData };
  }
}

/**
 * Middleware for API routes that require authentication
 */
export async function requireAuth(): Promise<{ authorized: boolean; session: SessionData }> {
  const { isValid, session } = await validateSession();
  
  if (!isValid) {
    // Clear invalid session
    if (session.isLoggedIn) {
      session.isLoggedIn = false;
      session.loginTime = undefined;
      session.passwordHash = undefined;
      await session.save();
    }
  }
  
  return { authorized: isValid, session };
}
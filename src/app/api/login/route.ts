import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData, getPasswordHash } from '@/lib/session';
import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'crypto';

// Simple in-memory rate limiting (in production, use Redis or database)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  
  const now = Date.now();
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 1;
  } else {
    attempts.count++;
  }
  
  attempts.lastAttempt = now;
  loginAttempts.set(ip, attempts);
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  
  // Check rate limiting
  if (isRateLimited(clientIP)) {
    console.log(`Login rate limited for IP: ${clientIP}`);
    return NextResponse.json(
      { message: 'Too many failed attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 }
    );
  }
  
  const { password } = body;

  if (!password || typeof password !== 'string') {
    recordFailedAttempt(clientIP);
    return NextResponse.json(
      { message: 'Password is required' },
      { status: 400 }
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set.');
    return NextResponse.json(
      { message: 'Server configuration error.' },
      { status: 500 }
    );
  }

  // Use timing-safe comparison to prevent timing attacks
  const providedHash = createHash('sha256').update(password).digest();
  const adminHash = createHash('sha256').update(adminPassword).digest();
  
  if (providedHash.length === adminHash.length && timingSafeEqual(providedHash, adminHash)) {
    // Clear failed attempts on successful login
    clearFailedAttempts(clientIP);
    
    session.isLoggedIn = true;
    session.loginTime = Date.now();
    session.passwordHash = getPasswordHash();
    await session.save();

    console.log('Login successful, session saved.');

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });
  } else {
    recordFailedAttempt(clientIP);
    console.log(`Login failed: Invalid password for IP: ${clientIP}`);
    
    // Add a small delay to slow down brute force attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return NextResponse.json(
      { message: 'Invalid password' },
      { status: 401 } // Unauthorized
    );
  }
}
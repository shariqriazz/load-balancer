import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    
    // Clear all session data properly
    session.isLoggedIn = false;
    session.loginTime = undefined;
    session.passwordHash = undefined;
    
    await session.save();

    console.log('Logout successful, session cleared.');

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Logout failed' },
      { status: 500 }
    );
  }
}
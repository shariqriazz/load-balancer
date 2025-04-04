import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  const { password } = await request.json();

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set.');
    return NextResponse.json(
      { message: 'Server configuration error.' },
      { status: 500 }
    );
  }

  if (password === adminPassword) {
    // Set session data directly
    session.isLoggedIn = true;
    // Removed extra closing brace
    await session.save();

    console.log('Login successful, session saved.'); // Add server-side log

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });
  } else {
    console.log('Login failed: Invalid password.'); // Add server-side log
    return NextResponse.json(
      { message: 'Invalid password' },
      { status: 401 } // Unauthorized
    );
  }
}
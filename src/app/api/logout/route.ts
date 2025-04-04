import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  // Destroy the session
  session.destroy();

  console.log('Logout successful, session destroyed.'); // Add server-side log

  // Send a response indicating successful logout
  // The client-side will handle the redirect
  return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
}
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  session.destroy();

  console.log('Logout successful, session destroyed.');

  return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
}
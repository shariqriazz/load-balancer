import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

// Paths that do not require authentication
const publicPaths = [
  '/login',
  '/api/login'
];

// Matcher config ensures middleware runs on appropriate paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/v1 (public API endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public images)
     */
    '/((?!api/v1|_next/static|_next/image|favicon.ico|images).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
 
  if (isPublicPath) {
    // If logged in and trying to access login page, redirect to dashboard
    if (pathname === '/login') {
      const session = await getIronSession<SessionData>(cookies(), sessionOptions);
      if (session.isLoggedIn) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }
 
  // Check if admin login is globally required via environment variable
  // Defaults to true if the variable is not explicitly set to 'false'
  const requireAdminLogin = process.env.REQUIRE_ADMIN_LOGIN !== 'false';

  if (requireAdminLogin) {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    if (!session.isLoggedIn) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
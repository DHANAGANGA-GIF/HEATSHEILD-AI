/**
 * HeatShield AI — Next.js Edge Middleware
 * Route protection using Firebase session + Supabase fallback.
 *
 * Protected paths require authentication.
 * Public paths are always accessible.
 *
 * NOTE: Firebase Admin SDK cannot run in Edge Runtime (no Node.js APIs).
 * We use a lightweight cookie/header check here and rely on individual
 * API routes for full Firebase token verification.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/notifications',
  '/risk',
  '/timeline',
  '/assistant',
  '/simulator',
  '/locations',
  '/profile',
  '/settings',
  '/reports',
  '/community',
  '/alerts',
  '/school',
  '/worksite',
  '/ngo',
  '/admin',
  '/onboarding',
  '/analytics',
  '/help',
];

// Paths that are always publicly accessible
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/privacy',
  '/terms',
  '/',
  '/api/send-email',   // Protected at route level with token verification
  '/api/auth',
  '/api/broadcast',
  '/api/messages',
  '/api/analytics',
  '/api/admin',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Check whether the request carries any valid authentication signal:
 * 1. Firebase ID token in Authorization header
 * 2. Supabase auth cookie (sb-*-auth-token)
 * 3. HeatShield session cookie (set on login)
 *
 * Full token verification happens in individual API routes.
 * Middleware only does a lightweight presence-check to decide redirect.
 */
function hasAuthSignal(request: NextRequest): boolean {
  // Check Authorization header (API requests with Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 20) return true;
  }

  // Check HeatShield session cookie (set on successful Firebase login)
  const sessionCookie = request.cookies.get('hs_session');
  if (sessionCookie?.value && sessionCookie.value.length > 10) return true;

  // Check Supabase auth cookie (legacy auth compatibility)
  const cookieNames = [...request.cookies.getAll().map((c) => c.name)];
  const hasSupabaseCookie = cookieNames.some(
    (name) => name.startsWith('sb-') && name.includes('auth-token')
  );
  if (hasSupabaseCookie) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // For protected paths: check for auth signal
  if (isProtectedPath(pathname)) {
    if (!hasAuthSignal(request)) {
      // Redirect to login, preserving the intended destination
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

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
  '/api/email/google/connect',
];

// Paths that are always publicly accessible
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/privacy',
  '/terms',
  '/',
  '/methodology',
  '/evidence',
  '/system',
  '/api/send-email',   // Protected at route level with token verification
  '/api/auth',
  '/api/broadcast',
  '/api/messages',
  '/api/analytics',
  '/api/admin',
  '/api/email/google/callback',   // Gmail OAuth callback — receives Google redirect with cryptographically verified state
  '/api/email/google/status',     // Gmail OAuth status check — returns connected/disconnected state
  '/api/email/status',            // Public email delivery status check
  '/api/email/test',              // Test send endpoint
  '/api/cron',                    // Vercel cron — authenticated via CRON_SECRET
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
  if (sessionCookie?.value && sessionCookie.value.length > 10) {
    const val = decodeURIComponent(sessionCookie.value).trim();
    const parts = val.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const nowSec = Math.floor(Date.now() / 1000);
        // Persistent session window: 7 days (604,800s)
        // Firebase ID tokens expire after 1 hour, but the persistent session allows client-side SDK
        // to restore and auto-refresh the token on page load.
        const issuedSec = typeof payload.auth_time === 'number' ? payload.auth_time : (typeof payload.iat === 'number' ? payload.iat : (payload.exp ? payload.exp - 3600 : 0));
        const MAX_SESSION_AGE_SEC = 7 * 24 * 3600; // 7 days
        if (issuedSec > 0 && (nowSec - issuedSec) > MAX_SESSION_AGE_SEC) {
          return false; // Genuinely expired session (> 7 days)
        }
      } catch {
        // Non-blocking fallback
      }
    }
    return true;
  }

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

  const isRelevant = pathname.startsWith('/dashboard') || pathname === '/login' || pathname === '/onboarding';
  if (isRelevant) {
    const sessionCookie = request.cookies.get('hs_session');
    const allCookieNames = request.cookies.getAll().map((c) => c.name);
    const authSignal = hasAuthSignal(request);

    console.log('[AUTH 11] middleware handling route:', {
      pathname,
      url: request.url,
      method: request.method,
    });

    console.log('[AUTH 12] whether middleware sees hs_session:', {
      pathname,
      hasHsSessionCookie: Boolean(sessionCookie),
      hsSessionPreview: sessionCookie?.value ? sessionCookie.value.slice(0, 15) + '...' : null,
      hsSessionLength: sessionCookie?.value?.length,
      allCookieNames,
      authSignal,
    });
  }

  // If already authenticated and visiting /login, redirect to intended destination or /dashboard
  if (pathname === '/login' && hasAuthSignal(request)) {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const destination = (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//') && !redirectParam.includes(':') && !redirectParam.includes('\\'))
      ? redirectParam
      : '/dashboard';
    if (isRelevant) {
      console.log('[AUTH 12] middleware on /login: user has auth signal, redirecting to destination:', destination);
    }
    return NextResponse.redirect(new URL(destination, request.url));
  }

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
      if (isRelevant) {
        console.warn('[AUTH 12] middleware REDIRECTING to /login. Reason: hasAuthSignal is FALSE for protected path:', pathname);
      }
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

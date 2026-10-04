import { NextResponse } from 'next/server';
import { verifyFirebaseToken, resolveAuthSession, extractBearerToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session
 *
 * Inspects request for Authorization header or hs_session cookie.
 * Returns authenticated session status without leaking any secrets or tokens.
 */
export async function GET(request: Request) {
  try {
    const session = await resolveAuthSession(request);

    if (session && session.uid) {
      return NextResponse.json({
        authenticated: true,
        uid: session.uid,
        email: session.email || '',
        name: session.name || '',
      });
    }

    return NextResponse.json({
      authenticated: false,
    });
  } catch (err: any) {
    console.error('[HeatShield Auth Session GET] Error:', err?.message);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

/**
 * POST /api/auth/session
 *
 * Validates a fresh Firebase ID token sent from the client,
 * establishes a server-verified session, and sets the hs_session HTTP cookie.
 */
export async function POST(request: Request) {
  try {
    let idToken: string | null = null;

    // 1. Try body { idToken: string }
    try {
      const body = await request.json();
      if (body && typeof body.idToken === 'string') {
        idToken = body.idToken.trim();
      }
    } catch {
      // Body might be empty, try Authorization header next
    }

    // 2. Try Authorization: Bearer <token>
    if (!idToken) {
      const authHeader = request.headers.get('authorization');
      idToken = extractBearerToken(authHeader);
    }

    if (!idToken || idToken.length < 10) {
      return NextResponse.json(
        { authenticated: false, error: 'A valid Firebase ID token is required to create a session.' },
        { status: 400 }
      );
    }

    // 3. CSRF & Cross-Site Origin Validation
    const origin = request.headers.get('origin');
    const host = request.headers.get('host') || new URL(request.url).host;
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          console.warn('[AUTH-SERVER] CSRF attempt blocked: origin host mismatch:', { originHost, host });
          return NextResponse.json(
            { authenticated: false, error: 'Cross-origin session creation forbidden.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { authenticated: false, error: 'Invalid origin header.' },
          { status: 403 }
        );
      }
    }

    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'cross-site') {
      console.warn('[AUTH-SERVER] Cross-site request blocked via Sec-Fetch-Site');
      return NextResponse.json(
        { authenticated: false, error: 'Cross-site request forbidden.' },
        { status: 403 }
      );
    }

    console.log('[AUTH-SERVER] POST /api/auth/session received request. idToken length:', idToken?.length);

    // 4. Cryptographically verify the token on the server
    const verified = await verifyFirebaseToken(idToken);
    console.log('[AUTH-SERVER] verifyFirebaseToken returned:', {
      success: Boolean(verified?.uid),
      uid: verified?.uid,
      email: verified?.email,
    });

    if (!verified || !verified.uid) {
      console.warn('[AUTH-SERVER] Token verification FAILED in verifyFirebaseToken.');
      return NextResponse.json(
        { authenticated: false, error: 'Token verification failed. Please sign in again.' },
        { status: 401 }
      );
    }

    // 5. Return success and attach authoritative httpOnly hs_session cookie
    const response = NextResponse.json({
      authenticated: true,
      uid: verified.uid,
      email: verified.email || '',
      name: verified.name || '',
    });

    const isHttps = request.url.startsWith('https:') || process.env.NODE_ENV === 'production';

    // 7-day persistent session cookie (604,800 seconds) — strictly httpOnly
    response.cookies.set('hs_session', idToken, {
      path: '/',
      httpOnly: true, // Secure: inaccessible to client-side JavaScript (XSS prevention)
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 86400, // 7 days persistent session
    });

    console.log('[AUTH-SERVER] POST /api/auth/session returning 200 with Set-Cookie hs_session (httpOnly: true, 7-day persistence), secure:', isHttps);
    return response;
  } catch (err: any) {
    console.error('[HeatShield Auth Session POST] Error:', err?.message);
    return NextResponse.json(
      { authenticated: false, error: 'Server error creating session.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 *
 * Clears the hs_session cookie on logout.
 */
export async function DELETE(request: Request) {
  const response = NextResponse.json({
    authenticated: false,
    message: 'Session terminated successfully.',
  });

  const isHttps = request.url.startsWith('https:') || process.env.NODE_ENV === 'production';

  response.cookies.set('hs_session', '', {
    path: '/',
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 0,
  });

  return response;
}


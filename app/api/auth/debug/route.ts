import { NextResponse } from 'next/server';
import { extractBearerToken, verifyFirebaseToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/debug
 *
 * Diagnostic endpoint to audit the server-side authentication chain.
 * Returns strictly sanitized metadata — NEVER returns any token, secret, or private key.
 */
export async function GET(request: Request) {
  let tokenSource: 'authorization' | 'cookie' | 'none' = 'none';
  let token: string | null = null;

  // 1. Inspect Authorization header
  const authHeader = request.headers.get('authorization');
  const bearer = extractBearerToken(authHeader);
  if (bearer) {
    tokenSource = 'authorization';
    token = bearer;
  } else {
    // 2. Inspect cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach((part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) cookies[k] = decodeURIComponent(v.join('='));
    });

    if (cookies['hs_session']) {
      tokenSource = 'cookie';
      token = cookies['hs_session'].trim();
    } else {
      const sbKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.includes('auth-token'));
      if (sbKey) {
        tokenSource = 'cookie';
        try {
          const parsed = JSON.parse(cookies[sbKey]);
          token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : cookies[sbKey]);
        } catch {
          token = cookies[sbKey];
        }
      }
    }
  }

  const tokenShapeValid = Boolean(token && token.split('.').length === 3);

  let authenticated = false;
  let uid: string | null = null;
  let serverVerification: 'success' | 'failed' = 'failed';

  if (token && tokenShapeValid) {
    const verified = await verifyFirebaseToken(token);
    if (verified) {
      authenticated = true;
      uid = verified.uid;
      serverVerification = 'success';
    }
  }

  const firebaseProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'not_configured';

  return NextResponse.json({
    authenticated,
    uid,
    tokenSource,
    tokenShapeValid,
    firebaseProjectId,
    serverVerification,
  });
}

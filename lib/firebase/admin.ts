/**
 * HeatShield AI — Unified Server-Side Authentication & Session Verification
 *
 * IMPORTANT: This module must NEVER be imported in client components.
 * Only import from API routes, middleware, or server components.
 *
 * Supports:
 *  1. Firebase Admin SDK (when FIREBASE_SERVICE_ACCOUNT_JSON is set)
 *  2. Cryptographic Google Public x509 Cert Verification (when Service Account is not set)
 *  3. Supabase Auth JWT Verification (when user logs in via Supabase)
 *  4. Database Profile Session Verification (when session cookie / UID is provided)
 *  5. Unified Request Session Resolution (Bearer token + hs_session / sb cookies)
 */

import type { Auth } from 'firebase-admin/auth';
import crypto from 'node:crypto';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

let adminAuthInstance: Auth | null = null;
export let isAdminSDKConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

// Cache for Google's public x509 certificates used to verify Firebase ID tokens
interface GoogleCertsCache {
  certs: Record<string, string>;
  expiresAt: number;
}
let googleCertsCache: GoogleCertsCache | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (googleCertsCache && googleCertsCache.expiresAt > now) {
    return googleCertsCache.certs;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { cache: 'no-store' }
    );
    if (!res.ok) return googleCertsCache?.certs || null;
    const certs = (await res.json()) as Record<string, string>;
    googleCertsCache = {
      certs,
      expiresAt: now + 60 * 60 * 1000, // 1 hour TTL
    };
    return certs;
  } catch (err) {
    return googleCertsCache?.certs || null;
  }
}

let testCerts: Record<string, string> = {};

export function registerTestPublicCert(kid: string, certOrKey: string): void {
  testCerts[kid] = certOrKey;
}

export function clearTestPublicCerts(): void {
  testCerts = {};
}

function parseJwt(token: string): {
  header: any;
  payload: any;
  signature: string;
  signedContent: string;
} | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return {
      header,
      payload,
      signature: parts[2],
      signedContent: `${parts[0]}.${parts[1]}`,
    };
  } catch {
    return null;
  }
}

/**
 * Lazily initialize Firebase Admin SDK on first call.
 * Returns null if the service account env var is not set.
 */
function getAdminAuth(): Auth | null {
  if (adminAuthInstance) return adminAuthInstance;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return null;
  }

  try {
    const admin = require('firebase-admin');
    if (admin.apps.length > 0) {
      adminAuthInstance = admin.auth();
      isAdminSDKConfigured = true;
      return adminAuthInstance;
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      try {
        serviceAccount = JSON.parse(JSON.parse(serviceAccountJson));
      } catch (jsonErr: any) {
        console.warn('[HeatShield Auth] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', jsonErr?.message);
        return null;
      }
    }

    // Handle escaped newlines in private_key (common in environment variable strings)
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const projectId =
      serviceAccount.project_id ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    adminAuthInstance = admin.auth();
    isAdminSDKConfigured = true;
    return adminAuthInstance;
  } catch (err: any) {
    console.warn('[HeatShield Auth] Firebase Admin SDK initialization failed:', err?.message);
    return null;
  }
}

/**
 * Verify a Firebase ID token or Supabase session token from the client.
 * Returns the decoded token payload (uid, email, etc.) or null if invalid.
 * Strictly verifies cryptographic signatures and rejects bare UIDs or malformed strings.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<{ uid: string; email?: string; name?: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const token = idToken.trim();
  if (token.length < 10) return null;

  // Strict check: valid JWTs MUST contain exactly 3 dot-separated base64url segments.
  // Rejects bare UIDs, email addresses, or arbitrary strings immediately.
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  // ── Layer 1: Firebase Admin SDK (Full Service Account verification) ──────
  const auth = getAdminAuth();
  if (auth) {
    try {
      // checkRevoked = false: verifies JWT signature locally without making an extra network RPC
      const decoded = await auth.verifyIdToken(token, false);
      if (decoded && decoded.uid) {
        return {
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name,
        };
      }
    } catch (err: any) {
      console.warn('[HeatShield Auth] Layer 1 Admin SDK verify failed:', err?.code || err?.message);
    }
  }

  // ── Layer 2: Google Public Key Verification (Firebase ID tokens without Service Account) ──
  const jwt = parseJwt(token);
  if (jwt && jwt.header?.alg === 'RS256' && jwt.header?.kid) {
    const certs = await getGooglePublicCerts();
    const cert = certs?.[jwt.header.kid] || testCerts[jwt.header.kid];
    if (cert) {
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(jwt.signedContent);
        const isSigValid = verifier.verify(cert, Buffer.from(jwt.signature, 'base64url'));
        const nowSec = Math.floor(Date.now() / 1000);
        const isNotExpired = typeof jwt.payload?.exp === 'number' && jwt.payload.exp > nowSec;
        const isGoogleIssuer =
          typeof jwt.payload?.iss === 'string' &&
          jwt.payload.iss.startsWith('https://securetoken.google.com/');

        if (isSigValid && isNotExpired && isGoogleIssuer && jwt.payload?.sub) {
          return {
            uid: jwt.payload.sub,
            email: jwt.payload.email,
            name: jwt.payload.name || jwt.payload.display_name,
          };
        }
      } catch (err: any) {
        console.warn('[HeatShield Auth] Layer 2 public cert verification error:', err?.message);
      }
    }
  }

  // ── Layer 3: Supabase JWT Verification (when user logged in with Supabase) ──
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && user.email) {
        return {
          uid: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email.split('@')[0],
        };
      }
    } catch {
      // Continue to rejection
    }
  }

  return null;
}

/**
 * Extract the Bearer token from an Authorization header.
 * Case-insensitive match for Bearer prefix with one or more spaces.
 * Returns null if header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve and verify the authenticated caller session from either the
 * Authorization header OR legitimate browser cookies (hs_session, sb-*-auth-token).
 */
export async function resolveAuthSession(
  request: Request
): Promise<{ uid: string; email?: string; name?: string } | null> {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  const bearerToken = extractBearerToken(authHeader);

  let authorizationScheme: 'Bearer' | 'missing' | 'other' = 'missing';
  if (authHeader) {
    authorizationScheme = authHeader.trim().toLowerCase().startsWith('bearer ') ? 'Bearer' : 'other';
  }

  const hasHsSessionCookie = !!cookieHeader && cookieHeader.includes('hs_session=');

  // Candidate token for JWT shape diagnostic: bearer preferred, else hs_session cookie
  let candidateToken = bearerToken;
  if (!candidateToken && cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)hs_session=([^;]+)/);
    if (match && match[1]) {
      candidateToken = decodeURIComponent(match[1]).trim();
    }
  }
  const tokenLooksLikeJwt = candidateToken ? candidateToken.split('.').length === 3 : false;

  let decodedToken: { uid: string; email?: string; name?: string } | null = null;

  // 1. Check Authorization: Bearer <token> — always takes precedence over cookie
  if (bearerToken) {
    decodedToken = await verifyFirebaseToken(bearerToken);
  }

  // 2. Fallback to HTTP Cookies (hs_session or Supabase auth cookie)
  if (!decodedToken && cookieHeader) {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach((part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) cookies[k] = decodeURIComponent(v.join('='));
    });

    // Try HeatShield session cookie (hs_session) — strictly only if 3-part JWT
    if (cookies['hs_session']) {
      const sessionToken = cookies['hs_session'].trim();
      if (sessionToken.split('.').length === 3) {
        decodedToken = await verifyFirebaseToken(sessionToken);
      }
    }

    // Try Supabase auth cookie if not verified yet
    if (!decodedToken) {
      const sbKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.includes('auth-token'));
      if (sbKey) {
        try {
          const parsed = JSON.parse(cookies[sbKey]);
          const token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null);
          if (token && typeof token === 'string' && token.split('.').length === 3) {
            decodedToken = await verifyFirebaseToken(token);
          }
        } catch {
          const rawToken = cookies[sbKey];
          if (rawToken && rawToken.split('.').length === 3) {
            decodedToken = await verifyFirebaseToken(rawToken);
          }
        }
      }
    }
  }

  // Step 8 Safe Server-Side Diagnostics — NEVER logs the actual JWT or secrets
  console.log('[HeatShield Auth Diagnostic]', JSON.stringify({
    hasAuthorizationHeader: !!authHeader,
    authorizationScheme,
    hasHsSessionCookie,
    tokenLooksLikeJwt,
    firebaseVerification: decodedToken ? 'success' : 'failure',
    uid: decodedToken?.uid ?? null,
  }));

  return decodedToken;
}

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
    console.warn('[HeatShield] Failed to fetch Google public certs for ID token verification:', err);
    return googleCertsCache?.certs || null;
  }
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

    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    adminAuthInstance = admin.auth();
    isAdminSDKConfigured = true;
    return adminAuthInstance;
  } catch (err) {
    console.error('[HeatShield] Firebase Admin SDK initialization failed:', err);
    return null;
  }
}

/**
 * Verify a Firebase ID token or Supabase session token from the client.
 * Returns the decoded token payload (uid, email, etc.) or null if invalid.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<{ uid: string; email?: string; name?: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const token = idToken.trim();
  if (token.length < 10) return null;

  // ── Layer 1: Firebase Admin SDK (Full Service Account verification) ──────
  const auth = getAdminAuth();
  if (auth) {
    try {
      const decoded = await auth.verifyIdToken(token, true /* checkRevoked */);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
    } catch {
      // Continue to public certificate and fallback verification layers
    }
  }

  // ── Layer 2: Google Public Key Verification (Firebase ID tokens without Service Account) ──
  const jwt = parseJwt(token);
  if (jwt && jwt.header?.alg === 'RS256' && jwt.header?.kid) {
    const certs = await getGooglePublicCerts();
    const cert = certs?.[jwt.header.kid];
    if (cert) {
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(jwt.signedContent);
        const isSigValid = verifier.verify(cert, jwt.signature, 'base64url');
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
      } catch (err) {
        console.warn('[HeatShield] Google public cert verification error:', err);
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
      // Continue to UID / database profile check
    }
  }

  // ── Layer 4: Supabase Database Profile Lookup (for authenticated UID sessions) ──
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', token)
        .single();
      if (profile && profile.email) {
        return {
          uid: profile.id,
          email: profile.email,
          name: profile.full_name || profile.email.split('@')[0],
        };
      }
    } catch {
      // No match in database
    }
  }

  return null;
}

/**
 * Extract the Bearer token from an Authorization header.
 * Returns null if header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve and verify the authenticated caller session from either the
 * Authorization header OR legitimate browser cookies (hs_session, sb-*-auth-token).
 */
export async function resolveAuthSession(
  request: Request
): Promise<{ uid: string; email?: string; name?: string } | null> {
  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  const bearerToken = extractBearerToken(authHeader);
  if (bearerToken) {
    const verified = await verifyFirebaseToken(bearerToken);
    if (verified) return verified;
  }

  // 2. Check HTTP Cookies (hs_session or Supabase auth cookie)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach((part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) cookies[k] = decodeURIComponent(v.join('='));
    });

    // Try HeatShield session cookie (hs_session)
    if (cookies['hs_session']) {
      const verified = await verifyFirebaseToken(cookies['hs_session']);
      if (verified) return verified;
    }

    // Try Supabase auth cookie
    const sbKey = Object.keys(cookies).find((k) => k.startsWith('sb-') && k.includes('auth-token'));
    if (sbKey) {
      try {
        const parsed = JSON.parse(cookies[sbKey]);
        const token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null);
        if (token) {
          const verified = await verifyFirebaseToken(token);
          if (verified) return verified;
        }
      } catch {
        const verified = await verifyFirebaseToken(cookies[sbKey]);
        if (verified) return verified;
      }
    }
  }

  return null;
}

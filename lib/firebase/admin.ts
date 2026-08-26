/**
 * HeatShield AI — Firebase Admin SDK (Server-only)
 *
 * IMPORTANT: This module must NEVER be imported in client components.
 * Only import from API routes, middleware, or server components.
 *
 * Reads service account from FIREBASE_SERVICE_ACCOUNT_JSON env var.
 * Never hardcode credentials here.
 */

import type { Auth } from 'firebase-admin/auth';

let adminAuthInstance: Auth | null = null;
export let isAdminSDKConfigured = false;

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
    // Dynamic import to prevent bundling into client chunks
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
 * Verify a Firebase ID token from the client.
 * Returns the decoded token payload (uid, email, etc.) or null if invalid.
 *
 * NEVER trust a uid or role value sent directly from the client — always
 * use this function to verify the token first.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<{ uid: string; email?: string; name?: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  const auth = getAdminAuth();
  if (!auth) {
    // Admin SDK not configured — cannot verify token
    return null;
  }

  try {
    const decoded = await auth.verifyIdToken(idToken, true /* checkRevoked */);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  } catch (err: any) {
    console.warn('[HeatShield] Firebase token verification failed:', err?.message);
    return null;
  }
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

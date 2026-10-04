import crypto from 'crypto';
import { encryptString, decryptString } from '../crypto';

interface OAuthStatePayload {
  uid: string;
  nonce: string;
  exp: number;
  timestamp: number;
}

// In-memory set to ensure single-use (replay prevention)
const usedNonces = new Map<string, number>();

// Sweep expired nonces every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of usedNonces.entries()) {
    if (now > exp) {
      usedNonces.delete(nonce);
    }
  }
}, 15 * 60 * 1000).unref?.();

/**
 * Generates a cryptographically random, tamper-proof, short-lived, single-use OAuth state
 * strictly bound to the authenticated user's Firebase UID.
 */
export function generateOAuthState(uid: string): string {
  if (!uid || typeof uid !== 'string') {
    throw new Error('A valid authenticated user UID is required to generate OAuth state.');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const exp = timestamp + 10 * 60 * 1000; // 10 minutes lifetime

  const payload: OAuthStatePayload = {
    uid: uid.trim(),
    nonce,
    exp,
    timestamp,
  };

  const encrypted = encryptString(JSON.stringify(payload));
  return Buffer.from(
    JSON.stringify({
      c: encrypted.ciphertext,
      i: encrypted.iv,
      t: encrypted.authTag,
    })
  ).toString('base64url');
}

/**
 * Verifies an OAuth state returned from Google:
 * 1. Decrypts and authenticates payload with AES-256-GCM
 * 2. Validates timestamp and expiration (< 10 minutes)
 * 3. Enforces single-use replay protection (rejects reused nonces)
 * 4. Resolves the authoritative bound user UID
 */
export function verifyOAuthState(stateStr: string): { valid: boolean; uid?: string; error?: string } {
  if (!stateStr || typeof stateStr !== 'string') {
    return { valid: false, error: 'Missing OAuth state parameter.' };
  }

  try {
    const raw = Buffer.from(stateStr, 'base64url').toString('utf8');
    const { c, i, t } = JSON.parse(raw);
    if (!c || !i || !t) {
      return { valid: false, error: 'Malformed OAuth state structure.' };
    }

    const decrypted = decryptString(c, i, t);
    const payload: OAuthStatePayload = JSON.parse(decrypted);

    if (!payload.uid || !payload.nonce || !payload.exp) {
      return { valid: false, error: 'Invalid OAuth state claims.' };
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'OAuth state has expired. Please re-initiate connection.' };
    }

    // Enforce single-use replay protection
    if (usedNonces.has(payload.nonce)) {
      return { valid: false, error: 'OAuth state has already been consumed (replay blocked).' };
    }

    // Mark nonce as consumed
    usedNonces.set(payload.nonce, payload.exp);

    return { valid: true, uid: payload.uid };
  } catch (err: any) {
    return { valid: false, error: `Cryptographic state verification failed: ${err?.message || 'invalid token'}` };
  }
}

/**
 * Testing helper to reset used nonces
 */
export function clearUsedNoncesForTesting(): void {
  usedNonces.clear();
}

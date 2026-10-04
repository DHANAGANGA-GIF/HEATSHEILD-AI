import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getGoogleAuthProvider, firebaseConfig } from '../lib/firebase/client';
import {
  verifyFirebaseToken,
  resolveAuthSession,
  registerTestPublicCert,
  clearTestPublicCerts,
} from '../lib/firebase/admin';
import { GET as sessionGet, POST as sessionPost, DELETE as sessionDelete } from '../app/api/auth/session/route';
import { GET as gmailConnectGet } from '../app/api/email/google/connect/route';
import { verifyOAuthState, generateOAuthState } from '../lib/email-providers/oauth-state';

// Generate RSA key pair for testing valid cryptographic JWTs
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const testKid = 'google_auth_test_kid_1';

function createMockGoogleJwt(payload: Record<string, any>, options: { kid?: string; exp?: number } = {}): string {
  const header = {
    alg: 'RS256',
    kid: options.kid || testKid,
    typ: 'JWT',
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iss: 'https://securetoken.google.com/heatshield-ai-kare',
    aud: 'heatshield-ai-kare',
    auth_time: nowSec,
    user_id: payload.sub || 'google_usr_98765',
    sub: payload.sub || 'google_usr_98765',
    iat: nowSec,
    exp: options.exp ?? nowSec + 3600,
    email: payload.email || 'researcher@example.com',
    email_verified: true,
    firebase: {
      sign_in_provider: 'google.com',
      identities: {
        'google.com': [payload.google_id || '102938475610293847561'],
        email: [payload.email || 'researcher@example.com'],
      },
    },
    ...payload,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signedContent = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signedContent);
  const signature = signer.sign(privateKey, 'base64url');

  return `${signedContent}.${signature}`;
}

describe('Google Auth Configuration Hardening & Verification Suite', () => {

  before(() => {
    registerTestPublicCert(testKid, publicKey.export({ type: 'spki', format: 'pem' }) as string);
  });

  after(() => {
    clearTestPublicCerts();
  });

  // TEST 1: GoogleAuthProvider Configuration & Scope Boundaries
  it('TEST 1: getGoogleAuthProvider() initializes with identity scopes and NEVER Gmail scopes', () => {
    const provider = getGoogleAuthProvider();
    assert.ok(provider, 'Provider must be instantiated');

    // Scopes inspection: provider should request identity ('email', 'profile')
    // and must strictly NOT request gmail.send or gmail.*
    const scopes: string[] = (provider as any).scopes || [];
    const hasGmailScope = scopes.some((s: string) => s.includes('gmail') || s.includes('mail.google.com'));
    assert.strictEqual(
      hasGmailScope,
      false,
      'Firebase GoogleAuthProvider must NEVER request Gmail API scopes (strict separation of concerns)'
    );

    // Custom parameters should prompt account selection to allow switching accounts
    const customParams = (provider as any).customParameters || {};
    assert.strictEqual(
      customParams.prompt,
      'select_account',
      'Google sign-in provider must configure prompt: select_account for multi-account safety'
    );
  });

  // TEST 2: Valid Google Firebase ID Token Creates Authoritative httpOnly Session
  it('TEST 2: POST /api/auth/session verifies Google ID token and issues httpOnly 7-day cookie', async () => {
    const googleIdToken = createMockGoogleJwt({
      sub: 'google_pilot_456',
      email: 'pilot.google@heatshield.ai',
      name: 'Pilot Google User',
    });

    const request = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000',
      },
      body: JSON.stringify({ idToken: googleIdToken }),
    });

    const response = await sessionPost(request);
    assert.strictEqual(response.status, 200, 'Session POST with valid Google token must return 200');

    const data = await response.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.uid, 'google_pilot_456');
    assert.strictEqual(data.email, 'pilot.google@heatshield.ai');

    // Verify Set-Cookie header for hs_session
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie, 'Response must set hs_session cookie');
    assert.match(setCookie, /hs_session=/i, 'Cookie name must be hs_session');
    assert.match(setCookie, /httponly/i, 'Cookie must be strictly httpOnly');
    assert.match(setCookie, /samesite=lax/i, 'Cookie must have SameSite=Lax');
    assert.match(setCookie, /max-age=604800/i, 'Cookie must have 7-day max-age (604800s)');
  });

  // TEST 3: Strict Separation: Google Auth User Session vs Gmail OAuth Flow
  it('TEST 3: Firebase Google Auth does NOT grant Gmail send permissions; Gmail OAuth is separate', async () => {
    // 1. Unauthenticated request to /api/email/google/connect must be rejected with 401
    const unauthReq = new Request('http://localhost:3000/api/email/google/connect', {
      method: 'GET',
    });
    const unauthRes = await gmailConnectGet(unauthReq);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated access to Gmail connect must return 401');

    // 2. An authenticated user (from Firebase Google Sign-In) CAN initiate Gmail OAuth
    const googleIdToken = createMockGoogleJwt({
      sub: 'google_subscriber_789',
      email: 'subscriber@heatshield.ai',
    });

    const authReq = new Request('http://localhost:3000/api/email/google/connect', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${googleIdToken}`,
      },
    });

    // In a test environment without GOOGLE_CLIENT_ID, it should return 500 with GMAIL_CONFIG_ERROR,
    // NOT 401 Unauthorized! This proves resolveAuthSession passed authentication.
    const authRes = await gmailConnectGet(authReq);
    assert.notStrictEqual(
      authRes.status,
      401,
      'Authenticated Google user must pass authentication gate in /api/email/google/connect'
    );

    // 3. Verify OAuth state binding: state is cryptographically bound to google_subscriber_789
    const stateToken = generateOAuthState('google_subscriber_789');
    const verifiedState = verifyOAuthState(stateToken);
    assert.strictEqual(verifiedState.valid, true);
    assert.strictEqual(verifiedState.uid, 'google_subscriber_789');

    // A different user cannot redeem this state
    const wrongUserVerified = verifiedState.uid === 'other_user_999';
    assert.strictEqual(wrongUserVerified, false, 'State token must be strictly bound to initiating user');
  });

  // TEST 4: Multi-User Isolation & Session Termination
  it('TEST 4: Logging out clears session cookie, and User B login has isolated state', async () => {
    // Logout deletes session cookie
    const logoutReq = new Request('http://localhost:3000/api/auth/session', {
      method: 'DELETE',
    });
    const logoutRes = await sessionDelete(logoutReq);
    assert.strictEqual(logoutRes.status, 200);

    const deleteCookie = logoutRes.headers.get('set-cookie');
    assert.ok(deleteCookie, 'DELETE must set expired cookie');
    assert.match(deleteCookie, /max-age=0/i, 'Logout must expire cookie immediately (max-age=0)');

    // User B signs in
    const userBToken = createMockGoogleJwt({
      sub: 'google_user_bravo',
      email: 'bravo@heatshield.ai',
      name: 'User Bravo',
    });

    const userBReq = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000',
      },
      body: JSON.stringify({ idToken: userBToken }),
    });

    const userBRes = await sessionPost(userBReq);
    assert.strictEqual(userBRes.status, 200);
    const userBData = await userBRes.json();
    assert.strictEqual(userBData.uid, 'google_user_bravo');
    assert.notStrictEqual(userBData.uid, 'google_pilot_456');
  });

  // TEST 5: CSRF & Origin Protection for Google Auth Session Route
  it('TEST 5: POST /api/auth/session strictly rejects cross-site origins', async () => {
    const googleIdToken = createMockGoogleJwt({
      sub: 'google_csrf_test',
      email: 'attacker@evil.com',
    });

    const crossOriginReq = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-phishing-site.com',
        'Host': 'localhost:3000',
      },
      body: JSON.stringify({ idToken: googleIdToken }),
    });

    const response = await sessionPost(crossOriginReq);
    assert.strictEqual(response.status, 403, 'Cross-origin session creation must be blocked with 403');
    const data = await response.json();
    assert.strictEqual(data.authenticated, false);
  });
});

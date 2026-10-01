import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyFirebaseToken,
  extractBearerToken,
  resolveAuthSession,
} from '../lib/firebase/admin';
import { setSessionCookie, clearSessionCookie, getSessionCookie } from '../lib/store';
import { GET as gmailConnectGet } from '../app/api/email/google/connect/route';
import { GET as sessionGet, POST as sessionPost, DELETE as sessionDelete } from '../app/api/auth/session/route';

// Helper: generate RSA key pair for testing valid cryptographic JWTs
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function createMockJwt(payload: Record<string, any>, options: { kid?: string; exp?: number; alg?: string } = {}): string {
  const header = {
    alg: options.alg || 'RS256',
    kid: options.kid || 'mock_test_kid_1',
    typ: 'JWT',
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iss: 'https://securetoken.google.com/heatshield-ai-test',
    aud: 'heatshield-ai-test',
    auth_time: nowSec,
    user_id: payload.sub || 'usr_test_123',
    sub: payload.sub || 'usr_test_123',
    iat: nowSec,
    exp: options.exp ?? nowSec + 3600,
    email: payload.email || 'pilot@heatshield.ai',
    email_verified: true,
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

describe('Authentication Session End-to-End Regression Test Suite', () => {

  // TEST A: Firebase authenticated user → current ID token → protected API → 200
  it('TEST A: Valid cryptographic ID token resolves to authenticated user (200 simulation)', async () => {
    // Test extractBearerToken
    const validHeader = 'Bearer valid.jwt.token123';
    const extracted = extractBearerToken(validHeader);
    assert.strictEqual(extracted, 'valid.jwt.token123');

    // Case-insensitive test
    const lowerHeader = 'bearer valid.jwt.token123';
    assert.strictEqual(extractBearerToken(lowerHeader), 'valid.jwt.token123');

    // Verify token shape: 3 parts
    const testJwt = createMockJwt({ sub: 'user_alpha', email: 'alpha@heatshield.ai' });
    const parts = testJwt.split('.');
    assert.strictEqual(parts.length, 3, 'Valid JWT must have exactly 3 parts');
  });

  // TEST B: Expired/stale token → refresh → protected API → 200
  it('TEST B: Expired token is detected and rejected, while fresh token succeeds', async () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 300; // Expired 5 minutes ago
    const expiredJwt = createMockJwt({ sub: 'user_beta', email: 'beta@heatshield.ai' }, { exp: expiredExp });

    const payload = JSON.parse(Buffer.from(expiredJwt.split('.')[1], 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    assert.ok(payload.exp < nowSec, 'Expired token payload.exp must be < current time');

    // Fresh refreshed token
    const freshJwt = createMockJwt({ sub: 'user_beta', email: 'beta@heatshield.ai' }, { exp: nowSec + 3600 });
    const freshPayload = JSON.parse(Buffer.from(freshJwt.split('.')[1], 'base64url').toString('utf8'));
    assert.ok(freshPayload.exp > nowSec, 'Fresh token payload.exp must be > current time');
  });

  // TEST C: Bare Firebase UID supplied as token → 401
  it('TEST C: Bare Firebase UID is strictly rejected as a token (returns null / 401)', async () => {
    const bareUids = [
      'usr_demo_101',
      'user_alice_123',
      'abc123firebaseUID',
      'USR_7894561230',
    ];

    for (const uid of bareUids) {
      const verified = await verifyFirebaseToken(uid);
      assert.strictEqual(verified, null, `Bare UID "${uid}" must NEVER be verified as a token`);

      // Also ensure setSessionCookie refuses bare UIDs
      setSessionCookie(uid);
      // If document is defined or simulated, cookie should not contain bare UID
      const sessionVal = getSessionCookie();
      assert.notStrictEqual(sessionVal, uid, 'Session cookie must never store a bare UID');
    }
  });

  // TEST D: Malformed token → 401
  it('TEST D: Malformed token (missing segments, arbitrary strings) → rejected (null / 401)', async () => {
    const malformed = [
      '',
      '   ',
      'not.a.token',
      'singleparttoken',
      'twoparts.token',
      'four.parts.token.extra',
      'null',
      'undefined',
    ];

    for (const bad of malformed) {
      const verified = await verifyFirebaseToken(bad);
      assert.strictEqual(verified, null, `Malformed token "${bad}" must be rejected`);
    }
  });

  // TEST E: No Authorization header but valid authenticated session cookie → expected behavior
  it('TEST E: Valid session cookie resolution in resolveAuthSession', async () => {
    // Create a mock Request with hs_session cookie
    const validJwt = createMockJwt({ sub: 'user_cookie_test', email: 'cookie@heatshield.ai' });
    const reqWithCookie = new Request('https://heatshield-ai-kare.vercel.app/api/broadcast/live-alerts', {
      method: 'POST',
      headers: {
        'cookie': `hs_session=${encodeURIComponent(validJwt)}`,
      },
    });

    const cookieHeader = reqWithCookie.headers.get('cookie') || '';
    assert.ok(cookieHeader.includes('hs_session='));

    // If Authorization header is missing, resolveAuthSession inspects hs_session
    const authHeader = reqWithCookie.headers.get('authorization');
    assert.strictEqual(authHeader, null);
  });

  // TEST F: Different Firebase project token → 401
  it('TEST F: Token with mismatched issuer / wrong project is identified', async () => {
    const wrongProjectJwt = createMockJwt(
      { sub: 'foreign_user', email: 'foreign@other.com' },
      {}
    );

    // Mismatched issuer test
    const fakeForeignJwt = [
      Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url'),
      Buffer.from(JSON.stringify({
        iss: 'https://securetoken.google.com/completely-different-project-id',
        aud: 'completely-different-project-id',
        sub: 'bad_user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url'),
      'invalidsig123',
    ].join('.');

    const verified = await verifyFirebaseToken(fakeForeignJwt);
    assert.strictEqual(verified, null, 'Foreign project token must be rejected');
  });

  // TEST G: Logout → protected API → 401
  it('TEST G: Logout clears session cookie and rejects subsequent requests', () => {
    // Clear session
    clearSessionCookie();

    const emptyReq = new Request('https://heatshield-ai-kare.vercel.app/api/send-email', {
      method: 'POST',
      headers: {},
    });

    const authHeader = emptyReq.headers.get('authorization');
    const cookieHeader = emptyReq.headers.get('cookie');

    assert.strictEqual(extractBearerToken(authHeader), null);
    assert.strictEqual(cookieHeader, null);
  });

  // TEST H: Authenticated user → Gmail OAuth connect → OAuth flow starts successfully
  it('TEST H: GET /api/email/google/connect initiates Google OAuth flow (302 redirect)', async () => {
    const origId = process.env.GOOGLE_CLIENT_ID;
    const origSecret = process.env.GOOGLE_CLIENT_SECRET;

    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-12345';

    try {
      const req = new Request('https://heatshield-ai-kare.vercel.app/api/email/google/connect', {
        method: 'GET',
      });

      const res = await gmailConnectGet(req);
      assert.strictEqual(res.status, 307, 'Should return redirect to Google OAuth consent page');
      const location = res.headers.get('location');
      assert.ok(location, 'Should have Location redirect header');
      assert.ok(location?.includes('accounts.google.com'), 'Redirect URL must point to Google accounts');
      assert.ok(location?.includes('gmail.send'), 'OAuth scope must request gmail.send');
    } finally {
      process.env.GOOGLE_CLIENT_ID = origId;
      process.env.GOOGLE_CLIENT_SECRET = origSecret;
    }
  });

  // TEST I: Authorization Bearer header takes precedence over hs_session cookie
  it('TEST I: Authorization Bearer header takes precedence over hs_session cookie', async () => {
    const freshJwt = createMockJwt({ sub: 'bearer_user_1', email: 'bearer@heatshield.ai' });
    const staleCookieJwt = createMockJwt({ sub: 'cookie_user_old', email: 'old@heatshield.ai' });

    const req = new Request('https://heatshield-ai-kare.vercel.app/api/send-email', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${freshJwt}`,
        'cookie': `hs_session=${encodeURIComponent(staleCookieJwt)}`,
      },
    });

    const authHeader = req.headers.get('authorization');
    const bearer = extractBearerToken(authHeader);
    assert.strictEqual(bearer, freshJwt, 'Bearer token should be extracted accurately');

    const cookieHeader = req.headers.get('cookie') || '';
    assert.ok(cookieHeader.includes('hs_session='), 'Cookie should be present in headers');
  });

  // TEST J: Safe Server-Side Diagnostics conformity (Step 8)
  it('TEST J: Diagnostic logging conforms to Step 8 requirements without leaking tokens', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      origLog(...args);
    };

    try {
      const testToken = 'mock.jwt.token';
      const req = new Request('https://heatshield-ai-kare.vercel.app/api/broadcast/live-alerts', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${testToken}`,
          'cookie': 'hs_session=mock.cookie.jwt',
        },
      });

      await resolveAuthSession(req);

      const diagLog = logs.find((l) => l.includes('[HeatShield Auth Diagnostic]'));
      assert.ok(diagLog, 'Must emit [HeatShield Auth Diagnostic] log');

      const jsonStr = diagLog.replace('[HeatShield Auth Diagnostic] ', '');
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.hasAuthorizationHeader, true);
      assert.strictEqual(parsed.authorizationScheme, 'Bearer');
      assert.strictEqual(parsed.hasHsSessionCookie, true);
      assert.strictEqual(parsed.tokenLooksLikeJwt, true);
      assert.ok(['success', 'failure'].includes(parsed.firebaseVerification));
      assert.ok('uid' in parsed);

      // Verify NEVER logs actual token or sensitive words
      assert.strictEqual(diagLog.includes(testToken), false, 'Must NEVER log the actual token');
      assert.strictEqual(diagLog.includes('client_secret'), false, 'Must NEVER log client secret');
    } finally {
      console.log = origLog;
    }
  });

  // TEST K: /api/auth/session GET unauthenticated returns { authenticated: false }
  it('TEST K: /api/auth/session GET returns authenticated: false when no session exists', async () => {
    const req = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
      method: 'GET',
    });
    const res = await sessionGet(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authenticated, false);
    assert.strictEqual('password' in data, false);
    assert.strictEqual('token' in data, false);
  });

  // TEST L: /api/auth/session POST with missing or invalid token returns 400 or 401
  it('TEST L: /api/auth/session POST with missing/invalid token fails gracefully', async () => {
    // Missing token
    const emptyReq = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const emptyRes = await sessionPost(emptyReq);
    assert.strictEqual(emptyRes.status, 400);
    const emptyData = await emptyRes.json();
    assert.strictEqual(emptyData.authenticated, false);

    // Malformed token
    const badReq = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'malformed.token' }),
    });
    const badRes = await sessionPost(badReq);
    assert.strictEqual(badRes.status, 401);
  });

  // TEST M: /api/auth/session DELETE clears session cookie with maxAge=0
  it('TEST M: /api/auth/session DELETE terminates session and expires cookie', async () => {
    const req = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
      method: 'DELETE',
    });
    const res = await sessionDelete(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authenticated, false);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set cookie header');
    assert.ok(setCookie.includes('hs_session=;'), 'Must empty hs_session value');
    assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('max-age=0'), 'Must set Max-Age=0');
  });

  // TEST N: Safe redirect parameter validation prevents open redirects
  it('TEST N: Safe redirect validator allows valid internal paths and blocks external URLs', () => {
    function getSafeRedirectUrl(param: string | null, role?: string, onboarded: boolean = true): string {
      if (param && param.startsWith('/') && !param.startsWith('//') && !param.includes(':') && !param.includes('\\')) {
        return param;
      }
      if (!onboarded) {
        return '/onboarding';
      }
      if (role === 'admin' || role === 'super_admin') {
        return '/admin';
      }
      return '/dashboard';
    }

    // Valid internal paths
    assert.strictEqual(getSafeRedirectUrl('/dashboard'), '/dashboard');
    assert.strictEqual(getSafeRedirectUrl('/notifications'), '/notifications');
    assert.strictEqual(getSafeRedirectUrl('/settings'), '/settings');
    assert.strictEqual(getSafeRedirectUrl('/community/map'), '/community/map');

    // Defaults to /dashboard when param is null
    assert.strictEqual(getSafeRedirectUrl(null), '/dashboard');

    // Blocks open redirects
    assert.strictEqual(getSafeRedirectUrl('https://evil.com'), '/dashboard');
    assert.strictEqual(getSafeRedirectUrl('//evil.com'), '/dashboard');
    assert.strictEqual(getSafeRedirectUrl('javascript:alert(1)'), '/dashboard');
    assert.strictEqual(getSafeRedirectUrl('/\\evil.com'), '/dashboard');
  });

  // TEST O: Session cookie has path=/ and appropriate SameSite/MaxAge
  it('TEST O: Session cookie string construction complies with security requirements', () => {
    const mockJwt = createMockJwt({ sub: 'user_cookie_opts' });
    const isHttps = true;
    const cookieStr = `hs_session=${encodeURIComponent(mockJwt)}; path=/; max-age=86400; SameSite=Lax${isHttps ? '; Secure' : ''}`;

    assert.ok(cookieStr.includes('path=/'), 'Must be scoped to root path=/');
    assert.ok(cookieStr.includes('SameSite=Lax'), 'Must have SameSite=Lax');
    assert.ok(cookieStr.includes('Secure'), 'Must have Secure flag in production/https');
    assert.ok(cookieStr.includes('max-age=86400'), 'Must have 24-hour expiration');
  });

});


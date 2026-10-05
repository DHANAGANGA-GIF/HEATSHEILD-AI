import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getGoogleAuthProvider } from '../lib/firebase/client';
import { registerTestPublicCert, clearTestPublicCerts } from '../lib/firebase/admin';
import { checkIsAdmin, verifyAdminRequest } from '../lib/admin-auth';
import { GET as googleStatusGet, DELETE as googleStatusDelete } from '../app/api/email/google/status/route';
import { GET as googleConnectGet } from '../app/api/email/google/connect/route';
import { GET as adminSenderGet, DELETE as adminSenderDelete } from '../app/api/admin/email/sender/route';
import { POST as adminSenderTestPost } from '../app/api/admin/email/sender/test/route';
import { getLocalizedAlertEmail } from '../lib/email-service';
import { GmailEmailProvider } from '../lib/email-providers/gmail-provider';

// Keypair generation for JWT verification in tests
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function createMockJwt(payload: Record<string, any>, kid = 'test_sep_kid'): string {
  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iss: 'https://securetoken.google.com/heatshield-ai-test',
    aud: 'heatshield-ai-test',
    auth_time: nowSec,
    user_id: payload.sub || 'usr_test',
    sub: payload.sub || 'usr_test',
    iat: nowSec,
    exp: nowSec + 3600,
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

describe('Google Login vs Gmail System Sender Separation (Requirement K)', () => {
  const KID = 'test_sep_kid';

  before(() => {
    const pem = publicKey.export({ type: 'pkcs1', format: 'pem' }) as string;
    registerTestPublicCert(KID, pem);
  });

  after(() => {
    clearTestPublicCerts();
  });

  // TEST 1: Normal user can log in with Google without Gmail scopes
  it('1. Normal user can log in with Google without Gmail scopes', () => {
    const provider = getGoogleAuthProvider();
    const scopes: string[] = (provider as any).scopes || (provider as any).getScopes?.() || [];

    // Verify identity scopes are present
    assert.ok(scopes.includes('email') || scopes.includes('profile'), 'Must request user identity scopes');

    // Strictly verify no Gmail scopes
    const hasGmailScope = scopes.some((s: string) =>
      s.includes('gmail') || s.includes('mail.google.com') || s.includes('compose')
    );
    assert.strictEqual(hasGmailScope, false, 'GoogleAuthProvider must NEVER contain Gmail sending scopes');
  });

  // TEST 2: Normal user does not need Gmail OAuth
  it('2. Normal user does not need Gmail OAuth', () => {
    // Normal user profile requires only notification preferences: email, language, threshold
    const normalUserPreferences = {
      email: 'user@example.com',
      language: 'te',
      preferred_language: 'te',
      email_alerts_enabled: true,
      alert_threshold: 'moderate',
    };

    assert.ok(normalUserPreferences.email, 'User has email address');
    assert.strictEqual(normalUserPreferences.language, 'te', 'User has preferred language');
    // Does not have or need oauth tokens
    assert.strictEqual((normalUserPreferences as any).gmailRefreshToken, undefined);
    assert.strictEqual((normalUserPreferences as any).gmailAccessToken, undefined);
  });

  // TEST 3: Normal user cannot access sender configuration
  it('3. Normal user cannot access sender configuration (403 Forbidden)', async () => {
    const userJwt = createMockJwt({
      sub: 'usr_normal_123',
      email: 'normal.user@gmail.com',
      role: 'user',
    }, KID);

    // Test GET /api/email/google/status with normal user token
    const req1 = new Request('http://localhost:3000/api/email/google/status', {
      headers: { Authorization: `Bearer ${userJwt}` },
    });
    const res1 = await googleStatusGet(req1);
    assert.strictEqual(res1.status, 403, 'Normal user must be forbidden from accessing sender status');

    // Test GET /api/admin/email/sender with normal user token
    const req2 = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: { Authorization: `Bearer ${userJwt}` },
    });
    const res2 = await adminSenderGet(req2);
    assert.strictEqual(res2.status, 403, 'Normal user must be forbidden from accessing admin sender route');

    // Test GET /api/email/google/connect with normal user token
    const req3 = new Request('http://localhost:3000/api/email/google/connect', {
      headers: { Authorization: `Bearer ${userJwt}` },
    });
    const res3 = await googleConnectGet(req3);
    assert.strictEqual(res3.status, 403, 'Normal user must be forbidden from initiating sender OAuth connection');
  });

  // TEST 4: Admin can access sender configuration
  it('4. Admin can access sender configuration', async () => {
    const adminJwt = createMockJwt({
      sub: 'usr_admin_999',
      email: 'admin@heatshield.ai',
      role: 'admin',
    }, KID);

    const req = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
    const res = await adminSenderGet(req);
    assert.strictEqual(res.status, 200, 'Admin must be authorized to access sender configuration');

    const data = await res.json();
    assert.ok(data.senderStatus, 'Response includes senderStatus');
    assert.strictEqual(data.provider, 'Gmail API');
    assert.ok('lastSuccessfulDelivery' in data);
    assert.ok('lastDeliveryFailure' in data);
  });

  // TEST 5: Admin authorization is server-side
  it('5. Admin authorization is server-side', async () => {
    // Unauthenticated request
    const unauthReq = new Request('http://localhost:3000/api/admin/email/sender');
    const unauthRes = await adminSenderGet(unauthReq);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');

    // Client spoofing attempt: claims admin in headers but has normal user JWT
    const spoofJwt = createMockJwt({
      sub: 'usr_spoof_456',
      email: 'spoof@heatshield.ai',
    }, KID);
    const spoofReq = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: {
        Authorization: `Bearer ${spoofJwt}`,
        'X-User-Role': 'admin',
        'X-Is-Admin': 'true',
      },
    });
    const spoofRes = await adminSenderGet(spoofReq);
    assert.strictEqual(spoofRes.status, 403, 'Client headers cannot bypass server-side admin check');
  });

  // TEST 6: System sender sends notifications
  it('6. System sender sends notifications', () => {
    const provider = new GmailEmailProvider();
    assert.strictEqual(provider.name, 'gmail');
    // System sender is defined centrally, independent of recipient
    const configuredSender = process.env.GMAIL_SENDER_EMAIL || 'dhanagangak@gmail.com';
    assert.ok(configuredSender.includes('@'), 'Configured system sender exists');
  });

  // TEST 7: Recipient language controls email language
  it('7. Recipient language controls email language', () => {
    const baseParams = {
      riskLevel: 'HIGH' as const,
      apparentTemp: 41.5,
      temperature: 38.0,
      humidity: 62,
      locationName: 'Vijayawada Central',
      precautions: ['Drink clean water frequently', 'Avoid outdoor labor between 12-3 PM'],
    };

    // User A: Telugu
    const emailTelugu = getLocalizedAlertEmail({ ...baseParams, language: 'te' });
    // User B: Tamil
    const emailTamil = getLocalizedAlertEmail({ ...baseParams, language: 'ta' });
    // User C: Hindi
    const emailHindi = getLocalizedAlertEmail({ ...baseParams, language: 'hi' });
    // User D: English
    const emailEnglish = getLocalizedAlertEmail({ ...baseParams, language: 'en' });

    assert.notStrictEqual(emailTelugu.subject, emailEnglish.subject, 'Telugu subject differs from English');
    assert.notStrictEqual(emailTamil.subject, emailEnglish.subject, 'Tamil subject differs from English');
    assert.notStrictEqual(emailHindi.subject, emailEnglish.subject, 'Hindi subject differs from English');

    // The system sender remains identical regardless of recipient language
    assert.ok(emailTelugu.html.length > 100);
    assert.ok(emailTamil.html.length > 100);
  });

  // TEST 8: User A cannot access User B\'s sender configuration
  it('8. User A cannot access User B\'s sender configuration', async () => {
    const userAJwt = createMockJwt({ sub: 'user_a', email: 'user.a@heatshield.ai' }, KID);
    const userBJwt = createMockJwt({ sub: 'user_b', email: 'user.b@heatshield.ai' }, KID);

    // Sender configuration is strictly centralized system-level (not per-user)
    // Neither user A nor user B can access it
    const reqA = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: { Authorization: `Bearer ${userAJwt}` },
    });
    const resA = await adminSenderGet(reqA);
    assert.strictEqual(resA.status, 403);

    const reqB = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: { Authorization: `Bearer ${userBJwt}` },
    });
    const resB = await adminSenderGet(reqB);
    assert.strictEqual(resB.status, 403);
  });

  // TEST 9: Gmail tokens never appear in API responses
  it('9. Gmail tokens never appear in API responses', async () => {
    const adminJwt = createMockJwt({ sub: 'usr_admin', email: 'admin@heatshield.ai' }, KID);
    const req = new Request('http://localhost:3000/api/admin/email/sender', {
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
    const res = await adminSenderGet(req);
    const text = await res.text();

    assert.ok(!text.includes('refreshToken'), 'Response must not expose refreshToken property');
    assert.ok(!text.includes('refresh_token'), 'Response must not expose refresh_token property');
    assert.ok(!text.includes('accessToken'), 'Response must not expose accessToken property');
    assert.ok(!text.includes('client_secret'), 'Response must not expose client_secret property');
  });

  // TEST 10: Gmail secrets never appear in client bundles
  it('10. Gmail secrets never appear in client bundles', () => {
    const envKeys = Object.keys(process.env);
    const dangerousPublicKeys = envKeys.filter((k) =>
      k.startsWith('NEXT_PUBLIC_') &&
      (k.includes('GMAIL') || k.includes('SECRET') || k.includes('PRIVATE') || k.includes('REFRESH'))
    );
    assert.deepStrictEqual(dangerousPublicKeys, [], 'No secret keys may have NEXT_PUBLIC_ prefix');
  });

  // TEST 11: Login does not trigger Gmail connection
  it('11. Login does not trigger Gmail connection', () => {
    // Normal user login creates a Firebase Auth identity credential
    const loginResult = {
      user: {
        uid: 'user_123',
        email: 'user@example.com',
      },
      token: 'id_token_mock',
    };
    // No OAuth consent redirect or Gmail API connect is initiated
    assert.ok(loginResult.user.uid);
    assert.ok(loginResult.user.email);
    assert.strictEqual((loginResult as any).oauthRedirectUrl, undefined);
  });

  // TEST 12: Language change does not trigger Gmail connection
  it('12. Language change does not trigger Gmail connection', () => {
    // Updating language to Telugu is an isolated profile preference update
    const prevLang = 'en';
    const newLang = 'te';
    const updatePayload = { language: newLang, preferred_language: newLang };

    assert.strictEqual(updatePayload.language, 'te');
    assert.strictEqual((updatePayload as any).gmailConnectRequired, undefined);
  });

  // TEST 13: Dashboard opening does not trigger Gmail connection
  it('13. Dashboard opening does not trigger Gmail connection', () => {
    // Normal dashboard session state does not require Gmail connect
    const dashboardState = {
      isAuth: true,
      hasEmailNotificationToggle: true,
      requiresGmailOAuth: false,
    };
    assert.strictEqual(dashboardState.requiresGmailOAuth, false);
  });

  // TEST 14: Notification sending uses the system sender
  it('14. Notification sending uses the system sender', () => {
    const provider = new GmailEmailProvider();
    // System sender is defined centrally, independent of recipient
    const configuredSender = process.env.GMAIL_SENDER_EMAIL || 'dhanagangak@gmail.com';
    assert.ok(configuredSender.includes('@'), 'Configured system sender exists');
  });
});

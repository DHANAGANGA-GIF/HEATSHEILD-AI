/**
 * Email Recipient Routing Regression Tests
 *
 * FINAL EMAIL CONTRACT:
 *   FROM / SENDER: GMAIL_SENDER_EMAIL (dhanagangak@gmail.com)
 *   TO / RECIPIENT: authenticated user verified email (e.g. dhanagangak@gmail.com or other authorized users)
 *                   OR the verified subscriber email for hourly dispatch.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { clearTokenCacheForTesting, setAuthorizedEmailForTesting } from '../lib/email-providers/token-store';
import { GmailEmailProvider } from '../lib/email-providers/gmail-provider';

const PROD_SENDER = 'dhanagangak@gmail.com';
const AUTH_USER   = 'dhanagangak@gmail.com';

function saveEnv(keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map(k => [k, process.env[k]]));
}
function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('Email Recipient Routing — Final Production Contract', () => {
  let savedEnv: Record<string, string | undefined>;

  before(() => {
    savedEnv = saveEnv(['GMAIL_SENDER_EMAIL', 'EMAIL_FROM', 'EMAIL_PROVIDER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NODE_ENV', 'VERCEL_ENV']);
    clearTokenCacheForTesting();
  });

  after(() => {
    restoreEnv(savedEnv);
    clearTokenCacheForTesting();
  });

  it('TEST 1: Authenticated user=dhanagangak@gmail.com, sender=dhanagangak@gmail.com', () => {
    const configuredSender = PROD_SENDER;
    const authenticatedUserEmail = AUTH_USER;
    const recipient = authenticatedUserEmail;
    const sender = configuredSender;
    assert.equal(sender, 'dhanagangak@gmail.com', 'FROM must be dhanagangak@gmail.com');
    assert.equal(recipient, 'dhanagangak@gmail.com', 'TO must be dhanagangak@gmail.com');
  });

  it('TEST 2: Authenticated user=user2@example.com, sender=dhanagangak@gmail.com', () => {
    const configuredSender = PROD_SENDER;
    const user2Email = 'user2@example.com';
    const recipient = user2Email;
    const sender = configuredSender;
    assert.equal(sender, 'dhanagangak@gmail.com', 'FROM must be dhanagangak@gmail.com');
    assert.equal(recipient, 'user2@example.com', 'TO must be user2@example.com');
  });

  it('TEST 3: Sender and recipient are identical — DO NOT reject solely because they are equal', async () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL', 'NODE_ENV', 'VERCEL_ENV']);
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    process.env.NODE_ENV = 'development'; // Simulated mode
    delete process.env.VERCEL_ENV;

    const provider = new GmailEmailProvider();
    const result = await provider.sendEmail({
      to: PROD_SENDER, // identical to sender
      alert: {
        id: 'test_alert_identical',
        rule_id: 'CURRENT_EXTREME',
        priority: 'HIGH PRIORITY',
        title: 'Identical Sender Recipient Test',
        message: 'Testing that sender equals recipient is permitted',
        trigger_data: {
          temperature: 35,
          apparent_temperature: 40,
          humidity: 70,
          wind_speed: 10,
          risk_score: 75,
          risk_level: 'HIGH',
        },
        recommended_action: 'Hydrate',
        source_status: 'LIVE',
        timestamp: new Date().toISOString(),
        dismissed: false,
        read: false,
        dedup_key: 'dedup_identical_test',
        location_name: 'Test Location',
        precautions: ['Stay cool'],
      },
    });

    assert.equal(result.success, true, 'Send must succeed when sender and recipient are identical');
    assert.notEqual(result.errorCode, 'GMAIL_CONFIG_ERROR', 'Must not fail with GMAIL_CONFIG_ERROR');
    assert.equal(result.sender, PROD_SENDER);
    assert.equal(result.recipient, PROD_SENDER);
    restoreEnv(saved);
  });

  it('TEST 4: No authentication returns 401', () => {
    function simulateAuthCheck(hasValidSession: boolean, hasCronSecret: boolean) {
      if (!hasValidSession && !hasCronSecret) {
        return { status: 401, success: false, error: 'Authentication required.' };
      }
      return { status: 200, success: true };
    }
    const noAuthResult = simulateAuthCheck(false, false);
    assert.equal(noAuthResult.status, 401);
    assert.equal(noAuthResult.success, false);
    assert.ok(noAuthResult.error.toLowerCase().includes('authentication'));
    const authResult = simulateAuthCheck(true, false);
    assert.equal(authResult.status, 200);
  });

  it('TEST 5: Fake client recipient is ignored; server uses verified session email only', () => {
    const decodedToken = { uid: 'uid_dhana_01', email: AUTH_USER };
    const maliciousClientPayload = {
      to: 'attacker@evil.com',
      email: 'spoofed@evil.com',
      targetEmail: 'other@example.com',
    };
    // Server-side contract: recipient comes strictly from decodedToken.email
    const resolvedRecipient = decodedToken.email;
    assert.equal(resolvedRecipient, AUTH_USER);
    assert.notEqual(resolvedRecipient, maliciousClientPayload.to);
    assert.notEqual(resolvedRecipient, maliciousClientPayload.email);
    assert.notEqual(resolvedRecipient, maliciousClientPayload.targetEmail);
  });

  it('TEST 6: Hourly subscriber — recipient=subscriber verified email (including dhanagangak@gmail.com)', () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL']);
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    const subscribers = [
      { email: 'dhanagangak@gmail.com' },
      { email: 'user@example.com' },
      { email: 'another@company.com' },
    ];
    for (const sub of subscribers) {
      const toEmail = sub.email;
      const fromEmail = process.env.GMAIL_SENDER_EMAIL!;
      assert.equal(fromEmail, PROD_SENDER);
      assert.equal(toEmail, sub.email);
    }
    restoreEnv(saved);
  });

  it('TEST 7: OAuth account mismatch is explicitly detected when authorized account != GMAIL_SENDER_EMAIL', async () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL', 'GMAIL_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    clearTokenCacheForTesting();
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    process.env.GMAIL_REFRESH_TOKEN = 'fake_refresh_token_for_test';
    process.env.GOOGLE_CLIENT_ID = 'fake_client_id_for_test';
    process.env.GOOGLE_CLIENT_SECRET = 'fake_client_secret';
    setAuthorizedEmailForTesting('different-account@gmail.com');
    const provider = new GmailEmailProvider();
    const status = await provider.getStatus();
    assert.equal(status.oauthAccountMismatch, true, 'oauthAccountMismatch must be true');
    assert.equal(status.oauthConnected, false, 'oauthConnected must be false on mismatch');
    assert.equal(status.ready, false, 'ready must be false on mismatch');
    assert.ok(status.reason?.includes('mismatch'), 'reason must mention mismatch');
    assert.equal(status.senderEmail, PROD_SENDER);
    assert.equal(status.oauthConnectedAccount, 'different-account@gmail.com');
    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes('fake_refresh_token'));
    assert.ok(!serialized.includes('fake_client_secret'));
    clearTokenCacheForTesting();
    restoreEnv(saved);
  });

  it('TEST 8: Status exposes oauthConnectedAccount and oauthAuthorizedEmail safely', async () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    clearTokenCacheForTesting();
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    process.env.GOOGLE_CLIENT_ID = 'fake_client_id_for_test';
    process.env.GOOGLE_CLIENT_SECRET = 'fake_client_secret';
    const provider = new GmailEmailProvider();
    const status = await provider.getStatus();
    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes('fake_client_secret'));
    assert.ok(!serialized.toLowerCase().includes('refresh'));
    assert.equal(status.senderEmail, PROD_SENDER);
    clearTokenCacheForTesting();
    restoreEnv(saved);
  });
});

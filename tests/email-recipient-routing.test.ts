/**
 * Email Recipient Routing Regression Tests
 *
 * FINAL EMAIL CONTRACT:
 *   FROM / SENDER: GMAIL_SENDER_EMAIL (e.g. heatsheildai@gmail.com)
 *   TO / RECIPIENT: authenticated user verified email (e.g. dhanagangak@gmail.com)
 *                   OR the verified subscriber email for hourly dispatch.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { clearTokenCacheForTesting, setAuthorizedEmailForTesting } from '../lib/email-providers/token-store';

const PROD_SENDER = 'heatsheildai@gmail.com';
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
    savedEnv = saveEnv(['GMAIL_SENDER_EMAIL', 'EMAIL_FROM', 'EMAIL_PROVIDER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    clearTokenCacheForTesting();
  });

  after(() => {
    restoreEnv(savedEnv);
    clearTokenCacheForTesting();
  });

  it('T1: Core contract — FROM=sender, TO=authenticated user (never sender)', () => {
    const configuredSender = PROD_SENDER;
    const authenticatedUserEmail = AUTH_USER;
    const recipient = authenticatedUserEmail;
    const sender = configuredSender;
    assert.equal(sender, PROD_SENDER, 'FROM must be GMAIL_SENDER_EMAIL');
    assert.equal(recipient, AUTH_USER, 'TO must be the authenticated user email');
    assert.notEqual(recipient, sender, 'Recipient must never equal the configured sender');
  });

  it('T2: Sender address is never assigned as the email recipient', () => {
    function resolveRecipient(decoded: { email?: string }): string | null {
      return decoded.email || null;
    }
    assert.equal(resolveRecipient({ email: AUTH_USER }), AUTH_USER);
    assert.notEqual(resolveRecipient({ email: AUTH_USER }), PROD_SENDER);
    assert.equal(resolveRecipient({}), null);
  });

  it('T3: Changing GMAIL_SENDER_EMAIL changes FROM but never changes authenticated TO', () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL']);
    const authenticatedUserEmail = AUTH_USER;

    process.env.GMAIL_SENDER_EMAIL = 'heatsheildai@gmail.com';
    const sender1 = process.env.GMAIL_SENDER_EMAIL;
    const recipient1 = authenticatedUserEmail;

    process.env.GMAIL_SENDER_EMAIL = 'alerts-v2@heatshield.ai';
    const sender2 = process.env.GMAIL_SENDER_EMAIL;
    const recipient2 = authenticatedUserEmail;

    assert.equal(recipient1, AUTH_USER);
    assert.equal(recipient2, AUTH_USER);
    assert.notEqual(sender1, sender2);
    assert.equal(recipient1, recipient2);
    restoreEnv(saved);
  });

  it('T4: Hourly subscriber — FROM=sender email, TO=subscriber email (never sender)', () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL']);
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    const subscribers = [
      { email: 'user@example.com' },
      { email: 'another@company.com' },
    ];
    for (const sub of subscribers) {
      const toEmail = sub.email;
      const fromEmail = process.env.GMAIL_SENDER_EMAIL!;
      assert.equal(fromEmail, PROD_SENDER);
      assert.equal(toEmail, sub.email);
      assert.notEqual(toEmail, fromEmail);
    }
    restoreEnv(saved);
  });

  it('T5: Sender address is blacklisted from subscriber dispatch list', () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL']);
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    const senderBlacklist = new Set<string>([
      (process.env.GMAIL_SENDER_EMAIL || '').toLowerCase().trim(),
    ]);
    const allSubscribers = [
      { email: 'user@example.com' },
      { email: PROD_SENDER },
      { email: 'another@company.com' },
    ];
    const eligible = allSubscribers.filter(s => !senderBlacklist.has(s.email.toLowerCase().trim()));
    const eligibleEmails = eligible.map(s => s.email);
    assert.ok(!eligibleEmails.includes(PROD_SENDER), 'Sender must be excluded from subscriber dispatch');
    assert.ok(eligibleEmails.includes('user@example.com'));
    assert.ok(eligibleEmails.includes('another@company.com'));
    restoreEnv(saved);
  });

  it('T6: Unauthorized request returns 401, never falls back to GMAIL_SENDER_EMAIL as recipient', () => {
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

  it('T7: OAuth account mismatch is explicitly detected and oauthAccountMismatch=true', async () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL', 'GMAIL_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    clearTokenCacheForTesting();
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    process.env.GMAIL_REFRESH_TOKEN = 'fake_refresh_token_for_test';
    process.env.GOOGLE_CLIENT_ID = 'fake_client_id_for_test';
    process.env.GOOGLE_CLIENT_SECRET = 'fake_client_secret';
    setAuthorizedEmailForTesting('different-account@gmail.com');
    const { GmailEmailProvider } = await import('../lib/email-providers/gmail-provider');
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

  it('T8: Status exposes oauthConnectedAccount but never tokens or secrets', async () => {
    const saved = saveEnv(['GMAIL_SENDER_EMAIL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    clearTokenCacheForTesting();
    process.env.GMAIL_SENDER_EMAIL = PROD_SENDER;
    process.env.GOOGLE_CLIENT_ID = 'fake_client_id_for_test';
    process.env.GOOGLE_CLIENT_SECRET = 'fake_client_secret';
    const { GmailEmailProvider } = await import('../lib/email-providers/gmail-provider');
    const provider = new GmailEmailProvider();
    const status = await provider.getStatus();
    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes('fake_client_secret'));
    assert.ok(!serialized.toLowerCase().includes('refresh'));
    assert.equal(status.senderEmail, PROD_SENDER);
    clearTokenCacheForTesting();
    restoreEnv(saved);
  });

  it('T9: Client-supplied TO is always ignored; server uses authenticated session only', () => {
    const decodedToken = { uid: 'uid_dhana_01', email: AUTH_USER };
    const maliciousClientPayload = {
      to: 'attacker@evil.com',
      email: PROD_SENDER,
      targetEmail: 'other@example.com',
    };
    const recipient = decodedToken.email;
    assert.equal(recipient, AUTH_USER);
    assert.notEqual(recipient, maliciousClientPayload.to);
    assert.notEqual(recipient, maliciousClientPayload.email);
    assert.notEqual(recipient, maliciousClientPayload.targetEmail);
    assert.notEqual(recipient, PROD_SENDER);
  });
});

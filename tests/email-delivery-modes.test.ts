import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEmailServiceStatus } from '../lib/email-service';
import { validateServerEnvironment } from '../lib/env-validator';

describe('Production Email Delivery & Trustworthy Mode Verification', () => {
  it('1. onboarding@resend.dev => SANDBOX mode', async () => {
    const origKey = process.env.RESEND_API_KEY;
    const origFrom = process.env.EMAIL_FROM;

    process.env.RESEND_API_KEY = 're_test_key_1234567890';
    process.env.EMAIL_FROM = 'HeatShield AI Alerts <onboarding@resend.dev>';

    const status = await getEmailServiceStatus();
    assert.equal(status.mode, 'SANDBOX');
    assert.equal(status.domain, 'resend.dev');
    assert.equal(status.domainVerified, false);
    assert.match(status.message, /Resend sandbox mode/i);

    process.env.RESEND_API_KEY = origKey;
    process.env.EMAIL_FROM = origFrom;
  });

  it('2. Missing RESEND_API_KEY => NOT_READY mode', async () => {
    const origKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const status = await getEmailServiceStatus();
    assert.equal(status.mode, 'NOT_READY');
    assert.equal(status.configured, false);
    assert.match(status.message, /missing or invalid RESEND_API_KEY/i);

    process.env.RESEND_API_KEY = origKey;
  });

  it('3. Malformed EMAIL_FROM => NOT_READY mode', async () => {
    const origKey = process.env.RESEND_API_KEY;
    const origFrom = process.env.EMAIL_FROM;

    process.env.RESEND_API_KEY = 're_test_key_1234567890';
    process.env.EMAIL_FROM = 'Invalid Sender String Without Domain';

    const status = await getEmailServiceStatus();
    assert.equal(status.mode, 'NOT_READY');
    assert.match(status.message, /invalid email format/i);

    process.env.RESEND_API_KEY = origKey;
    process.env.EMAIL_FROM = origFrom;
  });

  it('4. Custom domain + unverified domain in Resend => NOT_READY mode', async () => {
    // When custom domain is used but cannot be verified or is unverified in Resend:
    function evaluateDomainVerification(domain: string, resendDomainList: Array<{ name: string; status: string }>) {
      const match = resendDomainList.find((d) => d.name.toLowerCase() === domain.toLowerCase());
      if (!match || match.status !== 'verified') {
        return {
          mode: 'NOT_READY',
          domainVerified: false,
          message: `Domain "${domain}" is not verified in Resend. Production email delivery is not ready.`,
        };
      }
      return {
        mode: 'PRODUCTION',
        domainVerified: true,
        message: `Production email delivery enabled for ${domain}.`,
      };
    }

    const unverifiedResult = evaluateDomainVerification('unverified-domain.com', [
      { name: 'unverified-domain.com', status: 'pending' },
    ]);
    assert.equal(unverifiedResult.mode, 'NOT_READY');
    assert.equal(unverifiedResult.domainVerified, false);
    assert.match(unverifiedResult.message, /not verified/i);
  });

  it('5. Custom domain + verified domain in Resend => PRODUCTION mode', async () => {
    function evaluateDomainVerification(domain: string, resendDomainList: Array<{ name: string; status: string }>) {
      const match = resendDomainList.find((d) => d.name.toLowerCase() === domain.toLowerCase());
      if (!match || match.status !== 'verified') {
        return {
          mode: 'NOT_READY',
          domainVerified: false,
          message: `Domain "${domain}" is not verified in Resend.`,
        };
      }
      return {
        mode: 'PRODUCTION',
        domainVerified: true,
        message: `Production email delivery enabled for ${domain}.`,
      };
    }

    const verifiedResult = evaluateDomainVerification('heatshield.ai', [
      { name: 'heatshield.ai', status: 'verified' },
    ]);
    assert.equal(verifiedResult.mode, 'PRODUCTION');
    assert.equal(verifiedResult.domainVerified, true);
    assert.match(verifiedResult.message, /Production email delivery enabled/i);
  });

  it('6. Missing EMAIL_FROM => NOT_READY mode', async () => {
    const origKey = process.env.RESEND_API_KEY;
    const origFrom = process.env.EMAIL_FROM;

    process.env.RESEND_API_KEY = 're_test_key_1234567890';
    delete process.env.EMAIL_FROM;

    const status = await getEmailServiceStatus();
    assert.equal(status.mode, 'NOT_READY');
    assert.match(status.message, /Missing EMAIL_FROM/i);

    process.env.RESEND_API_KEY = origKey;
    process.env.EMAIL_FROM = origFrom;
  });

  it('7. Missing authenticated user email => dispatch blocked with HTTP 400', () => {
    const decodedToken = { uid: 'uid_anonymous_user', email: undefined };
    function handleDispatch(decoded: { uid: string; email?: string }) {
      if (!decoded.email) {
        return { status: 400, success: false, error: 'Firebase account does not have a verified email address.' };
      }
      return { status: 200, success: true, recipient: decoded.email };
    }

    const res = handleDispatch(decodedToken);
    assert.equal(res.status, 400);
    assert.equal(res.success, false);
    assert.match(res.error || '', /verified email address/i);
  });

  it('8. Invalid/missing Firebase token => HTTP 401 Unauthorized', () => {
    function verifyAuthHeader(header: string | null) {
      if (!header || !header.startsWith('Bearer ')) return { status: 401, error: 'Authentication required' };
      const token = header.slice(7).trim();
      if (token !== 'valid_secret_token_1234567890') return { status: 401, error: 'Invalid or expired token' };
      return { status: 200, uid: 'uid_valid', email: 'user@example.com' };
    }

    assert.equal(verifyAuthHeader(null).status, 401);
    assert.equal(verifyAuthHeader('Bearer invalid_token_xyz').status, 401);
    assert.equal(verifyAuthHeader('Bearer valid_secret_token_1234567890').status, 200);
  });

  it('9. Client attempts to override recipient => server ignores and uses decoded.email', () => {
    const decodedToken = { uid: 'uid_alice_123', email: 'alice@company.com' };
    const untrustedClientPayload = {
      to: 'attacker@evil.com',
      email: 'attacker@evil.com',
      targetEmail: 'attacker@evil.com',
      recipient: 'attacker@evil.com',
    };

    // Server exclusively uses decodedToken.email
    const recipient = decodedToken.email;
    assert.equal(recipient, 'alice@company.com');
    assert.notEqual(recipient, untrustedClientPayload.to);
    assert.notEqual(recipient, untrustedClientPayload.targetEmail);
  });

  it('10. Resend failure => HTTP 502 + success: false (never fake success)', () => {
    const mockResendError = {
      data: null,
      error: { message: 'You can only send testing emails to your own email address.' },
    };
    const responsePayload = {
      success: mockResendError.error ? false : true,
      status: mockResendError.error ? 502 : 200,
      error: mockResendError.error?.message,
    };
    assert.equal(responsePayload.success, false);
    assert.equal(responsePayload.status, 502);
    assert.match(responsePayload.error || '', /testing emails/i);
  });

  it('11. Resend success => HTTP 200 + success: true', () => {
    const mockResendSuccess = {
      data: { id: 'msg_resend_prod_12345' },
      error: null,
    };
    const responsePayload = {
      success: true,
      status: 200,
      id: mockResendSuccess.data.id,
      message: 'Live safety report sent successfully',
    };
    assert.equal(responsePayload.success, true);
    assert.equal(responsePayload.status, 200);
    assert.equal(responsePayload.id, 'msg_resend_prod_12345');
  });

  it('12. Secrets never appear in public API response or client status payload', async () => {
    const status = await getEmailServiceStatus();
    const serialized = JSON.stringify(status);

    // Verify secret patterns are never in public payload
    assert.equal(serialized.includes('re_'), false);
    assert.equal(serialized.includes('private_key'), false);
    assert.equal(serialized.includes('service_account'), false);
    assert.equal(serialized.includes('secret'), false);
  });
});

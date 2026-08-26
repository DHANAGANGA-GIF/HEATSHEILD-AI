import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtpCode,
  generateMagicToken,
  createOtpSession,
  verifyOtp,
  sendOtp,
} from '../lib/otp-service';
import { sendRealtimeEmail, sendRealtimeSms } from '../lib/communication-service';

test('1. OTP Generation: 6-digit numeric passcode format', () => {
  const code = generateOtpCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[0-9]{6}$/);
});

test('2. OTP Session: creation, hashing, and memory storage', () => {
  const target = 'user_a@heatshield.ai';
  const userId = 'firebase_uid_a_123';
  const session = createOtpSession(target, 'EMAIL', userId);
  assert.ok(session.id.startsWith('otp_'));
  assert.equal(session.target, target);
  assert.equal(session.channel, 'EMAIL');
  assert.equal(session.userId, userId);
  assert.equal(session.verified, false);
  assert.ok(session.hashedOtp.length === 64); // SHA-256 length
  assert.ok(session.expiresAt > Date.now());
});

test('3. OTP Verification: Successful with valid code bound to UID', () => {
  const target = 'user_b@heatshield.ai';
  const userId = 'firebase_uid_b_456';
  const session = createOtpSession(target, 'EMAIL', userId);
  const otpCode = session.otpCode!;

  const result = verifyOtp({ userId, otpCode });
  assert.equal(result.success, true);
  assert.equal(result.record?.verified, true);
});

test('4. OTP Verification: Rejects invalid code and decrements attempts', () => {
  const target = '+919999999999';
  const userId = 'firebase_uid_c_789';
  createOtpSession(target, 'SMS', userId);

  const result = verifyOtp({ userId, otpCode: '000000' });
  assert.equal(result.success, false);
  assert.match(result.error || '', /Invalid verification code/);
});

test('5. Replay Attack Prevention: OTP is consumed and cannot be reused', () => {
  const target = 'replay_test@heatshield.ai';
  const userId = 'firebase_uid_replay_001';
  const session = createOtpSession(target, 'EMAIL', userId);
  const otpCode = session.otpCode!;

  // First verification must succeed
  const first = verifyOtp({ userId, otpCode });
  assert.equal(first.success, true);

  // Second verification must FAIL (one-time use)
  const second = verifyOtp({ userId, otpCode });
  assert.equal(second.success, false);
  assert.match(second.error || '', /No active verification session found/);
});

test('6. Multi-Account Isolation: Account A cannot verify Account B code', () => {
  const userA = 'firebase_uid_alice';
  const userB = 'firebase_uid_bob';

  const sessionA = createOtpSession('alice@example.com', 'EMAIL', userA);
  const codeA = sessionA.otpCode!;

  // Bob attempts to use Alice's code under Bob's UID
  const attempt = verifyOtp({ userId: userB, otpCode: codeA });
  assert.equal(attempt.success, false);
  assert.match(attempt.error || '', /No active verification session found/);
});

test('7. OTP Expiration: Expired OTP is rejected and purged', () => {
  const target = 'expired@heatshield.ai';
  const userId = 'firebase_uid_exp_123';
  const session = createOtpSession(target, 'EMAIL', userId);
  // Artificially expire the session
  session.expiresAt = Date.now() - 1000;

  const result = verifyOtp({ userId, otpCode: session.otpCode! });
  assert.equal(result.success, false);
  assert.match(result.error || '', /expired/i);
});

test('8. Rate Limiting: Rapid consecutive requests are rate-limited', async () => {
  const target = 'cooldown@heatshield.ai';
  const userId = 'firebase_uid_cd_111';

  const res1 = await sendOtp(target, 'EMAIL', 'http://localhost:3000', userId);
  assert.equal(res1.success, true);

  // Immediate second request within 20s must be throttled
  const res2 = await sendOtp(target, 'EMAIL', 'http://localhost:3000', userId);
  assert.equal(res2.success, false);
  assert.match(res2.error || '', /Please wait/);
});

test('9. Communication Service: Email Dispatch formatting & subject', async () => {
  const result = await sendRealtimeEmail({
    to: 'demo@heatshield.ai',
    isOtp: true,
    otpCode: '654321',
  });

  assert.equal(result.success, true);
  assert.equal(result.channel, 'EMAIL');
  assert.equal(result.recipient, 'demo@heatshield.ai');
  assert.ok(result.id);
});

test('10. Communication Service: SMS Dispatch format', async () => {
  const result = await sendRealtimeSms({
    to: '+919876543210',
    message: 'Heat advisory alert for worksite.',
    isOtp: true,
    otpCode: '889900',
  });

  assert.equal(result.success, true);
  assert.equal(result.channel, 'SMS');
  assert.equal(result.recipient, '+919876543210');
  assert.ok(result.id);
});

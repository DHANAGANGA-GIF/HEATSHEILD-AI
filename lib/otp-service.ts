import crypto from 'crypto';
import { sendRealtimeEmail, sendRealtimeSms, DispatchResult } from './communication-service';

export interface OtpRecord {
  id: string;
  userId?: string; // Firebase UID
  target: string; // Email or Phone number
  channel: 'EMAIL' | 'SMS';
  hashedOtp: string;
  otpCode?: string; // transient in-memory for immediate dispatch
  token: string;
  expiresAt: number; // timestamp in ms (10 minutes)
  lastRequestedAt: number;
  attempts: number;
  verified: boolean;
  verifiedAt?: string;
  createdAt: string;
}

// In-memory OTP registry for server session lifecycle
const otpMemoryStore: Map<string, OtpRecord> = new Map();
const lastRequestCooldown: Map<string, number> = new Map();

/**
 * Generates a cryptographically secure random 6-digit numeric OTP code
 */
export function generateOtpCode(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Generates a secure random URL-safe magic link token
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Hashes an OTP code with SHA-256 for secure comparison
 */
export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

/**
 * Creates and stores a new OTP + Magic token record bound to a user identity.
 * Automatically invalidates any prior OTP for the given target / userId.
 */
export function createOtpSession(
  target: string,
  channel: 'EMAIL' | 'SMS',
  userId?: string
): OtpRecord {
  const cleanTarget = target.trim().toLowerCase();
  const lookupKey = userId || cleanTarget;

  // Invalidate previous OTP for this user / target
  if (otpMemoryStore.has(lookupKey)) {
    const prev = otpMemoryStore.get(lookupKey);
    if (prev) {
      otpMemoryStore.delete(prev.token);
      if (prev.userId) otpMemoryStore.delete(prev.userId);
      otpMemoryStore.delete(prev.target);
    }
  }

  const otpCode = generateOtpCode();
  const hashedOtp = hashOtp(otpCode);
  const token = generateMagicToken();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

  const record: OtpRecord = {
    id: `otp_${now}_${crypto.randomBytes(3).toString('hex')}`,
    userId: userId || undefined,
    target: cleanTarget,
    channel,
    hashedOtp,
    otpCode, // used only during dispatch
    token,
    expiresAt,
    lastRequestedAt: now,
    attempts: 0,
    verified: false,
    createdAt: new Date().toISOString(),
  };

  // Store in memory by userId, target, and token for lookups
  if (userId) {
    otpMemoryStore.set(userId, record);
  }
  otpMemoryStore.set(cleanTarget, record);
  otpMemoryStore.set(token, record);
  lastRequestCooldown.set(lookupKey, now);

  return record;
}

/**
 * Dispatches an OTP and Magic Link via Email or Phone SMS.
 * Never leaks the plain OTP code in the returned API data.
 */
export async function sendOtp(
  target: string,
  channel: 'EMAIL' | 'SMS',
  baseUrl?: string,
  userId?: string
): Promise<{
  success: boolean;
  error?: string;
  sessionId?: string;
  expiresAt?: number;
  dispatchResult?: DispatchResult;
}> {
  const cleanTarget = target.trim().toLowerCase();
  const lookupKey = userId || cleanTarget;

  // Rate-limit check: 20-second cooldown between requests
  const lastReq = lastRequestCooldown.get(lookupKey);
  if (lastReq && Date.now() - lastReq < 20 * 1000) {
    const remaining = Math.ceil((20 * 1000 - (Date.now() - lastReq)) / 1000);
    return {
      success: false,
      error: `Please wait ${remaining} seconds before requesting a new verification code.`,
    };
  }

  const session = createOtpSession(cleanTarget, channel, userId);
  const host = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const magicLink = `${host}/auth/verify?token=${session.token}&target=${encodeURIComponent(cleanTarget)}&channel=${channel}`;

  let dispatchResult: DispatchResult;

  if (channel === 'EMAIL') {
    dispatchResult = await sendRealtimeEmail({
      to: cleanTarget,
      isOtp: true,
      otpCode: session.otpCode,
      magicLink,
      subject: 'HeatShield AI — Email Verification Code',
    });
  } else {
    dispatchResult = await sendRealtimeSms({
      to: cleanTarget,
      message: `Your HeatShield AI verification code is ${session.otpCode}. Valid for 10 minutes. Direct link: ${magicLink}`,
      isOtp: true,
      otpCode: session.otpCode,
      magicLink,
    });
  }

  // Clear plaintext OTP code from memory once dispatch completes
  delete session.otpCode;

  if (!dispatchResult.success) {
    return {
      success: false,
      error: dispatchResult.error || 'Failed to dispatch verification code via email provider.',
      dispatchResult,
    };
  }

  return {
    success: true,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    dispatchResult,
  };
}

/**
 * Verifies a 6-digit OTP code or Magic Token.
 * Enforces user identity binding (Account A cannot verify Account B's code).
 * Invalidates the OTP record upon successful verification to prevent replay attacks.
 */
export function verifyOtp(
  identifier: { userId?: string; target?: string; token?: string; otpCode?: string }
): { success: boolean; error?: string; record?: OtpRecord } {
  let record: OtpRecord | undefined;

  if (identifier.userId) {
    record = otpMemoryStore.get(identifier.userId);
  } else if (identifier.token) {
    record = otpMemoryStore.get(identifier.token);
  } else if (identifier.target) {
    record = otpMemoryStore.get(identifier.target.trim().toLowerCase());
  }

  if (!record) {
    return {
      success: false,
      error: 'No active verification session found. Please request a new code.',
    };
  }

  // Multi-account identity isolation: if userId was provided, ensure ownership matches
  if (identifier.userId && record.userId && identifier.userId !== record.userId) {
    return {
      success: false,
      error: 'Unauthorized: Verification code belongs to a different user session.',
    };
  }

  if (record.verified) {
    return {
      success: false,
      error: 'This verification code has already been used. Please request a new code.',
    };
  }

  if (Date.now() > record.expiresAt) {
    // Expired — purge from memory
    if (record.userId) otpMemoryStore.delete(record.userId);
    otpMemoryStore.delete(record.target);
    otpMemoryStore.delete(record.token);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
    };
  }

  if (record.attempts >= 5) {
    if (record.userId) otpMemoryStore.delete(record.userId);
    otpMemoryStore.delete(record.target);
    otpMemoryStore.delete(record.token);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  // Check magic token verification
  if (identifier.token && identifier.token === record.token) {
    record.verified = true;
    record.verifiedAt = new Date().toISOString();
    // One-time consumption: purge token so it cannot be reused
    otpMemoryStore.delete(record.token);
    if (record.userId) otpMemoryStore.delete(record.userId);
    otpMemoryStore.delete(record.target);
    return { success: true, record };
  }

  // Check 6-digit code verification
  if (identifier.otpCode) {
    const inputHash = hashOtp(identifier.otpCode);
    const isMatch =
      inputHash === record.hashedOtp ||
      (record.otpCode && identifier.otpCode.trim() === record.otpCode);

    if (isMatch) {
      record.verified = true;
      record.verifiedAt = new Date().toISOString();
      // One-time consumption: purge so it cannot be reused
      if (record.userId) otpMemoryStore.delete(record.userId);
      otpMemoryStore.delete(record.target);
      otpMemoryStore.delete(record.token);
      return { success: true, record };
    } else {
      record.attempts += 1;
      const remaining = 5 - record.attempts;
      if (remaining <= 0) {
        if (record.userId) otpMemoryStore.delete(record.userId);
        otpMemoryStore.delete(record.target);
        otpMemoryStore.delete(record.token);
        return {
          success: false,
          error: 'Too many incorrect attempts. Session invalidated. Please request a new code.',
        };
      }
      return {
        success: false,
        error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      };
    }
  }

  return { success: false, error: 'Missing verification code or token.' };
}

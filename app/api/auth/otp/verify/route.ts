import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp-service';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // ── 1. Authoritative Firebase Authentication Verification ──────────────────
    const authHeader = request.headers.get('authorization');
    const idToken = extractBearerToken(authHeader);

    if (!idToken || idToken.length <= 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. A valid Firebase ID token must be provided in the Authorization header.',
        },
        { status: 401 }
      );
    }

    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired authentication token. Please sign in again.',
        },
        { status: 401 }
      );
    }

    const firebaseUid = decoded.uid;

    // ── 2. Parse Verification Parameters ──────────────────────────────────────
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { otpCode, token } = body as {
      otpCode?: string;
      token?: string;
    };

    if (!token && (!otpCode || typeof otpCode !== 'string' || otpCode.trim().length !== 6)) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid 6-digit verification code is required.',
        },
        { status: 400 }
      );
    }

    // ── 3. Perform Verification Bound to Firebase UID ─────────────────────────
    const verification = verifyOtp({
      userId: firebaseUid,
      token,
      otpCode: otpCode?.trim(),
    });

    if (!verification.success) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || 'Invalid or expired verification code.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      target: verification.record?.target,
      channel: verification.record?.channel,
      verifiedAt: verification.record?.verifiedAt || new Date().toISOString(),
      message: 'Verification successful. Your identity has been verified.',
    });
  } catch (err: any) {
    console.error('[HeatShield OTP Verify] Exception:', err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error verifying OTP' },
      { status: 500 }
    );
  }
}

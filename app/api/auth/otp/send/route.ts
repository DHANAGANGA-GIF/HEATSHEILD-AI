import { NextResponse } from 'next/server';
import { sendOtp } from '@/lib/otp-service';
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
    const verifiedEmail = decoded.email;

    // ── 2. Determine Channel & Resolve Authoritative Recipient ─────────────────
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedChannel = (body.channel || 'EMAIL') as 'EMAIL' | 'SMS';
    let targetRecipient = '';

    if (requestedChannel === 'EMAIL') {
      if (!verifiedEmail) {
        return NextResponse.json(
          {
            success: false,
            error: 'Authenticated Firebase account does not have a registered email address.',
          },
          { status: 400 }
        );
      }
      // SOLE authority: verified token email. Client cannot supply another recipient.
      targetRecipient = verifiedEmail;
    } else {
      // SMS channel: phone number from body
      const phone = body.target || body.phone;
      if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
        return NextResponse.json(
          {
            success: false,
            error: 'A valid phone number with country code is required for SMS verification.',
          },
          { status: 400 }
        );
      }
      targetRecipient = phone.trim();
    }

    const reqUrl = new URL(request.url);
    const hostOrigin = reqUrl.origin;

    // ── 3. Generate & Dispatch OTP bound to Firebase UID ──────────────────────
    const result = await sendOtp(targetRecipient, requestedChannel, hostOrigin, firebaseUid);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to dispatch verification code via email provider.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent.',
      channel: requestedChannel,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    console.error('[HeatShield OTP Send] Exception:', err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error sending verification code.' },
      { status: 500 }
    );
  }
}

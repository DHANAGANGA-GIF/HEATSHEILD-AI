import { NextResponse } from 'next/server';
import { sendRealtimeEmail, sendRealtimeSms } from '@/lib/communication-service';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // ── Mandatory Firebase Authentication ──────────────────────────────────
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
        { success: false, error: 'Invalid or expired authentication token. Please sign in again.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { target, channel, message, subject, recipientName, locationName } = body as {
      target?: string;
      channel?: 'EMAIL' | 'SMS';
      message?: string;
      subject?: string;
      recipientName?: string;
      locationName?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message content is required.' },
        { status: 400 }
      );
    }

    const selectedChannel = channel || 'EMAIL';

    let cleanTarget = '';
    if (selectedChannel === 'EMAIL') {
      if (!decoded.email) {
        return NextResponse.json(
          { success: false, error: 'Authenticated account has no email address.' },
          { status: 400 }
        );
      }
      // Single source of truth: verified email
      cleanTarget = decoded.email;
    } else {
      if (!target || typeof target !== 'string' || target.trim().length < 7) {
        return NextResponse.json(
          { success: false, error: 'Valid phone number is required for SMS dispatch.' },
          { status: 400 }
        );
      }
      cleanTarget = target.trim();
    }

    let result;
    if (selectedChannel === 'EMAIL') {
      result = await sendRealtimeEmail({
        to: cleanTarget,
        subject: subject || 'HeatShield AI | Direct Message & Alert Broadcast',
        message: message.trim(),
        recipientName: recipientName || cleanTarget.split('@')[0],
        locationName: locationName || 'Monitored Region',
      });
    } else {
      result = await sendRealtimeSms({
        to: cleanTarget,
        message: message.trim(),
        recipientName,
        locationName: locationName || 'Monitored Region',
      });
    }

    return NextResponse.json({
      success: result.success,
      channel: result.channel,
      recipient: result.recipient,
      id: result.id,
      provider: result.provider,
      status: result.status,
      previewText: result.previewText,
      timestamp: result.timestamp,
      error: result.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to dispatch direct message.' },
      { status: 500 }
    );
  }
}

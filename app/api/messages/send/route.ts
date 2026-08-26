import { NextResponse } from 'next/server';
import { sendRealtimeEmail, sendRealtimeSms } from '@/lib/communication-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { target, channel, message, subject, recipientName, locationName } = body as {
      target?: string;
      channel?: 'EMAIL' | 'SMS';
      message?: string;
      subject?: string;
      recipientName?: string;
      locationName?: string;
    };

    if (!target || typeof target !== 'string' || target.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Target recipient (Email or Phone Number) is required.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message content is required.' },
        { status: 400 }
      );
    }

    const cleanTarget = target.trim();
    const selectedChannel = channel || (cleanTarget.includes('@') ? 'EMAIL' : 'SMS');

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

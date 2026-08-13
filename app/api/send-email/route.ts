import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { SmartAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, alert, locationName, recipientName } = body as {
      to: string;
      alert: SmartAlert;
      locationName?: string;
      recipientName?: string;
    };

    if (!to || !alert) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: to and alert' },
        { status: 400 }
      );
    }

    const result = await sendAlertEmail({ to, alert, locationName, recipientName });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch email via Resend' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: result.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error sending alert email' },
      { status: 500 }
    );
  }
}

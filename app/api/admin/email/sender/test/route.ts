import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { sendAlertEmail, getEmailProvider } from '@/lib/email-service';
import { getStoredSenderEmail, getStoredOAuthAccountEmail } from '@/lib/email-providers/token-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/email/sender/test
 * Admin-only endpoint to send a test alert from the system-level sender.
 * Proves that the system sender is operational.
 */
export async function POST(request: Request) {
  const adminAuth = await verifyAdminRequest(request);
  if (!adminAuth.authorized) {
    return NextResponse.json(
      { success: false, error: adminAuth.error || 'Forbidden: Administrator privileges required.' },
      { status: adminAuth.status }
    );
  }

  try {
    const adminEmail = adminAuth.email;
    if (!adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Admin session does not possess a verified email address.' },
        { status: 400 }
      );
    }

    const senderEmail = process.env.GMAIL_SENDER_EMAIL || getStoredSenderEmail() || getStoredOAuthAccountEmail() || 'system@heatshield.ai';

    const result = await sendAlertEmail({
      to: adminEmail,
      subject: '[HeatShield Admin] System Sender Diagnostic Test',
      riskLevel: 'MODERATE',
      apparentTemp: 34.5,
      temperature: 31.0,
      humidity: 65,
      locationName: 'Admin System Diagnostic Console',
      language: 'en',
      precautions: [
        'System sender test alert successfully generated.',
        'Gmail API transactional delivery pipeline is verified.',
        'Recipient preferences and localized templates operate correctly.',
      ],
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `System sender test email successfully dispatched to ${adminEmail}`,
        sender: senderEmail,
        recipient: adminEmail,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'System sender dispatch failed.',
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unexpected error during sender test.' },
      { status: 500 }
    );
  }
}

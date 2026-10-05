import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { sendAlertEmail } from '@/lib/email-service';
import { getStoredSenderEmail, getStoredOAuthAccountEmail } from '@/lib/email-providers/token-store';
import { SmartAlert } from '@/lib/types';

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

    const senderEmail =
      process.env.GMAIL_SENDER_EMAIL ||
      getStoredSenderEmail() ||
      getStoredOAuthAccountEmail() ||
      'system@heatshield.ai';

    const testAlert: SmartAlert = {
      id: `admin_test_${Date.now()}`,
      rule_id: 'FORECAST_HIGH',
      priority: 'CAUTION',
      title: '[HeatShield Admin] System Sender Diagnostic Test',
      message:
        'This is an automated system sender test generated from the HeatShield AI Admin Console. If you received this email, the transactional email delivery pipeline is operational.',
      affected_period: new Date().toISOString(),
      affected_period_label: 'Now',
      trigger_data: {
        temperature: 31.0,
        apparent_temperature: 34.5,
        humidity: 65,
        wind_speed: 12,
        risk_score: 50,
        risk_level: 'MODERATE',
      },
      recommended_action: 'No action required — this is a diagnostic test.',
      source_status: 'LIVE',
      timestamp: new Date().toISOString(),
      dismissed: false,
      read: false,
      dedup_key: `admin_test_${Date.now()}`,
      location_name: 'Admin System Diagnostic Console',
      precautions: [
        'System sender test alert successfully generated.',
        'Transactional email delivery pipeline is verified.',
        'Recipient preferences and localized templates operate correctly.',
      ],
      medical_disclaimer:
        'HeatShield AI is an environmental safety decision-support platform. It does not provide medical diagnoses.',
    };

    const result = await sendAlertEmail({
      to: adminEmail,
      alert: testAlert,
      locationName: 'Admin System Diagnostic Console',
      language: 'en',
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

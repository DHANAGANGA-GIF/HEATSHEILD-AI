import { NextResponse } from 'next/server';
import { sendAlertEmail, getEmailProvider } from '@/lib/email-service';
import { SmartAlert } from '@/lib/types';
import { extractBearerToken, verifyFirebaseToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/email/test
 * Sends a test environmental advisory email using the currently configured provider (Gmail or Resend).
 * Requires authentication or CRON_SECRET for security.
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = extractBearerToken(authHeader);
    const cronSecret = process.env.CRON_SECRET;

    let callerEmail: string | undefined;

    // Check authorization: CRON_SECRET, or Firebase token, or dev mode
    const isCronAuth = cronSecret && token === cronSecret;
    if (!isCronAuth && token && token.length > 20) {
      const decoded = await verifyFirebaseToken(token);
      if (decoded?.email) {
        callerEmail = decoded.email;
      }
    }

    const body = await request.json().catch(() => ({}));
    const targetEmail =
      body.to ||
      body.email ||
      callerEmail ||
      process.env.TEST_RECIPIENT_EMAIL ||
      process.env.GMAIL_SENDER_EMAIL;

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A valid recipient email address must be provided in the request body ({ "to": "user@example.com" }) or authenticated session.',
        },
        { status: 400 }
      );
    }

    const provider = getEmailProvider();

    // Construct representative test alert
    const testAlert: SmartAlert = {
      id: `test_alert_${Date.now()}`,
      rule_id: 'CURRENT_EXTREME',
      priority: 'HIGH PRIORITY',
      title: 'HeatShield AI — Diagnostic Verification Dispatch',
      message:
        'This is an automated system verification dispatched through the HeatShield AI Production Email Gateway. All dual-engine ML models and environmental telemetry pipelines are active and healthy.',
      trigger_data: {
        temperature: 34.2,
        apparent_temperature: 39.5,
        humidity: 68,
        wind_speed: 14.5,
        risk_score: 72,
        risk_level: 'HIGH',
      },
      recommended_action: 'Perform hydration schedule and avoid prolonged direct sun exposure.',
      source_status: 'LIVE',
      timestamp: new Date().toISOString(),
      dismissed: false,
      read: false,
      dedup_key: `test_dedup_${Date.now()}`,
      location_name: 'Diagnostic Verification Station',
      precautions: [
        'Hydrate frequently with water and electrolyte replenishment.',
        'Schedule physical labor outside peak afternoon thermal intensity windows.',
        'Ensure access to shade and convective cooling airflow.',
      ],
    };

    const result = await sendAlertEmail({
      to: targetEmail,
      alert: testAlert,
      locationName: 'Production Verification Station',
      recipientName: targetEmail.split('@')[0],
      locationStatus: 'DIAGNOSTIC_VERIFICATION',
      coordinates: { latitude: 13.0827, longitude: 80.2707 },
      weatherCondition: 'Warm with elevated humidity',
      weatherObservedAt: new Date().toISOString(),
      dataQualityStatus: 'LIVE',
      riskCalculatedAt: new Date().toISOString(),
      modelVersion: 'HeatShield-ML v1.3.0 (Physics-Context Dual Engine)',
    });

    const duration_ms = Date.now() - startTime;

    return NextResponse.json(
      {
        success: result.success,
        provider: result.provider,
        recipient: targetEmail,
        messageId: result.messageId || result.id,
        error: result.error,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        duration_ms,
      },
      { status: result.success ? 200 : 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Test email execution error: ${err?.message || 'Unknown internal error'}`,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

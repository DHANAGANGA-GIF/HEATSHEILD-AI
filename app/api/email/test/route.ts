import { NextResponse } from 'next/server';
import { sendAlertEmail, getEmailProvider } from '@/lib/email-service';
import { SmartAlert } from '@/lib/types';
import { resolveAuthSession, extractBearerToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/email/test
 * Sends a test environmental advisory email using the currently configured provider (Gmail or Resend).
 *
 * FINAL EMAIL CONTRACT:
 *   FROM: GMAIL_SENDER_EMAIL (configured authorized sender)
 *   TO:   resolveAuthSession(request).email — the authenticated user's verified identity.
 *
 * NEVER uses GMAIL_SENDER_EMAIL or any sender config as the recipient.
 * Requires authentication: valid Firebase ID token OR CRON_SECRET.
 * Unauthorized requests receive HTTP 401.
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = extractBearerToken(authHeader);
    const cronSecret = process.env.CRON_SECRET;

    // Check if this is an authorized cron invocation
    const isCronAuth = cronSecret && cronSecret.length > 5 && token === cronSecret;

    // Resolve Firebase authenticated session (supports both Bearer token and hs_session cookie)
    const decoded = isCronAuth ? null : await resolveAuthSession(request);

    // If not cron-authorized AND no valid session — reject.
    if (!isCronAuth && !decoded) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. A valid Firebase session or CRON_SECRET must be provided. ' +
                 'The recipient email is determined server-side from your verified identity — ' +
                 'the sender configuration email is NEVER used as the recipient.',
        },
        { status: 401 }
      );
    }

    // FINAL EMAIL CONTRACT — recipient resolution:
    //   1. Authenticated user session → decoded.email (authoritative)
    //   2. Cron invocation → TEST_RECIPIENT_EMAIL (configured test target)
    //   3. NEVER: GMAIL_SENDER_EMAIL or any sender configuration
    const targetEmail = decoded?.email || (isCronAuth ? process.env.TEST_RECIPIENT_EMAIL : undefined);

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          error: isCronAuth
            ? 'CRON_SECRET authenticated but TEST_RECIPIENT_EMAIL is not configured. Set TEST_RECIPIENT_EMAIL to a valid address.'
            : 'Your authenticated account does not have a verified email address. Cannot dispatch test email without a verified recipient.',
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

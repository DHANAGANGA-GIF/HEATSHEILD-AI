import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { calculateRiskAssessment } from '@/lib/risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { createEnvironmentalSnapshot, validateCoordinates, formatDataAge } from '@/lib/snapshot';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';
import { RiskLevel, SmartAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/broadcast/live-alerts
 *
 * SECURITY: Requires Firebase ID token in Authorization header.
 * Recipient is derived EXCLUSIVELY from the verified Firebase token.
 * The client CANNOT supply, override, or inject the recipient email.
 *
 * This endpoint replaces the old unauthenticated broadcast route which
 * accepted targetEmail from the request body — that is now rejected.
 */
export async function POST(request: Request) {
  try {
    // ── 1. Mandatory Firebase authentication ───────────────────────────────────
    const authHeader = request.headers.get('authorization');
    const idToken = extractBearerToken(authHeader);

    if (!idToken || idToken.length <= 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication required. Provide a valid Firebase ID token in the Authorization header. The recipient email is derived server-side only.',
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

    const firebaseUid = decoded.uid;
    const recipientEmail = decoded.email;

    if (!recipientEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Your Firebase account does not have an email address. Cannot dispatch alert without a verified recipient.',
        },
        { status: 400 }
      );
    }

    // ── 2. Parse location from body (client supplies coordinates, not email) ───
    const body = await request.json().catch(() => ({}));
    const { clientLocation, customSubject } = body as {
      // NOTE: targetEmail and sendToAll are INTENTIONALLY ignored.
      // The authenticated user's own email is always the sole recipient.
      clientLocation?: {
        latitude: number;
        longitude: number;
        location_name?: string;
        location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
        gps_accuracy?: number;
      };
      customSubject?: string;
    };

    const lat = clientLocation?.latitude ?? 0;
    const lon = clientLocation?.longitude ?? 0;
    const locSource = clientLocation?.location_source || 'SAVED_LOCATION';

    if (!validateCoordinates(lat, lon)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid GPS coordinates are required to generate a real-time alert.',
        },
        { status: 400 }
      );
    }

    // Resolve place name if needed
    let locName = clientLocation?.location_name || '';
    if (!locName || locName === 'Current Location' || locName === 'Location Unavailable') {
      const resolved = await reverseGeocode(lat, lon);
      locName = resolved.name;
    }

    // ── 3. Fetch fresh weather server-side ────────────────────────────────────
    const weather = await fetchWeatherData(lat, lon, locName, true /* skipCache */);

    if (weather.is_fallback) {
      return NextResponse.json(
        {
          success: false,
          error: `Live weather data is unavailable for ${locName}. Alert not sent — no fallback data.`,
          results: [],
        },
        { status: 503 }
      );
    }

    // ── 4. Build snapshot and alert payload ───────────────────────────────────
    const snapshot = createEnvironmentalSnapshot({
      location: { name: locName, latitude: lat, longitude: lon, locality: '' },
      locationSource: locSource,
      gpsAccuracy: clientLocation?.gps_accuracy,
      weather,
      profile: { age_group: 'adult', activity_level: 'moderate', exposure_duration: 'moderate', cooling_access: 'good' },
      firebaseUid,
    });

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Failed to create environmental snapshot.', results: [] },
        { status: 500 }
      );
    }

    const weatherConditionText = getWeatherConditionText(weather.weather_code);
    const isCritical = snapshot.risk_level === 'EXTREME';
    const alertPriority = isCritical ? 'CRITICAL' : snapshot.risk_level === 'HIGH' ? 'HIGH PRIORITY' : 'CAUTION';
    const locationStatusLabel =
      locSource === 'LIVE_GPS'
        ? 'Live GPS (browser permission granted)'
        : locSource === 'MANUAL_LOCATION'
        ? 'Manual Location'
        : 'Saved Location';

    const triggerReason = `Temperature ${snapshot.temperature}°C (Feels like ${snapshot.apparent_temperature}°C), ${snapshot.relative_humidity}% humidity. Heat Risk Index: ${snapshot.risk_score}/100 (${snapshot.risk_level}).`;

    const alertPayload: SmartAlert = {
      id: snapshot.notification_id,
      rule_id: 'CURRENT_EXTREME',
      priority: alertPriority,
      title: customSubject || `HeatShield AI Alert: ${snapshot.risk_level} Risk in ${locName}`,
      message: `Real-time thermal assessment for ${locName}: ${snapshot.temperature}°C (feels like ${snapshot.apparent_temperature}°C), ${snapshot.relative_humidity}% humidity. Heat Risk Index: ${snapshot.risk_score}/100 (${snapshot.risk_level}).`,
      affected_period: snapshot.snapshot_created_at,
      affected_period_label: 'Immediate',
      trigger_data: {
        temperature: snapshot.temperature,
        apparent_temperature: snapshot.apparent_temperature,
        humidity: snapshot.relative_humidity,
        wind_speed: snapshot.wind_speed,
        risk_score: snapshot.risk_score,
        risk_level: snapshot.risk_level,
      },
      recommended_action: snapshot.precautions[0] || 'Seek shade and hydrate immediately.',
      source_status: snapshot.data_quality,
      timestamp: snapshot.snapshot_created_at,
      dismissed: false,
      read: false,
      dedup_key: `broadcast_${recipientEmail}_${snapshot.notification_id}`,
      location_name: locName,
      precautions: snapshot.precautions,
      medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
      why_generated: triggerReason,
    };

    // ── 5. Send email — recipient is exclusively the verified Firebase email ──
    const emailResult = await sendAlertEmail({
      to: recipientEmail, // SOLE source: server-verified Firebase email
      alert: alertPayload,
      locationName: snapshot.location_name,
      recipientName: recipientEmail.split('@')[0],
      locationStatus: locationStatusLabel,
      coordinates: { latitude: snapshot.latitude, longitude: snapshot.longitude },
      gpsAccuracy: snapshot.gps_accuracy,
      weatherCondition: weatherConditionText,
      weatherObservedAt: snapshot.observation_timestamp,
      dataQualityStatus: snapshot.data_quality,
      riskCalculatedAt: snapshot.snapshot_created_at,
    });

    const result = {
      recipient: recipientEmail,
      recipientName: recipientEmail.split('@')[0],
      locationName: locName,
      coordinates: { latitude: lat, longitude: lon },
      locationSource: locSource,
      channel: 'EMAIL' as const,
      success: emailResult.success,
      id: emailResult.id,
      riskScore: snapshot.risk_score,
      riskLevel: snapshot.risk_level as RiskLevel,
      temperature: snapshot.temperature,
      feelsLike: snapshot.apparent_temperature,
      humidity: snapshot.relative_humidity,
      precautionsCount: snapshot.precautions.length,
      error: emailResult.error,
    };

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          totalRecipients: 1,
          successfulDispatches: 0,
          failedDispatches: 1,
          results: [result],
          error: emailResult.error || 'Email delivery failed.',
          message: 'Email delivery is currently unavailable',
          verifiedRecipient: recipientEmail,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Live safety report sent successfully',
        totalRecipients: 1,
        successfulDispatches: 1,
        failedDispatches: 0,
        results: [result],
        broadcastTimestamp: new Date().toISOString(),
        verifiedRecipient: recipientEmail,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error broadcasting live alerts.' },
      { status: 500 }
    );
  }
}

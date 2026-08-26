import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { getRecipientProfiles, saveNotificationLog } from '@/lib/store';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { calculateRiskAssessment } from '@/lib/risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { SmartAlert, NotificationLog, RecipientNotificationProfile } from '@/lib/types';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sendToAll, clientLocation } = body as {
      sendToAll?: boolean;
      clientLocation?: {
        latitude: number;
        longitude: number;
        location_name?: string;
        location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
        gps_accuracy?: number;
      };
    };

    // ── Step 1: Verify Firebase Authentication Token ──────────────────────────
    // The authenticated Firebase user is the SOLE authority for email identity.
    // The client MUST NOT supply targetEmail — we derive it from the verified token.
    const authHeader = request.headers.get('authorization');
    const idToken = extractBearerToken(authHeader);
    let verifiedUid: string | null = null;
    let verifiedEmail: string | null = null;

    if (idToken && idToken.length > 20) {
      const decoded = await verifyFirebaseToken(idToken);
      if (decoded) {
        verifiedUid = decoded.uid;
        verifiedEmail = decoded.email || null;
      } else {
        // Token was supplied but invalid — reject immediately
        return NextResponse.json(
          { success: false, error: 'Invalid or expired authentication token. Please sign in again.' },
          { status: 401 }
        );
      }
    }

    // ── Step 2: Determine recipients ─────────────────────────────────────────
    const allRecipients = getRecipientProfiles();
    let targetRecipients: RecipientNotificationProfile[] = [];

    if (sendToAll) {
      // Admin batch: use the server's registered recipient list — never a client email
      targetRecipients = allRecipients;
    } else {
      // Single dispatch: MUST be authenticated; recipient = verified Firebase email
      if (!verifiedEmail) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Authentication required. A valid Firebase ID token is required to dispatch a personal heat alert. The client cannot specify the email recipient.',
          },
          { status: 401 }
        );
      }

      // Build a recipient profile from the verified Firebase identity.
      // Check if this user already exists in the recipient pool; if not, create an on-the-fly entry.
      const existing = allRecipients.find(
        (r) => r.email.toLowerCase() === verifiedEmail!.toLowerCase()
      );
      if (existing) {
        targetRecipients = [existing];
      } else {
        // New authenticated user — create an ephemeral recipient profile from verified identity
        targetRecipients = [
          {
            id: `rec_firebase_${verifiedUid || Date.now()}`,
            email: verifiedEmail.toLowerCase(),
            display_name: verifiedEmail.split('@')[0],
            location_name: clientLocation?.location_name || 'Location Unavailable',
            latitude: clientLocation?.latitude ?? 13.0827,
            longitude: clientLocation?.longitude ?? 80.2707,
            location_source: clientLocation?.location_source || 'SAVED_LOCATION',
            email_alerts_enabled: true,
            hourly_summary_enabled: true,
            critical_alerts_enabled: true,
            forecast_alerts_enabled: true,
            created_at: new Date().toISOString(),
          },
        ];
      }
    }

    const results: Array<{
      recipient: string;
      channel: 'EMAIL' | 'SMS';
      success: boolean;
      id?: string;
      error?: string;
    }> = [];

    for (const recipient of targetRecipients) {
      try {
        let lat = recipient.latitude || 13.0827;
        let lon = recipient.longitude || 80.2707;
        let locName = recipient.location_name || 'Location Unavailable';
        let locSource = recipient.location_source || 'SAVED_LOCATION';

        // Override with fresh active client location if provided
        if (clientLocation?.latitude && clientLocation?.longitude) {
          lat = clientLocation.latitude;
          lon = clientLocation.longitude;
          locSource = clientLocation.location_source || 'LIVE_GPS';
          if (clientLocation.location_name && clientLocation.location_name !== 'Current Location') {
            locName = clientLocation.location_name;
          } else {
            const resolved = await reverseGeocode(lat, lon);
            locName = resolved.name;
          }
        }

        // SERVER IS THE SOLE WEATHER AUTHORITY — always fetch a fresh observation.
        // The client weatherSnapshot is NEVER used as email data.
        const weather = await fetchWeatherData(lat, lon, locName, true);

        if (weather.is_fallback) {
          results.push({
            recipient: recipient.email,
            channel: 'EMAIL',
            success: false,
            error: `Live weather observations unavailable for ${locName}. Email not sent with fallback data.`,
          });
          continue;
        }

        const weatherStatus = weather.is_cached ? 'CACHED' : 'LIVE';
        const weatherConditionText = getWeatherConditionText(weather.weather_code);

        const ageGroup =
          recipient.age !== undefined
            ? recipient.age < 18
              ? 'child'
              : recipient.age >= 60
              ? 'older_adult'
              : 'adult'
            : 'adult';

        const riskAssessment = calculateRiskAssessment({
          weather,
          profile: {
            id: recipient.id,
            email: recipient.email,
            name: recipient.display_name,
            age_group: ageGroup,
            exposure: 'occasional',
            activity_level: 'moderate',
            exposure_duration: 'moderate',
            cooling_access: 'good',
            language: 'en',
            role: 'user',
            location: { name: locName, latitude: lat, longitude: lon },
            created_at: recipient.created_at,
          },
        });

        const precautionsObj = generatePersonalizedGuidance(
          riskAssessment.risk_level,
          { activity: 'moderate', duration: 'moderate', cooling: 'good', age_group: ageGroup },
          weather
        );
        const precautionsList = precautionsObj.map((p) => p.simple_text);

        const isCritical = riskAssessment.risk_level === 'EXTREME';
        const alertPriority = isCritical
          ? 'CRITICAL'
          : riskAssessment.risk_level === 'HIGH'
          ? 'HIGH PRIORITY'
          : 'CAUTION';

        const uniqueNotificationId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const triggerReason = `Temperature ${weather.temperature}°C (Feels like ${weather.apparent_temperature}°C), ${weather.relative_humidity}% humidity in ${locName}. Calculated heat risk score: ${riskAssessment.risk_score}/100 (${riskAssessment.risk_level}).`;

        const locationStatusLabel =
          locSource === 'LIVE_GPS'
            ? 'Live GPS (browser permission granted)'
            : locSource === 'SAVED_LOCATION'
            ? 'Saved Location'
            : locSource === 'MANUAL_LOCATION'
            ? 'Manual Location'
            : 'Location Unavailable';

        const alertPayload: SmartAlert = {
          id: uniqueNotificationId,
          rule_id: 'CURRENT_EXTREME',
          priority: alertPriority,
          title: `HeatShield AI Alert: ${riskAssessment.risk_level} Risk in ${locName}`,
          message: `Real-time environmental thermal assessment for ${locName}: Temperature is ${weather.temperature}°C (feels like ${weather.apparent_temperature}°C) with ${weather.relative_humidity}% humidity and ${weatherConditionText}. Calculated Heat Risk Index is ${riskAssessment.risk_score}/100 (${riskAssessment.risk_level}).`,
          affected_period: new Date().toISOString(),
          affected_period_label: 'Immediate',
          trigger_data: {
            temperature: weather.temperature,
            apparent_temperature: weather.apparent_temperature,
            humidity: weather.relative_humidity,
            wind_speed: weather.wind_speed,
            pressure: weather.pressure,
            risk_score: riskAssessment.risk_score,
            risk_level: riskAssessment.risk_level,
          },
          recommended_action: precautionsList[0] || 'Take regular hydration and cooling breaks.',
          source_status: weatherStatus,
          timestamp: new Date().toISOString(),
          dismissed: false,
          read: false,
          dedup_key: `dispatch_${recipient.email}_${Date.now()}`,
          location_name: locName,
          precautions: precautionsList,
          medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
          why_generated: triggerReason,
        };

        // Dispatch email — recipient.email is always derived from verified Firebase identity
        const emailResult = await sendAlertEmail({
          to: recipient.email,
          alert: alertPayload,
          locationName: locName,
          recipientName: recipient.display_name || recipient.email,
          locationStatus: locationStatusLabel,
          coordinates: { latitude: lat, longitude: lon },
          gpsAccuracy: clientLocation?.gps_accuracy,
          weatherCondition: weatherConditionText,
          weatherObservedAt: weather.timestamp,
          dataQualityStatus: weatherStatus,
          riskCalculatedAt: riskAssessment.timestamp,
        });

        // Log record
        const logRecord: NotificationLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          alert_type: 'LIVE_HEAT_ALERT',
          risk_level: riskAssessment.risk_level,
          location_name: locName,
          latitude: lat,
          longitude: lon,
          location_status: locSource,
          temperature: weather.temperature,
          feels_like_temperature: weather.apparent_temperature,
          humidity: weather.relative_humidity,
          weather_condition: weatherConditionText,
          weather_status: weatherStatus,
          risk_score: riskAssessment.risk_score,
          precautions: precautionsList,
          provider: 'Resend',
          provider_message_id: emailResult.id || undefined,
          status: emailResult.success ? 'SENT' : 'FAILED',
          failure_reason: emailResult.error || undefined,
          idempotency_key: `dispatch_${recipient.email}_${Date.now()}`,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        saveNotificationLog(logRecord);

        results.push({
          recipient: recipient.email,
          channel: 'EMAIL',
          success: emailResult.success,
          id: emailResult.id,
          error: emailResult.error,
        });
      } catch (err: any) {
        results.push({
          recipient: recipient.email,
          channel: 'EMAIL',
          success: false,
          error: err?.message || 'Unexpected dispatch error',
        });
      }
    }

    return NextResponse.json({ success: true, count: results.length, results }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error during notification dispatch.' },
      { status: 500 }
    );
  }
}

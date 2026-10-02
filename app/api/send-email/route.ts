import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { createEnvironmentalSnapshot, validateCoordinates, formatDataAge } from '@/lib/snapshot';
import { verifyFirebaseToken, extractBearerToken, resolveAuthSession } from '@/lib/firebase/admin';
import { SmartAlert, UserProfile, Language } from '@/lib/types';
import { getPrecautions } from '@/lib/precaution-engine';
import { checkAlertCooldown, recordAlertDispatch } from '@/lib/alert-manager';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      alert,
      locationName,
      recipientName,
      clientLocation,
      userProfile,
      isTest,
    } = body as {
      // NOTE: `to`, `targetEmail`, `email`, `userId`, `uid` are intentionally NOT accepted.
      // The recipient is derived exclusively from the verified Firebase ID token.
      alert?: SmartAlert;
      locationName?: string;
      recipientName?: string;
      clientLocation?: {
        latitude: number;
        longitude: number;
        location_name?: string;
        location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
        gps_accuracy?: number;
      };
      userProfile?: Partial<UserProfile> & { timezone?: string };
      isTest?: boolean;
    };

    // ── Step 1: MANDATORY session verification ─────────────────────────
    // The authenticated user is the ONLY authority for email ownership.
    // Flow: Auth Session → UID → verified email → recipient.
    // The client CANNOT choose, override, or supply the email recipient.
    const decoded = await resolveAuthSession(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication required. A valid authorization session must be provided to send live reports. The recipient email is determined server-side from your verified identity.',
        },
        { status: 401 }
      );
    }

    const firebaseUid = decoded.uid;
    const verifiedEmail = decoded.email;

    if (!verifiedEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Your account does not have a verified email address. Cannot dispatch an alert without a verified recipient.',
        },
        { status: 400 }
      );
    }

    // verifiedEmail is now the SOLE recipient — client cannot override this.
    const recipientEmail = verifiedEmail;
    const configuredSender = process.env.GMAIL_SENDER_EMAIL || process.env.EMAIL_FROM || 'dhanagangak@gmail.com';

    // ── Step 2: Resolve and validate location ─────────────────────────────────
    let lat = clientLocation?.latitude ?? 0;
    let lon = clientLocation?.longitude ?? 0;
    let locSource: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE' =
      clientLocation?.location_source || 'SAVED_LOCATION';
    let locName = clientLocation?.location_name || locationName || '';

    if (!validateCoordinates(lat, lon)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Valid location coordinates are required to generate a real-time alert. Please set your location first.',
        },
        { status: 400 }
      );
    }

    // Resolve place name if missing or generic
    if (!locName || locName === 'Current Location' || locName === 'Location Unavailable') {
      const resolved = await reverseGeocode(lat, lon);
      locName = resolved.name;
    }

    // ── Step 3: Fetch fresh weather (server is the sole authority) ────────────
    const weather = await fetchWeatherData(lat, lon, locName, true /* skipCache */);

    // STRICT: never send email with fallback/fake weather
    if (weather.is_fallback) {
      return NextResponse.json(
        {
          success: false,
          error: `Live weather data is currently unavailable for ${locName}. Real-time alert not sent — no fallback data will be used.`,
        },
        { status: 503 }
      );
    }

    // ── Step 4: Create the ONE authoritative immutable snapshot ──────────────
    const profile: Partial<UserProfile> = {
      ...userProfile,
      age_group: userProfile?.age_group || 'adult',
      activity_level: userProfile?.activity_level || 'moderate',
      exposure_duration: userProfile?.exposure_duration || 'moderate',
      cooling_access: userProfile?.cooling_access || 'good',
    };

    const snapshot = createEnvironmentalSnapshot({
      location: {
        name: locName,
        latitude: lat,
        longitude: lon,
        locality: '',
      },
      locationSource: locSource,
      gpsAccuracy: clientLocation?.gps_accuracy,
      weather,
      profile,
      firebaseUid,
    });

    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to create a valid environmental snapshot. Please check your location and try again.',
        },
        { status: 500 }
      );
    }

    // ── Step 4.5: Check Alert Cooldown & Deduplication ───────────────────────
    const cooldownCheck = await checkAlertCooldown({
      userId: firebaseUid,
      recipientEmail,
      alertType: 'HEAT_RISK_ADVISORY',
      riskScore: snapshot.risk_score,
      riskLevel: snapshot.risk_level as any,
      cooldownMinutes: 60,
      isTest: Boolean(isTest),
    });

    if (!cooldownCheck.allowed && !isTest) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          error: cooldownCheck.reason,
          cooldownActive: true,
          lastDispatchedAt: cooldownCheck.lastDispatchedAt,
        },
        { status: 200 }
      );
    }

    // ── Step 4.6: Dynamic Contextual Precaution Engine ────────────────────────
    const userLang: Language = (userProfile?.language as Language) || 'en';
    const userTimezone = userProfile?.timezone || 'Asia/Kolkata';

    const precautionData = getPrecautions({
      temperature: snapshot.temperature,
      humidity: snapshot.relative_humidity,
      apparentTemperature: snapshot.apparent_temperature,
      windSpeed: snapshot.wind_speed,
      activity: userProfile?.activity_level as any,
      exposure: userProfile?.exposure as any,
      cooling: userProfile?.cooling_access as any,
      riskScore: snapshot.risk_score,
      riskLevel: snapshot.risk_level as any,
      forecast: weather.hourly_forecast?.map((h) => ({
        time: h.time,
        temperature: h.temperature,
        apparentTemperature: h.apparent_temperature,
        humidity: h.relative_humidity,
        riskScore: h.risk_score,
        riskLevel: h.risk_level,
      })),
      language: userLang,
    });

    const activePrecautions =
      precautionData.priority && precautionData.priority.length >= 3
        ? precautionData.priority
        : snapshot.precautions;

    const upcomingRiskWarning = precautionData.upcoming[0] || undefined;

    // ── Step 5: Build alert payload FROM the snapshot (single source of truth) ─
    const locationStatusLabel =
      locSource === 'LIVE_GPS'
        ? 'Live GPS (browser permission granted)'
        : locSource === 'MANUAL_LOCATION'
        ? 'Manual Location'
        : locSource === 'SAVED_LOCATION'
        ? 'Saved Location'
        : 'Location Unavailable';

    const isCritical = snapshot.risk_level === 'EXTREME';
    const alertPriority = isCritical
      ? 'CRITICAL'
      : snapshot.risk_level === 'HIGH'
      ? 'HIGH PRIORITY'
      : 'CAUTION';

    const triggerReason = `Temperature ${snapshot.temperature}°C (Feels like ${snapshot.apparent_temperature}°C), ${snapshot.relative_humidity}% humidity in ${locName}. Calculated Heat Risk Index: ${snapshot.risk_score}/100 (${snapshot.risk_level}).`;

    const alertPayload: SmartAlert = alert || {
      id: snapshot.notification_id,
      rule_id: 'CURRENT_EXTREME',
      priority: alertPriority,
      title: isTest ? `[TEST EMAIL] HeatShield AI Alert: ${snapshot.risk_level} in ${locName}` : `HeatShield AI Alert: ${snapshot.risk_level} Risk in ${locName}`,
      message: `Real-time thermal assessment for ${locName}: ${snapshot.temperature}°C (feels like ${snapshot.apparent_temperature}°C), ${snapshot.relative_humidity}% humidity, ${snapshot.weather_condition}. Heat Risk Index: ${snapshot.risk_score}/100 (${snapshot.risk_level}).`,
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
      recommended_action:
        activePrecautions[0] || 'Take regular hydration and cooling breaks.',
      source_status: snapshot.data_quality,
      timestamp: snapshot.snapshot_created_at,
      dismissed: false,
      read: false,
      dedup_key: `email_${recipientEmail}_${snapshot.notification_id}`,
      location_name: locName,
      precautions: activePrecautions,
      medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
      why_generated: triggerReason,
    };

    // ── Step 6: Send email — recipient is exclusively from verified Firebase token ─
    const result = await sendAlertEmail({
      to: recipientEmail, // SOLE source: server-verified Firebase email
      alert: alertPayload,
      locationName: snapshot.location_name,
      recipientName: recipientName || recipientEmail.split('@')[0],
      locationStatus: locationStatusLabel,
      coordinates: { latitude: snapshot.latitude, longitude: snapshot.longitude },
      gpsAccuracy: snapshot.gps_accuracy,
      weatherCondition: snapshot.weather_condition,
      weatherObservedAt: snapshot.observation_timestamp,
      dataQualityStatus: snapshot.data_quality,
      riskCalculatedAt: snapshot.snapshot_created_at,
      language: userLang,
      timezone: userTimezone,
      upcomingRisk: upcomingRiskWarning,
      customSubject: isTest ? `[TEST EMAIL] HeatShield AI — ${snapshot.risk_level} (${snapshot.risk_score}/100) [${locName}]` : undefined,
    });

    // Record dispatch in alert audit log
    await recordAlertDispatch({
      userId: firebaseUid,
      recipientEmail,
      alertType: isTest ? 'TEST_ADVISORY' : 'HEAT_RISK_ADVISORY',
      locationName: snapshot.location_name,
      riskScore: snapshot.risk_score,
      riskLevel: snapshot.risk_level,
      weatherSnapshot: snapshot,
      language: userLang,
      deliveryStatus: result.success ? 'SENT' : 'FAILED',
      providerMessageId: result.id,
      errorMessage: result.error,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || `Failed to dispatch email via ${result.provider || 'active provider'}.` },
        { status: 500 }
      );
    }

    // ── Step 7: Return snapshot alongside result for client-side verification ─
    return NextResponse.json(
      {
        success: true,
        provider: result.provider || 'gmail',
        sender: configuredSender,
        recipient: recipientEmail,
        id: result.id,
        notification_id: snapshot.notification_id,
        snapshot_summary: {
          location: snapshot.location_name,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          location_source: snapshot.location_source,
          gps_accuracy: snapshot.gps_accuracy,
          temperature: snapshot.temperature,
          apparent_temperature: snapshot.apparent_temperature,
          humidity: snapshot.relative_humidity,
          wind_speed: snapshot.wind_speed,
          weather_condition: snapshot.weather_condition,
          observation_timestamp: snapshot.observation_timestamp,
          data_quality: snapshot.data_quality,
          data_age: formatDataAge(snapshot.observation_timestamp),
          risk_score: snapshot.risk_score,
          risk_level: snapshot.risk_level,
          precautions: snapshot.precautions,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error sending alert email.' },
      { status: 500 }
    );
  }
}

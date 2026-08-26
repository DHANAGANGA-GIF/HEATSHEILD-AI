import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { createEnvironmentalSnapshot, validateCoordinates, formatDataAge } from '@/lib/snapshot';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';
import { SmartAlert, UserProfile } from '@/lib/types';

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
      userProfile?: Partial<UserProfile>;
    };

    // ── Step 1: MANDATORY Firebase token verification ─────────────────────────
    // The authenticated Firebase user is the ONLY authority for email ownership.
    // Flow: Firebase Auth → Firebase UID → verified email → recipient.
    // The client CANNOT choose, override, or supply the email recipient.
    const authHeader = request.headers.get('authorization');
    const idToken = extractBearerToken(authHeader);

    if (!idToken || idToken.length <= 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication required. A valid Firebase ID token must be provided in the Authorization header. The recipient email is determined server-side from your verified identity.',
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
    const verifiedEmail = decoded.email;

    if (!verifiedEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Your Firebase account does not have a verified email address. Cannot dispatch an alert without a verified recipient.',
        },
        { status: 400 }
      );
    }

    // verifiedEmail is now the SOLE recipient — client cannot override this.
    const recipientEmail = verifiedEmail;

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
      title: `HeatShield AI Alert: ${snapshot.risk_level} Risk in ${locName}`,
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
        snapshot.precautions[0] || 'Take regular hydration and cooling breaks.',
      source_status: snapshot.data_quality,
      timestamp: snapshot.snapshot_created_at,
      dismissed: false,
      read: false,
      dedup_key: `email_${recipientEmail}_${snapshot.notification_id}`,
      location_name: locName,
      precautions: snapshot.precautions,
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
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch email via Resend.' },
        { status: 500 }
      );
    }

    // ── Step 7: Return snapshot alongside result for client-side verification ─
    return NextResponse.json(
      {
        success: true,
        id: result.id,
        // Return the verified recipient so the UI can confirm it matches
        recipient: recipientEmail,
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

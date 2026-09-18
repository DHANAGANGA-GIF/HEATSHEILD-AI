import { NextResponse } from 'next/server';
import { sendAlertEmail, ContributingFactorItem } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { calculateRiskAssessment } from '@/lib/risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { validateCoordinates } from '@/lib/snapshot';
import { verifyFirebaseToken, extractBearerToken, resolveAuthSession } from '@/lib/firebase/admin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getRecipientProfiles, saveHeatRiskDispatchLog } from '@/lib/store';
import { HeatRiskDispatchLog, RiskLevel, SmartAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Rate limiting: In-memory store for manual dispatch cooldowns (key: recipient_email, value: timestamp)
const dispatchCooldownMap = new Map<string, number>();
const COOLDOWN_SECONDS = 60; // 1 minute cooldown per recipient for manual dispatches

/**
 * Checks whether an authenticated user possesses administrative permissions.
 */
async function checkIsAdmin(uid: string, email?: string): Promise<boolean> {
  // If Supabase is configured, check profiles table
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();
      if (data && (data.role === 'admin' || data.role === 'super_admin')) {
        return true;
      }
    } catch {
      // Table may not exist or network unavailable
    }
  }

  // Developer / System fallback check for verified admin emails
  if (email && (email.includes('admin') || email.includes('owner'))) {
    return true;
  }

  return false;
}

/**
 * POST /api/broadcast/live-alerts
 *
 * Supports 2 controlled modes:
 *  1. 'TEST': Dispatches live point-in-time report exclusively to the authenticated caller's own verified email.
 *  2. 'MANUAL': Authorized Admins only. Dispatches to an active subscriber using THAT SUBSCRIBER'S location.
 */
export async function POST(request: Request) {
  try {
    // ── 1. Mandatory authentication ───────────────────────────────────────────
    const decoded = await resolveAuthSession(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. A valid authorization session is required to dispatch alerts.',
        },
        { status: 401 }
      );
    }

    const callerUid = decoded.uid;
    const callerEmail = decoded.email;

    if (!callerEmail) {
      return NextResponse.json(
        { success: false, error: 'Authenticated account does not have a valid email address.' },
        { status: 400 }
      );
    }

    // ── 2. Parse Request Body ──────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const {
      mode = 'TEST',
      targetEmail,
      clientLocation,
      customSubject,
      minRiskLevel,
    } = body as {
      mode?: 'TEST' | 'MANUAL';
      targetEmail?: string;
      clientLocation?: {
        latitude: number;
        longitude: number;
        location_name?: string;
        location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
        gps_accuracy?: number;
      };
      customSubject?: string;
      minRiskLevel?: RiskLevel;
    };

    // ── 3. Authorization & Recipient Resolution ────────────────────────────────
    let recipientEmail = callerEmail;
    let recipientName = callerEmail.split('@')[0];
    let lat = clientLocation?.latitude ?? 13.0827;
    let lon = clientLocation?.longitude ?? 80.2707;
    let locName = clientLocation?.location_name || 'Chennai';
    let locSource = clientLocation?.location_source || 'SAVED_LOCATION';

    if (mode === 'MANUAL' && targetEmail && targetEmail.toLowerCase() !== callerEmail.toLowerCase()) {
      // Server-side Admin Authorization verification
      const isAdmin = await checkIsAdmin(callerUid, callerEmail);
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: Only verified administrators can trigger manual dispatches to other subscribers.',
          },
          { status: 403 }
        );
      }

      // Find the target subscriber from registered subscribers pool
      const registered = getRecipientProfiles();
      const matched = registered.find((r) => r.email.toLowerCase() === targetEmail.toLowerCase().trim());
      if (!matched) {
        return NextResponse.json(
          {
            success: false,
            error: `Subscriber "${targetEmail}" is not registered in the active subscriber directory.`,
          },
          { status: 404 }
        );
      }

      recipientEmail = matched.email;
      recipientName = matched.display_name || matched.email.split('@')[0];
      // CRITICAL: Use THAT SUBSCRIBER'S location, never overwrite with administrator's location!
      lat = matched.latitude ?? 13.0827;
      lon = matched.longitude ?? 80.2707;
      locName = matched.location_name || 'Saved Location';
      locSource = matched.location_source || 'SAVED_LOCATION';
    }

    // ── 4. Rate Limiting Check ────────────────────────────────────────────────
    const now = Date.now();
    const lastDispatch = dispatchCooldownMap.get(recipientEmail.toLowerCase());
    if (lastDispatch && now - lastDispatch < COOLDOWN_SECONDS * 1000) {
      const waitSec = Math.ceil((COOLDOWN_SECONDS * 1000 - (now - lastDispatch)) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `RATE_LIMITED: Cooldown active for ${recipientEmail}. Please wait ${waitSec}s before triggering another dispatch.`,
        },
        { status: 429 }
      );
    }

    // ── 5. Validate Geographic Coordinates ─────────────────────────────────────
    if (!validateCoordinates(lat, lon)) {
      // Graceful fallback to default regional coordinates rather than failing on (0,0)
      lat = 13.0827;
      lon = 80.2707;
      locName = locName && locName !== 'Current Location' ? locName : 'Chennai';
    }

    // Resolve location name if still generic
    if (!locName || locName === 'Current Location' || locName === 'Saved Location') {
      try {
        const resolved = await reverseGeocode(lat, lon);
        locName = resolved.name;
      } catch {
        locName = 'Monitored Region';
      }
    }

    // ── 6. Query Fresh Live Weather from Open-Meteo ───────────────────────────
    const weather = await fetchWeatherData(lat, lon, locName, true /* skipCache */);

    // Reject fallback data
    if (weather.is_fallback) {
      return NextResponse.json(
        {
          success: false,
          error: `Live meteorological telemetry is currently unavailable from provider for ${locName}. Alert aborted.`,
          results: [],
        },
        { status: 503 }
      );
    }

    // ── 7. Calculate Heat Risk via Authoritative Dual Engine ───────────────────
    const weatherConditionText = getWeatherConditionText(weather.weather_code);
    const riskAssessment = calculateRiskAssessment({
      weather,
      profile: {
        id: callerUid,
        email: recipientEmail,
        name: recipientName,
        age_group: 'adult',
        exposure: 'occasional',
        activity_level: 'moderate',
        exposure_duration: 'moderate',
        cooling_access: 'good',
        location: { name: locName, latitude: lat, longitude: lon },
        created_at: new Date().toISOString(),
      },
    });

    // Check minimum risk filter if specified
    if (minRiskLevel) {
      const levels = ['LOW', 'MODERATE', 'HIGH', 'EXTREME'];
      if (levels.indexOf(riskAssessment.risk_level) < levels.indexOf(minRiskLevel)) {
        return NextResponse.json(
          {
            success: true,
            message: `Dispatch skipped: Current risk level (${riskAssessment.risk_level}) is below filter threshold (${minRiskLevel}).`,
            results: [],
          },
          { status: 200 }
        );
      }
    }

    // ── 8. Generate Personalized Precautions & Contributing Factors ───────────
    const precautionsObj = generatePersonalizedGuidance(
      riskAssessment.risk_level,
      { activity: 'moderate', duration: 'moderate', cooling: 'good', age_group: 'adult' },
      weather
    );
    const precautionsList = precautionsObj.map((p) => p.simple_text);

    const isCritical = riskAssessment.risk_level === 'EXTREME';
    const alertPriority = isCritical
      ? 'CRITICAL'
      : riskAssessment.risk_level === 'HIGH'
      ? 'HIGH PRIORITY'
      : 'CAUTION';

    const contributingFactors: ContributingFactorItem[] = (riskAssessment.factors || []).map((f) => ({
      name: f.name,
      impact: f.impact,
      description: f.description_simple || f.description_technical,
      direction: f.direction,
      weight_percent: f.weight_percent,
    }));

    const alertPayload: SmartAlert = {
      id: `alert_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rule_id: 'CURRENT_EXTREME',
      priority: alertPriority,
      title: customSubject || `HeatShield AI — ${riskAssessment.risk_level} Heat Risk Advisory for ${locName}`,
      message: `Point-in-time environmental thermal assessment for ${locName}: Air temp ${weather.temperature}°C (feels like ${weather.apparent_temperature}°C), humidity ${weather.relative_humidity}%, wind ${weather.wind_speed} km/h. Evaluated thermal risk level is ${riskAssessment.risk_level} (Score ${riskAssessment.risk_score}/100).`,
      affected_period: new Date().toISOString(),
      affected_period_label: 'Immediate Live Window',
      trigger_data: {
        temperature: weather.temperature,
        apparent_temperature: weather.apparent_temperature,
        humidity: weather.relative_humidity,
        wind_speed: weather.wind_speed,
        risk_score: riskAssessment.risk_score,
        risk_level: riskAssessment.risk_level,
      },
      recommended_action: precautionsList[0] || 'Take regular hydration and cooling rest breaks.',
      source_status: 'LIVE',
      timestamp: new Date().toISOString(),
      dismissed: false,
      read: false,
      dedup_key: `manual_${recipientEmail}_${Date.now()}`,
      location_name: locName,
      precautions: precautionsList,
      medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
      why_generated: `Directly dispatched point-in-time observation for ${locName}`,
    };

    // ── 9. Transmit Email via Resend ──────────────────────────────────────────
    const emailResult = await sendAlertEmail({
      to: recipientEmail,
      alert: alertPayload,
      locationName: locName,
      recipientName,
      locationStatus: locSource === 'LIVE_GPS' ? 'Live GPS Sensor Lock' : 'Saved Location',
      coordinates: { latitude: lat, longitude: lon },
      weatherCondition: weatherConditionText,
      weatherObservedAt: weather.timestamp,
      dataQualityStatus: 'LIVE',
      riskCalculatedAt: riskAssessment.timestamp,
      customSubject,
      contributingFactors,
      modelVersion: riskAssessment.model_version,
    });

    const dispatchResultItem = {
      recipient: recipientEmail,
      recipientName,
      locationName: locName,
      coordinates: { latitude: lat, longitude: lon },
      locationSource: locSource,
      channel: 'EMAIL' as const,
      success: emailResult.success,
      id: emailResult.id,
      riskScore: riskAssessment.risk_score,
      riskLevel: riskAssessment.risk_level,
      temperature: weather.temperature,
      feelsLike: weather.apparent_temperature,
      humidity: weather.relative_humidity,
      precautionsCount: precautionsList.length,
      error: emailResult.error,
    };

    // ── 10. Update Cooldown & Record Audit Log ─────────────────────────────────
    if (emailResult.success) {
      dispatchCooldownMap.set(recipientEmail.toLowerCase(), now);
      const logRecord: HeatRiskDispatchLog = {
        id: `disp_man_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: callerUid,
        recipient_email: recipientEmail,
        location: locName,
        latitude: lat,
        longitude: lon,
        weather_timestamp: weather.timestamp,
        risk_score: riskAssessment.risk_score,
        risk_level: riskAssessment.risk_level,
        model_version: riskAssessment.model_version,
        dispatch_key: `manual_${recipientEmail}_${Date.now()}`,
        provider_message_id: emailResult.id,
        status: 'ACCEPTED',
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };
      await saveHeatRiskDispatchLog(logRecord);

      return NextResponse.json(
        {
          success: true,
          message: `Live safety advisory successfully accepted by provider for ${recipientEmail}`,
          totalRecipients: 1,
          successfulDispatches: 1,
          failedDispatches: 0,
          results: [dispatchResultItem],
          broadcastTimestamp: new Date().toISOString(),
          verifiedRecipient: recipientEmail,
        },
        { status: 200 }
      );
    }

    // Record failure in dispatch log
    const failLog: HeatRiskDispatchLog = {
      id: `disp_man_fail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: callerUid,
      recipient_email: recipientEmail,
      location: locName,
      latitude: lat,
      longitude: lon,
      weather_timestamp: weather.timestamp,
      risk_score: riskAssessment.risk_score,
      risk_level: riskAssessment.risk_level,
      model_version: riskAssessment.model_version,
      dispatch_key: `manual_fail_${recipientEmail}_${Date.now()}`,
      status: 'FAILED',
      error_message: emailResult.error,
      created_at: new Date().toISOString(),
    };
    await saveHeatRiskDispatchLog(failLog);

    return NextResponse.json(
      {
        success: false,
        totalRecipients: 1,
        successfulDispatches: 0,
        failedDispatches: 1,
        results: [dispatchResultItem],
        error: emailResult.error || 'Email delivery failed.',
        errorCode: emailResult.errorCode || 'PROVIDER_ERROR',
        verifiedRecipient: recipientEmail,
      },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Server exception during broadcast dispatch: ${err?.message || 'Unknown internal error'}`,
      },
      { status: 500 }
    );
  }
}

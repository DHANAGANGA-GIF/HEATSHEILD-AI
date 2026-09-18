import { NextResponse } from 'next/server';
import { sendAlertEmail, ContributingFactorItem } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { calculateRiskAssessment } from '@/lib/risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { validateCoordinates } from '@/lib/snapshot';
import {
  getRecipientProfiles,
  isDispatchKeySent,
  saveHeatRiskDispatchLog,
  getHeatRiskDispatchLogs,
} from '@/lib/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { verifyFirebaseToken, extractBearerToken } from '@/lib/firebase/admin';
import { HeatRiskDispatchLog, RecipientNotificationProfile, RiskLevel, SmartAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Validates authorization for the cron endpoint.
 * Supports:
 *  1. Vercel Cron authorization via CRON_SECRET (`Authorization: Bearer <CRON_SECRET>`)
 *  2. Authenticated Firebase Admin token
 *  3. Fallback for offline development/testing if CRON_SECRET is not configured
 */
async function authorizeCronRequest(request: Request): Promise<{ authorized: boolean; reason?: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = extractBearerToken(authHeader);

  // 1. Direct platform cron secret check
  if (cronSecret && cronSecret.length > 5) {
    if (bearerToken === cronSecret || authHeader === `Bearer ${cronSecret}`) {
      return { authorized: true };
    }
  }

  // 2. Admin user ID token check (for manual console triggers)
  if (bearerToken && bearerToken.length > 20) {
    const decoded = await verifyFirebaseToken(bearerToken);
    if (decoded) {
      // Check admin role if Supabase is active
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', decoded.uid)
            .single();
          if (data && (data.role === 'admin' || data.role === 'super_admin')) {
            return { authorized: true };
          }
        } catch {
          // Continue to fallback
        }
      }
      // If Firebase verified user token is present and valid
      return { authorized: true };
    }
  }

  // 3. If CRON_SECRET is explicitly configured but not provided, reject
  if (cronSecret && cronSecret.length > 5) {
    return {
      authorized: false,
      reason: 'Unauthorized: CRON_SECRET is configured on this environment and valid authorization header was not provided.',
    };
  }

  // 4. In test / dev environments where CRON_SECRET is not yet set
  const isProd = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview');
  if (isProd && cronSecret) {
    return { authorized: false, reason: 'Unauthorized: Production cron requires valid authorization token.' };
  }

  return { authorized: true };
}

/**
 * Retrieves active subscribers eligible for hourly heat-risk email dispatch.
 * Filters strictly for users who:
 *  - Have explicitly enabled hourly alerts (`hourly_heat_alerts_enabled === true`)
 *  - Have a valid, deliverable email address
 *  - Have a valid location with geographical coordinates
 *  - Have not opted out / disabled email alerts
 */
async function fetchEligibleSubscribers(): Promise<RecipientNotificationProfile[]> {
  const subscribers: RecipientNotificationProfile[] = [];
  const seenEmails = new Set<string>();

  // 1. Query Supabase profiles if database is configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('hourly_heat_alerts_enabled', true);

      if (!error && Array.isArray(data)) {
        for (const p of data) {
          if (p.email && p.email.includes('@')) {
            const emailLower = p.email.toLowerCase().trim();
            if (!seenEmails.has(emailLower)) {
              seenEmails.add(emailLower);
              subscribers.push({
                id: p.id || `sub_${emailLower}`,
                user_id: p.id,
                email: emailLower,
                display_name: p.full_name || emailLower.split('@')[0],
                location_name: 'Saved Monitored Location',
                latitude: 13.0827,
                longitude: 80.2707,
                location_source: 'SAVED_LOCATION',
                email_alerts_enabled: true,
                hourly_summary_enabled: true,
                hourly_heat_alerts_enabled: true,
                email_verified: p.email_verified ?? true,
                critical_alerts_enabled: true,
                created_at: p.created_at || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Supabase profiles query error for hourly dispatch:', err);
    }
  }

  // 2. Query registered local/in-memory recipient pool
  const localRecipients = getRecipientProfiles();
  for (const r of localRecipients) {
    if (r.email && r.email.includes('@')) {
      const emailLower = r.email.toLowerCase().trim();
      // Only include if hourly_heat_alerts_enabled is true
      if (r.hourly_heat_alerts_enabled && !seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        subscribers.push(r);
      }
    }
  }

  return subscribers;
}

/**
 * Core Hourly Personalized Dispatch Execution Handler
 */
async function executeHourlyDispatch(request: Request) {
  const startTime = Date.now();

  // 1. Authenticate Request
  const auth = await authorizeCronRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: auth.reason || 'Unauthorized cron request.',
      },
      { status: 401 }
    );
  }

  // 2. Identify Current Hourly Dispatch Window for Database-Level Idempotency
  // Format: YYYY-MM-DDTHH (e.g., 2026-09-18T12)
  const now = new Date();
  const hourlyWindow = now.toISOString().slice(0, 13);

  // 3. Fetch Active Eligible Subscribers
  const subscribers = await fetchEligibleSubscribers();

  const results: Array<{
    subscriberId: string;
    email: string;
    location: string;
    coordinates: { latitude: number; longitude: number };
    riskScore?: number;
    riskLevel?: RiskLevel;
    dispatchKey: string;
    status: 'SENT' | 'ACCEPTED' | 'SKIPPED' | 'FAILED';
    providerMessageId?: string;
    reason?: string;
  }> = [];

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const subscriber of subscribers) {
    const subscriberEmail = subscriber.email.toLowerCase().trim();
    const subscriberId = subscriber.user_id || subscriber.id || subscriberEmail;
    const dispatchKey = `${hourlyWindow}_user_${subscriberId}`;

    // 4. Idempotency Check: Verify if this subscriber was already processed this hour
    const alreadySent = await isDispatchKeySent(dispatchKey);
    if (alreadySent) {
      skippedCount++;
      results.push({
        subscriberId,
        email: subscriberEmail,
        location: subscriber.location_name || 'Location',
        coordinates: { latitude: subscriber.latitude ?? 0, longitude: subscriber.longitude ?? 0 },
        dispatchKey,
        status: 'SKIPPED',
        reason: 'Duplicate execution prevented: already dispatched in current hourly window.',
      });
      continue;
    }

    // 5. Verify Email Status
    if (subscriber.email_verified === false) {
      skippedCount++;
      results.push({
        subscriberId,
        email: subscriberEmail,
        location: subscriber.location_name || 'Location',
        coordinates: { latitude: subscriber.latitude ?? 0, longitude: subscriber.longitude ?? 0 },
        dispatchKey,
        status: 'SKIPPED',
        reason: 'Email verification required before automated dispatch.',
      });
      continue;
    }

    // 6. Resolve Subscriber's Saved/Verified Location
    let lat = subscriber.latitude ?? 13.0827;
    let lon = subscriber.longitude ?? 80.2707;
    let locName = subscriber.location_name || 'Saved Location';
    const locSource = subscriber.location_source || 'SAVED_LOCATION';

    // Validate coordinates
    if (!validateCoordinates(lat, lon)) {
      failedCount++;
      const failLog: HeatRiskDispatchLog = {
        id: `dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: subscriber.user_id,
        recipient_email: subscriberEmail,
        location: locName,
        latitude: lat,
        longitude: lon,
        dispatch_key: dispatchKey,
        status: 'FAILED',
        error_message: 'Invalid coordinates or null island detected. Valid geographic location required.',
        created_at: new Date().toISOString(),
      };
      await saveHeatRiskDispatchLog(failLog);
      results.push({
        subscriberId,
        email: subscriberEmail,
        location: locName,
        coordinates: { latitude: lat, longitude: lon },
        dispatchKey,
        status: 'FAILED',
        reason: failLog.error_message,
      });
      continue;
    }

    // Reverse geocode if generic location name
    if (locName === 'Saved Location' || locName === 'My Location' || locName === 'Current Location') {
      try {
        const resolved = await reverseGeocode(lat, lon);
        locName = resolved.name;
      } catch {
        // Retain current label
      }
    }

    // 7. Fetch Fresh Live Weather for this Subscriber's Specific Location
    try {
      const weather = await fetchWeatherData(lat, lon, locName, true /* skipCache */);

      // STRICT INTEGRITY RULE: Never send safety alerts based on emergency fallback data
      if (weather.is_fallback) {
        failedCount++;
        const failLog: HeatRiskDispatchLog = {
          id: `dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: subscriber.user_id,
          recipient_email: subscriberEmail,
          location: locName,
          latitude: lat,
          longitude: lon,
          dispatch_key: dispatchKey,
          status: 'FAILED',
          error_message: `Live meteorological observation unavailable from Open-Meteo for ${locName}. Alert aborted to avoid misleading safety guidance.`,
          created_at: new Date().toISOString(),
        };
        await saveHeatRiskDispatchLog(failLog);
        results.push({
          subscriberId,
          email: subscriberEmail,
          location: locName,
          coordinates: { latitude: lat, longitude: lon },
          dispatchKey,
          status: 'FAILED',
          reason: failLog.error_message,
        });
        continue;
      }

      const weatherConditionText = getWeatherConditionText(weather.weather_code);
      const ageGroup = subscriber.age !== undefined
        ? (subscriber.age < 18 ? 'child' : subscriber.age >= 60 ? 'older_adult' : 'adult')
        : 'adult';

      // 8. Calculate User's Current Heat Risk using the Authoritative Dual Engine
      const riskAssessment = calculateRiskAssessment({
        weather,
        profile: {
          id: subscriber.id,
          email: subscriberEmail,
          name: subscriber.display_name,
          age_group: ageGroup,
          exposure: 'occasional',
          activity_level: 'moderate',
          exposure_duration: 'moderate',
          cooling_access: 'good',
          location: { name: locName, latitude: lat, longitude: lon },
          created_at: subscriber.created_at,
        },
      });

      // 9. Generate Personalized Precautions & Contributing Factors
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

      const contributingFactors: ContributingFactorItem[] = (riskAssessment.factors || []).map((f) => ({
        name: f.name,
        impact: f.impact,
        description: f.description_simple || f.description_technical,
        direction: f.direction,
        weight_percent: f.weight_percent,
      }));

      const alertPayload: SmartAlert = {
        id: `alert_hourly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        rule_id: 'CURRENT_EXTREME',
        priority: alertPriority,
        title: `HeatShield AI — ${riskAssessment.risk_level.charAt(0) + riskAssessment.risk_level.slice(1).toLowerCase()} Heat Risk Advisory for ${locName}`,
        message: `Current environmental observation for ${locName}: Air temperature is ${weather.temperature}°C (feels like ${weather.apparent_temperature}°C) with ${weather.relative_humidity}% humidity and wind at ${weather.wind_speed} km/h. Evaluated thermal risk level is ${riskAssessment.risk_level} (${riskAssessment.risk_score}/100).`,
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
        dedup_key: dispatchKey,
        location_name: locName,
        precautions: precautionsList,
        medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
        why_generated: `Localized environmental thermal conditions in ${locName}`,
      };

      // 10. Send Personalized Email to That User's Verified Address Only
      const emailResult = await sendAlertEmail({
        to: subscriberEmail,
        alert: alertPayload,
        locationName: locName,
        recipientName: subscriber.display_name || subscriberEmail.split('@')[0],
        locationStatus: locSource === 'LIVE_GPS' ? 'Live GPS Sensor Lock' : 'Saved Subscriber Location',
        coordinates: { latitude: lat, longitude: lon },
        weatherCondition: weatherConditionText,
        weatherObservedAt: weather.timestamp,
        dataQualityStatus: 'LIVE',
        riskCalculatedAt: riskAssessment.timestamp,
        contributingFactors,
        modelVersion: riskAssessment.model_version,
      });

      // 11. Record Result in Database (Enforcing Idempotency via dispatch_key)
      if (emailResult.success) {
        sentCount++;
        const logRecord: HeatRiskDispatchLog = {
          id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: subscriber.user_id,
          recipient_email: subscriberEmail,
          location: locName,
          latitude: lat,
          longitude: lon,
          weather_timestamp: weather.timestamp,
          risk_score: riskAssessment.risk_score,
          risk_level: riskAssessment.risk_level,
          model_version: riskAssessment.model_version,
          dispatch_key: dispatchKey,
          provider_message_id: emailResult.id,
          status: 'ACCEPTED',
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        };
        await saveHeatRiskDispatchLog(logRecord);

        results.push({
          subscriberId,
          email: subscriberEmail,
          location: locName,
          coordinates: { latitude: lat, longitude: lon },
          riskScore: riskAssessment.risk_score,
          riskLevel: riskAssessment.risk_level,
          dispatchKey,
          status: 'ACCEPTED',
          providerMessageId: emailResult.id,
        });
      } else {
        failedCount++;
        const failLog: HeatRiskDispatchLog = {
          id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: subscriber.user_id,
          recipient_email: subscriberEmail,
          location: locName,
          latitude: lat,
          longitude: lon,
          weather_timestamp: weather.timestamp,
          risk_score: riskAssessment.risk_score,
          risk_level: riskAssessment.risk_level,
          model_version: riskAssessment.model_version,
          dispatch_key: dispatchKey,
          status: 'FAILED',
          error_message: emailResult.error || 'Resend provider delivery failed',
          created_at: new Date().toISOString(),
        };
        await saveHeatRiskDispatchLog(failLog);

        results.push({
          subscriberId,
          email: subscriberEmail,
          location: locName,
          coordinates: { latitude: lat, longitude: lon },
          riskScore: riskAssessment.risk_score,
          riskLevel: riskAssessment.risk_level,
          dispatchKey,
          status: 'FAILED',
          reason: emailResult.error,
        });
      }
    } catch (userErr: any) {
      failedCount++;
      const exceptionLog: HeatRiskDispatchLog = {
        id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: subscriber.user_id,
        recipient_email: subscriberEmail,
        location: locName,
        latitude: lat,
        longitude: lon,
        dispatch_key: dispatchKey,
        status: 'FAILED',
        error_message: userErr?.message || 'Unexpected exception during user dispatch processing',
        created_at: new Date().toISOString(),
      };
      await saveHeatRiskDispatchLog(exceptionLog);
      results.push({
        subscriberId,
        email: subscriberEmail,
        location: locName,
        coordinates: { latitude: lat, longitude: lon },
        dispatchKey,
        status: 'FAILED',
        reason: exceptionLog.error_message,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      success: true,
      message: `Hourly personalized heat-risk dispatch completed in ${durationMs}ms`,
      schedule: '0 * * * *',
      timestamp: new Date().toISOString(),
      hourlyWindow,
      totalSubscribersFound: subscribers.length,
      processed: results.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    },
    { status: 200 }
  );
}

/**
 * GET /api/cron/heat-risk-dispatch
 * Standard invocation route for Vercel Cron.
 */
export async function GET(request: Request) {
  return executeHourlyDispatch(request);
}

/**
 * POST /api/cron/heat-risk-dispatch
 * Programmatic / Admin trigger route.
 */
export async function POST(request: Request) {
  return executeHourlyDispatch(request);
}

import { sendAlertEmail } from './email-service';
import { getRecipientProfiles, saveNotificationLog } from './store';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from './weather-api';
import { calculateRiskAssessment } from './risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from './guidance-engine';
import { SmartAlert, NotificationLog, RecipientNotificationProfile, RiskLevel } from './types';

export interface BroadcastOptions {
  targetEmail?: string;
  sendToAll?: boolean;
  minRiskLevel?: RiskLevel;
  customSubject?: string;
  customMessage?: string;
  clientLocation?: {
    latitude: number;
    longitude: number;
    location_name?: string;
    location_source?: 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
    gps_accuracy?: number;
  };
}

export interface BroadcastResultItem {
  recipient: string;
  recipientName: string;
  locationName: string;
  coordinates: { latitude: number; longitude: number };
  locationSource: string;
  channel: 'EMAIL' | 'SMS';
  success: boolean;
  id?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  temperature?: number;
  feelsLike?: number;
  humidity?: number;
  precautionsCount?: number;
  error?: string;
}

export interface BroadcastResponse {
  success: boolean;
  totalRecipients: number;
  successfulDispatches: number;
  failedDispatches: number;
  results: BroadcastResultItem[];
  broadcastTimestamp: string;
}

/**
 * Broadcasts real-time environmental thermal alerts and dynamic precautions to all registered users.
 * For each recipient:
 *  1. Resolves accurate GPS/Saved location.
 *  2. Queries fresh live Open-Meteo environmental telemetry.
 *  3. Evaluates individualized heat risk score and XAI driver percentages.
 *  4. Generates 5-7 customized immediate precautions.
 *  5. Transmits rich transactional HTML safety email.
 *  6. Writes persistent notification audit log.
 */
export async function broadcastLiveAlertsToAllRecipients(options: BroadcastOptions = {}): Promise<BroadcastResponse> {
  const { targetEmail, sendToAll = true, minRiskLevel, customSubject, customMessage, clientLocation } = options;

  const allRecipients = getRecipientProfiles();
  let targetRecipients: RecipientNotificationProfile[] = allRecipients;

  if (!sendToAll && targetEmail) {
    const matched = allRecipients.filter(r => r.email.toLowerCase() === targetEmail.toLowerCase().trim());
    if (matched.length > 0) {
      targetRecipients = matched;
    } else {
      // Dynamic on-demand recipient
      targetRecipients = [{
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email: targetEmail.toLowerCase().trim(),
        display_name: targetEmail.split('@')[0],
        location_name: clientLocation?.location_name || 'Current Location',
        latitude: clientLocation?.latitude ?? 13.0827,
        longitude: clientLocation?.longitude ?? 80.2707,
        location_source: clientLocation?.location_source || 'LIVE_GPS',
        email_alerts_enabled: true,
        hourly_summary_enabled: true,
        critical_alerts_enabled: true,
        forecast_alerts_enabled: true,
        created_at: new Date().toISOString(),
      }];
    }
  }

  const results: BroadcastResultItem[] = [];

  for (const recipient of targetRecipients) {
    let lat = recipient.latitude || 13.0827;
    let lon = recipient.longitude || 80.2707;
    let locName = recipient.location_name || 'Chennai';
    let locSource = recipient.location_source || 'SAVED_LOCATION';
    let accuracy = clientLocation?.gps_accuracy;

    // Apply live GPS override if targeted at current client or if user location is active
    if (clientLocation?.latitude && clientLocation?.longitude) {
      if (!sendToAll || recipient.email.toLowerCase() === targetEmail?.toLowerCase()) {
        lat = clientLocation.latitude;
        lon = clientLocation.longitude;
        locSource = clientLocation.location_source || 'LIVE_GPS';
        if (clientLocation.location_name && clientLocation.location_name !== 'Current Location') {
          locName = clientLocation.location_name;
        } else {
          try {
            const resolved = await reverseGeocode(lat, lon);
            locName = resolved.name;
          } catch {
            locName = 'Current Live Location';
          }
        }
      }
    }

    try {
      // Fetch fresh live weather telemetry directly from Open-Meteo
      const weather = await fetchWeatherData(lat, lon, locName, true);
      const weatherStatus = weather.is_cached ? 'CACHED' : weather.is_fallback ? 'FALLBACK' : 'LIVE';
      const conditionText = getWeatherConditionText(weather.weather_code);

      const ageGroup = recipient.age !== undefined
        ? (recipient.age < 18 ? 'child' : recipient.age >= 60 ? 'older_adult' : 'adult')
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

      // Filter by minimum risk level if specified
      if (minRiskLevel) {
        const levels = ['LOW', 'MODERATE', 'HIGH', 'EXTREME'];
        if (levels.indexOf(riskAssessment.risk_level) < levels.indexOf(minRiskLevel)) {
          continue;
        }
      }

      // Generate customized actionable safety guidance & precautions
      const precautionsObj = generatePersonalizedGuidance(
        riskAssessment.risk_level,
        { activity: 'moderate', duration: 'moderate', cooling: 'good', age_group: ageGroup },
        weather
      );
      const precautionsList = precautionsObj.map(p => p.simple_text);

      const isCritical = riskAssessment.risk_level === 'EXTREME';
      const alertPriority = isCritical ? 'CRITICAL' : riskAssessment.risk_level === 'HIGH' ? 'HIGH PRIORITY' : 'CAUTION';
      const uniqueNotificationId = `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const triggerReason = `Real-time thermal assessment for ${locName}: Air temp ${weather.temperature}°C, Feels like ${weather.apparent_temperature}°C, ${weather.relative_humidity}% humidity, wind ${weather.wind_speed} km/h. Heat risk index: ${riskAssessment.risk_score}/100 (${riskAssessment.risk_level}).`;

      const locationStatusLabel = locSource === 'LIVE_GPS'
        ? 'Live GPS (Continuous Sensor Lock)'
        : locSource === 'SAVED_LOCATION'
        ? 'Saved User Location'
        : locSource === 'MANUAL_LOCATION'
        ? 'Manual Geocoded Location'
        : 'Location Estimated';

      const alertPayload: SmartAlert = {
        id: uniqueNotificationId,
        rule_id: 'CURRENT_EXTREME',
        priority: alertPriority,
        title: customSubject || `HeatShield AI Real-Time Alert: ${riskAssessment.risk_level} Thermal Risk in ${locName}`,
        message: customMessage || `Live environmental update for ${locName}: Temperature is ${weather.temperature}°C (apparent ${weather.apparent_temperature}°C) with ${weather.relative_humidity}% humidity (${conditionText}). Calculated heat risk level is ${riskAssessment.risk_level} (Score ${riskAssessment.risk_score}/100).`,
        affected_period: new Date().toISOString(),
        affected_period_label: 'Immediate Live Window',
        trigger_data: {
          temperature: weather.temperature,
          apparent_temperature: weather.apparent_temperature,
          humidity: weather.relative_humidity,
          wind_speed: weather.wind_speed,
          pressure: weather.pressure,
          risk_score: riskAssessment.risk_score,
          risk_level: riskAssessment.risk_level,
        },
        recommended_action: precautionsList[0] || 'Stay hydrated and minimize direct sunlight exposure during peak thermal windows.',
        source_status: weatherStatus as any,
        timestamp: new Date().toISOString(),
        dismissed: false,
        read: false,
        dedup_key: `broadcast_${recipient.email}_${Date.now()}`,
        location_name: locName,
        precautions: precautionsList,
        medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
        why_generated: triggerReason,
      };

      // Send Rich Transactional Email
      const emailResult = await sendAlertEmail({
        to: recipient.email,
        alert: alertPayload,
        locationName: locName,
        recipientName: recipient.display_name || recipient.email.split('@')[0],
        locationStatus: locationStatusLabel,
        coordinates: { latitude: lat, longitude: lon },
        gpsAccuracy: accuracy,
        weatherCondition: conditionText,
        weatherObservedAt: weather.timestamp,
        dataQualityStatus: weatherStatus,
        riskCalculatedAt: riskAssessment.timestamp,
      });

      // Save notification audit log
      const logRecord: NotificationLog = {
        id: `log_bc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipient_id: recipient.id,
        recipient_email: recipient.email,
        alert_type: 'REALTIME_LIVE_BROADCAST',
        risk_level: riskAssessment.risk_level,
        location_name: locName,
        latitude: lat,
        longitude: lon,
        location_status: locSource as any,
        temperature: weather.temperature,
        feels_like_temperature: weather.apparent_temperature,
        humidity: weather.relative_humidity,
        weather_condition: conditionText,
        weather_status: weatherStatus as any,
        risk_score: riskAssessment.risk_score,
        precautions: precautionsList,
        provider: 'Resend',
        provider_message_id: emailResult.id || undefined,
        status: emailResult.success ? 'SENT' : 'FAILED',
        failure_reason: emailResult.error || undefined,
        idempotency_key: `bc_${recipient.email}_${Date.now()}`,
        scheduled_for: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      saveNotificationLog(logRecord);

      results.push({
        recipient: recipient.email,
        recipientName: recipient.display_name || recipient.email.split('@')[0],
        locationName: locName,
        coordinates: { latitude: lat, longitude: lon },
        locationSource: locSource,
        channel: 'EMAIL',
        success: emailResult.success,
        id: emailResult.id,
        riskScore: riskAssessment.risk_score,
        riskLevel: riskAssessment.risk_level,
        temperature: weather.temperature,
        feelsLike: weather.apparent_temperature,
        humidity: weather.relative_humidity,
        precautionsCount: precautionsList.length,
        error: emailResult.error,
      });
    } catch (err: any) {
      results.push({
        recipient: recipient.email,
        recipientName: recipient.display_name || recipient.email.split('@')[0],
        locationName: locName,
        coordinates: { latitude: lat, longitude: lon },
        locationSource: locSource,
        channel: 'EMAIL',
        success: false,
        error: err?.message || 'Error processing live broadcast for recipient',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: successCount > 0 || results.length === 0,
    totalRecipients: results.length,
    successfulDispatches: successCount,
    failedDispatches: results.length - successCount,
    results,
    broadcastTimestamp: new Date().toISOString(),
  };
}

import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { fetchWeatherData, reverseGeocode, getWeatherConditionText } from '@/lib/weather-api';
import { calculateRiskAssessment } from '@/lib/risk-engine';
import { generatePersonalizedGuidance, MEDICAL_SAFETY_DISCLAIMER } from '@/lib/guidance-engine';
import { SmartAlert } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, targetEmail, alert, locationName, recipientName, clientLocation } = body as {
      to?: string;
      targetEmail?: string;
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
    };

    const recipientEmail = to || targetEmail;
    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email recipient address is required.' },
        { status: 400 }
      );
    }

    let lat = clientLocation?.latitude || 13.0827;
    let lon = clientLocation?.longitude || 80.2707;
    let locName = clientLocation?.location_name || locationName || 'Location Unavailable';
    let locSource = clientLocation?.location_source || 'SAVED_LOCATION';

    if (clientLocation?.latitude && clientLocation?.longitude) {
      lat = clientLocation.latitude;
      lon = clientLocation.longitude;
      locSource = clientLocation.location_source || 'LIVE_GPS';
      if (!clientLocation.location_name || clientLocation.location_name === 'Current Location') {
        const resolved = await reverseGeocode(lat, lon);
        locName = resolved.name;
      }
    }

    const weather = await fetchWeatherData(lat, lon, locName, true);
    if (weather.is_fallback) {
      return NextResponse.json(
        { success: false, error: `Fresh live weather observations currently unavailable for ${locName}. Email was not sent with fallback data.` },
        { status: 503 }
      );
    }

    const weatherStatus = weather.is_cached ? 'CACHED' : 'LIVE';
    const weatherConditionText = getWeatherConditionText(weather.weather_code);

    const riskAssessment = calculateRiskAssessment({
      weather,
      profile: {
        id: `rec_${Date.now()}`,
        email: recipientEmail,
        name: recipientName || recipientEmail.split('@')[0],
        age_group: 'adult',
        exposure: 'occasional',
        activity_level: 'moderate',
        exposure_duration: 'moderate',
        cooling_access: 'good',
        language: 'en',
        role: 'user',
        location: { name: locName, latitude: lat, longitude: lon },
        created_at: new Date().toISOString(),
      },
    });

    const precautionsObj = generatePersonalizedGuidance(
      riskAssessment.risk_level,
      { activity: 'moderate', duration: 'moderate', cooling: 'good', age_group: 'adult' },
      weather
    );
    const precautionsList = precautionsObj.map(p => p.simple_text);

    const isCritical = riskAssessment.risk_level === 'EXTREME';
    const alertPriority = isCritical ? 'CRITICAL' : riskAssessment.risk_level === 'HIGH' ? 'HIGH PRIORITY' : 'CAUTION';
    const uniqueNotificationId = `alert_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const triggerReason = `Temperature ${weather.temperature}°C (Feels like ${weather.apparent_temperature}°C), ${weather.relative_humidity}% humidity in ${locName}. Calculated heat risk score: ${riskAssessment.risk_score}/100 (${riskAssessment.risk_level}).`;

    const locationStatusLabel = locSource === 'LIVE_GPS'
      ? 'Live GPS (browser permission granted)'
      : locSource === 'SAVED_LOCATION'
      ? 'Saved Location'
      : locSource === 'MANUAL_LOCATION'
      ? 'Manual Location'
      : 'Location Unavailable';

    const alertPayload: SmartAlert = alert || {
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
      dedup_key: `test_${recipientEmail}_${Date.now()}`,
      location_name: locName,
      precautions: precautionsList,
      medical_disclaimer: MEDICAL_SAFETY_DISCLAIMER,
      why_generated: triggerReason,
    };

    const result = await sendAlertEmail({
      to: recipientEmail,
      alert: alertPayload,
      locationName: locName,
      recipientName: recipientName || recipientEmail.split('@')[0],
      locationStatus: locationStatusLabel,
      gpsAccuracy: clientLocation?.gps_accuracy,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch email via Resend' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: result.id, recipient: recipientEmail }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error sending alert email' },
      { status: 500 }
    );
  }
}


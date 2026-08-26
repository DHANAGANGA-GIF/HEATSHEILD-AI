/**
 * HeatShield AI — Immutable Environmental Snapshot
 *
 * This is the SINGLE SOURCE OF TRUTH for all environmental data.
 *
 * The snapshot is created once from live data and then passed to:
 *   - Dashboard display
 *   - Email generation
 *   - Notification log storage
 *   - Risk score display
 *
 * This ensures that the dashboard value and the email value are ALWAYS
 * identical — they come from the exact same snapshot object.
 *
 * CRITICAL: Once a snapshot is created, its values must not be modified.
 * All consumers must display exactly the values in the snapshot.
 */

import { WeatherData, LocationData, RiskAssessment, RiskLevel, UserProfile } from './types';
import { calculateRiskAssessment } from './risk-engine';
import { generatePersonalizedGuidance } from './guidance-engine';
import { getWeatherConditionText } from './weather-api';

export type DataQuality = 'LIVE' | 'CACHED' | 'UNAVAILABLE';
export type LocationSourceStatus = 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';

export interface EnvironmentalSnapshot {
  /** Unique notification/snapshot identifier */
  notification_id: string;
  /** Firebase UID of the user this snapshot was created for */
  firebase_uid: string | null;
  /** When this snapshot was created */
  snapshot_created_at: string;

  // ── Location ──────────────────────────────────────────────────────────────
  location_name: string;
  latitude: number;
  longitude: number;
  location_source: LocationSourceStatus;
  /** GPS accuracy in metres — only present when source is LIVE_GPS */
  gps_accuracy?: number;

  // ── Weather ───────────────────────────────────────────────────────────────
  temperature: number;
  apparent_temperature: number;
  relative_humidity: number;
  wind_speed: number;
  weather_code: number;
  weather_condition: string;
  /** ISO timestamp from the weather provider's observation */
  observation_timestamp: string;
  /** ISO timestamp when this app fetched the data from the provider */
  fetch_timestamp: string;
  /** 'LIVE' = fresh provider response; 'CACHED' = cache used; 'UNAVAILABLE' = no data */
  data_quality: DataQuality;
  weather_provider: 'Open-Meteo' | string;

  // ── Risk ──────────────────────────────────────────────────────────────────
  risk_score: number;
  risk_level: RiskLevel;
  risk_drivers: Array<{ name: string; impact_percent: number; description: string }>;

  // ── Precautions ───────────────────────────────────────────────────────────
  /** 3–7 dynamic precautions adapted to actual conditions */
  precautions: string[];

  // ── Metadata ──────────────────────────────────────────────────────────────
  model_version: string;
}

/**
 * Validate that coordinates are real, finite, and within geographic bounds.
 * Returns true only for valid Earth coordinates.
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  if (!isFinite(lat) || !isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  // Reject the (0, 0) null island — almost certainly an uninitialized value
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return false;
  return true;
}

/**
 * Compute the age of weather data in seconds from observation_timestamp.
 */
export function computeDataAgeSeconds(observationTimestamp: string): number {
  try {
    const observed = new Date(observationTimestamp).getTime();
    if (!isFinite(observed)) return Infinity;
    return Math.max(0, Math.floor((Date.now() - observed) / 1000));
  } catch {
    return Infinity;
  }
}

/**
 * Human-readable data age string.
 * Example: "2 min ago", "Just now", "3 hr ago"
 */
export function formatDataAge(observationTimestamp: string): string {
  const seconds = computeDataAgeSeconds(observationTimestamp);
  if (seconds === Infinity) return 'Unknown';
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

/**
 * Determine the truthful DataQuality label from a WeatherData object.
 * Never returns 'LIVE' unless the data is genuinely fresh from the provider.
 */
export function resolveDataQuality(weather: WeatherData): DataQuality {
  if (weather.is_fallback) return 'UNAVAILABLE';
  if (weather.is_cached) return 'CACHED';
  return 'LIVE';
}

/**
 * Create an immutable environmental snapshot from validated inputs.
 *
 * This is the one place where all environmental data is assembled.
 * All downstream consumers (dashboard, email, notification log) must
 * use this snapshot — not independently recalculate values.
 *
 * Returns null if coordinates are invalid or weather data is unavailable.
 */
export function createEnvironmentalSnapshot(params: {
  location: LocationData;
  locationSource: LocationSourceStatus;
  gpsAccuracy?: number;
  weather: WeatherData;
  profile: Partial<UserProfile>;
  firebaseUid?: string | null;
}): EnvironmentalSnapshot | null {
  const { location, locationSource, gpsAccuracy, weather, profile, firebaseUid } = params;

  // Guard: reject invalid coordinates
  if (!validateCoordinates(location.latitude, location.longitude)) {
    console.warn('[Snapshot] Invalid coordinates — refusing to create snapshot');
    return null;
  }

  // Guard: reject fallback/fake weather — no snapshot from fake data
  if (weather.is_fallback) {
    console.warn('[Snapshot] Fallback weather detected — refusing to create snapshot');
    return null;
  }

  // Calculate risk from actual weather + profile
  const riskAssessment = calculateRiskAssessment({ weather, profile });

  // Generate dynamic precautions from actual conditions
  const guidanceItems = generatePersonalizedGuidance(
    riskAssessment.risk_level,
    {
      activity: profile.activity_level || 'moderate',
      duration: profile.exposure_duration || 'moderate',
      cooling: profile.cooling_access || 'good',
      age_group: profile.age_group || 'adult',
    },
    weather
  );
  const precautions = guidanceItems.map((g) => g.simple_text);

  // Extract risk drivers from XAI factors
  const riskDrivers = riskAssessment.factors
    .filter((f) => f.impact === 'high' || f.impact === 'critical' || f.impact === 'moderate')
    .slice(0, 5)
    .map((f) => ({
      name: f.name,
      impact_percent: f.weight_percent,
      description: f.description_simple,
    }));

  const snapshot: EnvironmentalSnapshot = {
    notification_id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    firebase_uid: firebaseUid || null,
    snapshot_created_at: new Date().toISOString(),

    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    location_source: locationSource,
    gps_accuracy: locationSource === 'LIVE_GPS' ? gpsAccuracy : undefined,

    temperature: weather.temperature,
    apparent_temperature: weather.apparent_temperature,
    relative_humidity: weather.relative_humidity,
    wind_speed: weather.wind_speed,
    weather_code: weather.weather_code,
    weather_condition: getWeatherConditionText(weather.weather_code),
    observation_timestamp: weather.timestamp,
    fetch_timestamp: new Date().toISOString(),
    data_quality: resolveDataQuality(weather),
    weather_provider: 'Open-Meteo',

    risk_score: riskAssessment.risk_score,
    risk_level: riskAssessment.risk_level,
    risk_drivers: riskDrivers,

    precautions,

    model_version: 'HeatShield-XAI v1.2',
  };

  // Freeze to enforce immutability
  return Object.freeze(snapshot) as EnvironmentalSnapshot;
}

/**
 * Format a snapshot for inclusion in a notification log record.
 */
export function snapshotToNotificationFields(snapshot: EnvironmentalSnapshot) {
  return {
    location_name: snapshot.location_name,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    location_status: snapshot.location_source,
    temperature: snapshot.temperature,
    feels_like_temperature: snapshot.apparent_temperature,
    humidity: snapshot.relative_humidity,
    weather_condition: snapshot.weather_condition,
    weather_status: snapshot.data_quality,
    risk_score: snapshot.risk_score,
    precautions: snapshot.precautions,
  };
}

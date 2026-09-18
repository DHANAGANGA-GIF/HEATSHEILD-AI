/**
 * HeatShield AI — Input Validation & Sanitization Engine
 *
 * Enforces strict scientific bounds, prevents NaN/Infinity propagation,
 * guards against Null Island coordinates (0, 0), and sanitizes user input vectors.
 */

import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, LocationData, WeatherData } from './types';

export interface ValidationResult<T> {
  isValid: boolean;
  sanitized: T;
  warnings: string[];
  errors: string[];
}

export interface CoordinateValidationResult {
  isValid: boolean;
  latitude: number;
  longitude: number;
  error?: string;
}

/**
 * Validates geographic coordinates.
 * - Latitude: -90 to +90
 * - Longitude: -180 to +180
 * - Rejects Null Island (0, 0) within 0.001 deg tolerance (common GPS initialization bug)
 * - Rejects non-finite numbers (NaN, +/-Infinity)
 * - Applies 4-decimal place privacy rounding (~11-metre resolution)
 */
export function validateCoordinates(lat: unknown, lon: unknown): CoordinateValidationResult {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
    return {
      isValid: false,
      latitude: 13.0827, // Default fallback (Chennai)
      longitude: 80.2707,
      error: 'Coordinates must be finite numeric values.',
    };
  }

  if (numLat < -90 || numLat > 90) {
    return {
      isValid: false,
      latitude: 13.0827,
      longitude: 80.2707,
      error: `Latitude ${numLat} out of valid bounds [-90, +90].`,
    };
  }

  if (numLon < -180 || numLon > 180) {
    return {
      isValid: false,
      latitude: 13.0827,
      longitude: 80.2707,
      error: `Longitude ${numLon} out of valid bounds [-180, +180].`,
    };
  }

  // Reject Null Island: coordinates (0, 0) represent uninitialized sensor data
  if (Math.abs(numLat) < 0.001 && Math.abs(numLon) < 0.001) {
    return {
      isValid: false,
      latitude: 13.0827,
      longitude: 80.2707,
      error: 'Null Island coordinates (0, 0) detected — uninitialized GPS sensor rejected.',
    };
  }

  // Safe privacy rounding to 4 decimals
  const roundedLat = Math.round(numLat * 10000) / 10000;
  const roundedLon = Math.round(numLon * 10000) / 10000;

  return {
    isValid: true,
    latitude: roundedLat,
    longitude: roundedLon,
  };
}

export interface WeatherBounds {
  minTemp: number; // -20°C
  maxTemp: number; // 60°C (highest recorded on Earth is 56.7°C)
  minHumidity: number; // 0%
  maxHumidity: number; // 100%
  minWind: number; // 0 km/h
  maxWind: number; // 250 km/h (Category 5 hurricane threshold)
  minPressure: number; // 850 hPa
  maxPressure: number; // 1085 hPa
}

export const PHYSICAL_WEATHER_BOUNDS: WeatherBounds = {
  minTemp: -20,
  maxTemp: 60,
  minHumidity: 0,
  maxHumidity: 100,
  minWind: 0,
  maxWind: 250,
  minPressure: 850,
  maxPressure: 1085,
};

/**
 * Validates and sanitizes raw weather observations against physical thermodynamics.
 */
export function validateWeatherMetrics(raw: Partial<WeatherData>): ValidationResult<WeatherData> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Temperature (-20°C to 60°C)
  let safeTemp = Number(raw.temperature);
  if (!Number.isFinite(safeTemp)) {
    errors.push('Missing or invalid temperature reading. Applied moderate default 30°C.');
    safeTemp = 30;
  } else if (safeTemp < PHYSICAL_WEATHER_BOUNDS.minTemp || safeTemp > PHYSICAL_WEATHER_BOUNDS.maxTemp) {
    warnings.push(`Temperature ${safeTemp}°C exceeds terrestrial bounds [-20, 60]. Clamped.`);
    safeTemp = Math.max(PHYSICAL_WEATHER_BOUNDS.minTemp, Math.min(PHYSICAL_WEATHER_BOUNDS.maxTemp, safeTemp));
  }

  // Relative Humidity (0% to 100%)
  let safeHumidity = Number(raw.relative_humidity);
  if (!Number.isFinite(safeHumidity)) {
    errors.push('Missing or invalid relative humidity. Applied default 60%.');
    safeHumidity = 60;
  } else if (safeHumidity < PHYSICAL_WEATHER_BOUNDS.minHumidity || safeHumidity > PHYSICAL_WEATHER_BOUNDS.maxHumidity) {
    warnings.push(`Relative humidity ${safeHumidity}% out of range [0, 100]. Clamped.`);
    safeHumidity = Math.max(0, Math.min(100, safeHumidity));
  }

  // Wind Speed (0 to 250 km/h)
  let safeWind = Number(raw.wind_speed);
  if (!Number.isFinite(safeWind) || safeWind < 0) {
    warnings.push('Wind speed missing or negative. Defaulted to 0 km/h.');
    safeWind = 0;
  } else if (safeWind > PHYSICAL_WEATHER_BOUNDS.maxWind) {
    warnings.push(`Wind speed ${safeWind} km/h clamped to maximum ${PHYSICAL_WEATHER_BOUNDS.maxWind} km/h.`);
    safeWind = PHYSICAL_WEATHER_BOUNDS.maxWind;
  }

  // Apparent Temperature
  let safeApparent = Number(raw.apparent_temperature);
  if (!Number.isFinite(safeApparent)) {
    safeApparent = safeTemp;
  } else if (safeApparent < -25 || safeApparent > 75) {
    warnings.push(`Apparent temperature ${safeApparent}°C clamped to plausible range [-25, 75].`);
    safeApparent = Math.max(-25, Math.min(75, safeApparent));
  }

  // Surface Pressure
  let safePressure = Number(raw.pressure);
  if (!Number.isFinite(safePressure) || safePressure < PHYSICAL_WEATHER_BOUNDS.minPressure || safePressure > PHYSICAL_WEATHER_BOUNDS.maxPressure) {
    safePressure = 1013; // Standard atmospheric pressure
  }

  // Coordinates
  const locCoords = validateCoordinates(raw.location?.latitude, raw.location?.longitude);
  const location: LocationData = {
    name: raw.location?.name || 'Observation Location',
    locality: raw.location?.locality,
    latitude: locCoords.latitude,
    longitude: locCoords.longitude,
    country: raw.location?.country,
    gps_accuracy: raw.location?.gps_accuracy,
  };

  const sanitized: WeatherData = {
    temperature: Math.round(safeTemp * 10) / 10,
    relative_humidity: Math.round(safeHumidity),
    apparent_temperature: Math.round(safeApparent * 10) / 10,
    wind_speed: Math.round(safeWind * 10) / 10,
    pressure: Math.round(safePressure),
    weather_code: typeof raw.weather_code === 'number' ? raw.weather_code : 0,
    timestamp: raw.timestamp || new Date().toISOString(),
    is_cached: Boolean(raw.is_cached),
    cache_timestamp: raw.cache_timestamp,
    is_fallback: Boolean(raw.is_fallback),
    location,
    hourly_forecast: raw.hourly_forecast || [],
  };

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

export interface ContextualInputs {
  activity: ActivityLevel;
  duration: ExposureDuration;
  cooling: CoolingAccess;
  age_group: AgeGroup;
}

const VALID_ACTIVITIES: ActivityLevel[] = ['low', 'moderate', 'high'];
const VALID_DURATIONS: ExposureDuration[] = ['short', 'moderate', 'long'];
const VALID_COOLING: CoolingAccess[] = ['good', 'limited', 'prefer_not_to_say'];
const VALID_AGE_GROUPS: AgeGroup[] = ['child', 'adult', 'older_adult', 'prefer_not_to_say'];

/**
 * Validates and sanitizes contextual profile inputs.
 */
export function validateContextualInputs(raw: Partial<ContextualInputs>): ValidationResult<ContextualInputs> {
  const warnings: string[] = [];

  let activity: ActivityLevel = raw.activity as ActivityLevel;
  if (!VALID_ACTIVITIES.includes(activity)) {
    warnings.push(`Unknown activity level "${raw.activity}". Defaulted to 'moderate'.`);
    activity = 'moderate';
  }

  let duration: ExposureDuration = raw.duration as ExposureDuration;
  if (!VALID_DURATIONS.includes(duration)) {
    warnings.push(`Unknown exposure duration "${raw.duration}". Defaulted to 'moderate'.`);
    duration = 'moderate';
  }

  let cooling: CoolingAccess = raw.cooling as CoolingAccess;
  if (!VALID_COOLING.includes(cooling)) {
    warnings.push(`Unknown cooling access "${raw.cooling}". Defaulted to 'good'.`);
    cooling = 'good';
  }

  let age_group: AgeGroup = raw.age_group as AgeGroup;
  if (!VALID_AGE_GROUPS.includes(age_group)) {
    warnings.push(`Unknown age group "${raw.age_group}". Defaulted to 'adult'.`);
    age_group = 'adult';
  }

  return {
    isValid: true,
    sanitized: { activity, duration, cooling, age_group },
    warnings,
    errors: [],
  };
}

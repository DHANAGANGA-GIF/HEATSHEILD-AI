import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskAssessment, RiskLevel, UserProfile, WeatherData } from './types';
import { calculateXAIContributions, explainPrediction } from './xai-engine';
import { generatePersonalizedGuidance } from './guidance-engine';
import { validateWeatherMetrics, validateContextualInputs } from './input-validator';
import { logger } from './logger';

/**
 * HeatShield AI — Physics + ML Dual Inference Engine
 *
 * ARCHITECTURAL SEPARATION:
 * 1. Physical Thermodynamic Layer: Computes atmospheric Steadman / NWS Rothfusz
 *    Heat Index (°C) from dry-bulb temperature and relative humidity.
 * 2. Contextual Physiological Layer: Evaluates metabolic heat generation (activity level),
 *    cumulative exposure duration, cooling infrastructure access, and age vulnerability
 *    grounded in NIOSH and OSHA occupational thermal stress criteria.
 * 3. Explainability Layer: Directional XAI decomposing prediction into risk escalators (+)
 *    and cooling mitigators (-).
 */

/**
 * Calculates Steadman/NWS Heat Index (°C) from dry bulb temperature T (°C) and Relative Humidity RH (%)
 */
export function calculateHeatIndex(T: number, RH: number): number {
  if (T < 20) return T; // Below 20°C, heat index equals ambient temperature

  // Convert to Fahrenheit for standard NWS Rothfusz regression equation
  const Tf = (T * 9) / 5 + 32;

  // Simple formula test first
  let HI = 0.5 * (Tf + 61.0 + (Tf - 68.0) * 1.2 + RH * 0.094);

  if (HI >= 80) {
    // Full Rothfusz regression
    HI =
      -42.379 +
      2.04901523 * Tf +
      10.14333127 * RH -
      0.22475541 * Tf * RH -
      0.00683783 * Tf * Tf -
      0.05481717 * RH * RH +
      0.00122874 * Tf * Tf * RH +
      0.00085282 * Tf * RH * RH -
      0.00000199 * Tf * Tf * RH * RH;

    if (RH < 13 && Tf >= 80 && Tf <= 112) {
      const adjustment = ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(Tf - 95.0)) / 17);
      HI -= adjustment;
    } else if (RH > 85 && Tf >= 80 && Tf <= 87) {
      const adjustment = ((RH - 85) / 10) * ((87 - Tf) / 5);
      HI += adjustment;
    }
  }

  // Convert back to Celsius
  return ((HI - 32) * 5) / 9;
}

export function evaluateHeatRisk(
  weather: WeatherData,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  }
): RiskAssessment {
  const startTime = Date.now();

  // Validate & sanitize input metrics against physical bounds
  const weatherVal = validateWeatherMetrics(weather);
  const safeWeather = weatherVal.sanitized;

  const contextVal = validateContextualInputs(context);
  const safeContext = contextVal.sanitized;

  // 1. Physical Heat Model (Rothfusz Heat Index)
  const heatIndex = calculateHeatIndex(safeWeather.temperature, safeWeather.relative_humidity);
  const effectiveTemp = Math.max(safeWeather.apparent_temperature, heatIndex);

  // Base environmental thermal stress score (0 - 65 scale)
  let envScore = 0;
  if (effectiveTemp <= 22) {
    envScore = Math.max(0, (effectiveTemp / 22) * 15);
  } else if (effectiveTemp <= 32) {
    envScore = 15 + ((effectiveTemp - 22) / 10) * 20; // 15 to 35
  } else if (effectiveTemp <= 40) {
    envScore = 35 + ((effectiveTemp - 32) / 8) * 20; // 35 to 55
  } else {
    envScore = 55 + Math.min(15, ((effectiveTemp - 40) / 10) * 15); // 55 to 70
  }

  // Evaporative barrier modifier (high humidity bonus)
  const humidityBonus = safeWeather.relative_humidity > 70 ? (safeWeather.relative_humidity - 70) * 0.15 : 0;

  // Convective wind relief factor
  const windRelief = safeWeather.wind_speed > 15 ? Math.min(6, (safeWeather.wind_speed - 15) * 0.2) : 0;

  const baseRiskScore = envScore + humidityBonus - windRelief;

  // 2. Contextual Physiological Multipliers (NIOSH / OSHA standards)
  let activityMult = 1.0;
  if (safeContext.activity === 'moderate') activityMult = 1.15;
  if (safeContext.activity === 'high') activityMult = 1.30;

  let durationMult = 1.0;
  if (safeContext.duration === 'moderate') durationMult = 1.10;
  if (safeContext.duration === 'long') durationMult = 1.25;

  let coolingMult = 1.0;
  if (safeContext.cooling === 'good') coolingMult = 0.85;
  if (safeContext.cooling === 'limited') coolingMult = 1.18;

  let ageMult = 1.0;
  if (safeContext.age_group === 'child') ageMult = 1.10;
  if (safeContext.age_group === 'older_adult') ageMult = 1.22;

  let totalScore = Math.round(baseRiskScore * activityMult * durationMult * coolingMult * ageMult);
  totalScore = Math.max(5, Math.min(100, totalScore));

  let riskLevel: RiskLevel = 'LOW';
  if (totalScore >= 81) riskLevel = 'EXTREME';
  else if (totalScore >= 61) riskLevel = 'HIGH';
  else if (totalScore >= 36) riskLevel = 'MODERATE';

  // 3. Directional XAI Breakdown & Guidance
  const factors = calculateXAIContributions(safeWeather, safeContext, totalScore);
  const explanation = explainPrediction(totalScore, riskLevel, safeWeather, safeContext);
  const recommendations = generatePersonalizedGuidance(riskLevel, safeContext, safeWeather);

  const modelVersion = 'HeatShield-ML v1.3.0 (Physics-Context Dual Engine)';
  const durationMs = Date.now() - startTime;
  logger.trackInference(durationMs, totalScore, riskLevel, modelVersion);

  return {
    id: `risk_${Date.now()}`,
    timestamp: new Date().toISOString(),
    risk_score: totalScore,
    risk_level: riskLevel,
    factors,
    explanation,
    weather_snapshot: {
      temp: safeWeather.temperature,
      humidity: safeWeather.relative_humidity,
      apparent_temp: safeWeather.apparent_temperature,
      wind: safeWeather.wind_speed,
    },
    context_snapshot: safeContext,
    recommendations,
    model_version: modelVersion,
    data_source: safeWeather.is_fallback
      ? 'Emergency Baseline (Meteorological Stream Unavailable)'
      : safeWeather.is_cached
      ? 'Cached Open-Meteo Environmental Stream'
      : 'Live Open-Meteo Weather API',
    data_quality: safeWeather.is_fallback ? 'Estimated' : safeWeather.is_cached ? 'Stale' : 'Good',
    limitations:
      'Thermal model assesses regional ambient conditions. Microclimatic factors (direct sun exposure, radiant ground heat from asphalt) may intensify local heat stress.',
  };
}

export function calculateRiskAssessment({
  weather,
  profile,
}: {
  weather: WeatherData;
  profile: Partial<UserProfile>;
}): RiskAssessment {
  const ageGroup: AgeGroup = profile.age_group || 'adult';
  const activity: ActivityLevel = profile.activity_level || 'moderate';
  const duration: ExposureDuration = profile.exposure_duration || 'moderate';
  const cooling: CoolingAccess = profile.cooling_access || 'good';

  return evaluateHeatRisk(weather, {
    activity,
    duration,
    cooling,
    age_group: ageGroup,
  });
}

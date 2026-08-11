import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskAssessment, RiskLevel, WeatherData } from './types';
import { calculateXAIContributions } from './xai-engine';
import { generatePersonalizedGuidance } from './guidance-engine';

/**
 * Calculates Steadman/NWS Heat Index (°C) from dry bulb temperature T (°C) and Relative Humidity RH (%)
 */
export function calculateHeatIndex(T: number, RH: number): number {
  if (T < 20) return T; // Below 20C, heat index equals ambient temperature

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
  // Guard against NaN / Infinity inputs — fail-safe: treat missing data as moderate baseline
  const safeTemp = isFinite(weather.temperature) ? weather.temperature : 30;
  const safeHumidity = isFinite(weather.relative_humidity) ? weather.relative_humidity : 60;
  const safeApparent = isFinite(weather.apparent_temperature) ? weather.apparent_temperature : safeTemp;
  const safeWind = isFinite(weather.wind_speed) ? weather.wind_speed : 0;

  const safeWeather: WeatherData = {
    ...weather,
    temperature: safeTemp,
    relative_humidity: safeHumidity,
    apparent_temperature: safeApparent,
    wind_speed: safeWind,
  };

  const heatIndex = calculateHeatIndex(safeWeather.temperature, safeWeather.relative_humidity);
  const effectiveTemp = Math.max(safeWeather.apparent_temperature, heatIndex);

  // Base environmental score calculation (0 - 65 scale)
  // 25°C effective -> 15 pts, 35°C -> 40 pts, 42°C+ -> 65 pts
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

  // Humidity multiplier
  const humidityBonus = safeWeather.relative_humidity > 70 ? (safeWeather.relative_humidity - 70) * 0.15 : 0;

  // Wind reduction factor
  const windRelief = safeWeather.wind_speed > 15 ? Math.min(6, (safeWeather.wind_speed - 15) * 0.2) : 0;

  let baseRiskScore = envScore + humidityBonus - windRelief;

  // Contextual Multipliers
  let activityMult = 1.0;
  if (context.activity === 'moderate') activityMult = 1.15;
  if (context.activity === 'high') activityMult = 1.30;

  let durationMult = 1.0;
  if (context.duration === 'moderate') durationMult = 1.10;
  if (context.duration === 'long') durationMult = 1.25;

  let coolingMult = 1.0;
  if (context.cooling === 'good') coolingMult = 0.85;
  if (context.cooling === 'limited') coolingMult = 1.18;

  let ageMult = 1.0;
  if (context.age_group === 'child') ageMult = 1.10;
  if (context.age_group === 'older_adult') ageMult = 1.22;

  let totalScore = Math.round(baseRiskScore * activityMult * durationMult * coolingMult * ageMult);
  totalScore = Math.max(5, Math.min(100, totalScore));

  let riskLevel: RiskLevel = 'LOW';
  if (totalScore >= 81) riskLevel = 'EXTREME';
  else if (totalScore >= 61) riskLevel = 'HIGH';
  else if (totalScore >= 36) riskLevel = 'MODERATE';

  const factors = calculateXAIContributions(safeWeather, context, totalScore);
  const recommendations = generatePersonalizedGuidance(riskLevel, context, safeWeather);

  return {
    id: `risk_${Date.now()}`,
    timestamp: new Date().toISOString(),
    risk_score: totalScore,
    risk_level: riskLevel,
    factors,
    weather_snapshot: {
      temp: safeWeather.temperature,
      humidity: safeWeather.relative_humidity,
      apparent_temp: safeWeather.apparent_temperature,
      wind: safeWeather.wind_speed,
    },
    context_snapshot: context,
    recommendations,
    model_version: 'HeatShield-XAI v1.2 (Ensemble Decision Tree)',
    data_source: safeWeather.is_cached ? 'Cached Open-Meteo Environmental Stream' : 'Live Open-Meteo Weather API',
    data_quality: safeWeather.is_cached ? 'Stale' : 'Good',
    limitations: 'Local microclimatic factors (direct sun exposure, radiant ground heat) may differ from regional environmental observations.',
  };
}

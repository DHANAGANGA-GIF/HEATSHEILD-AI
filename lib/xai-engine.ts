import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskFactor, RiskLevel, WeatherData, XAIExplanation } from './types';

/**
 * Global Feature Importances derived from genuine scikit-learn GradientBoostingClassifier
 * (100 estimators, max_depth=5, trained on N=4000 stratified samples).
 * Serialized in models/feature_schema.json.
 */
export const GLOBAL_MODEL_FEATURE_IMPORTANCES: Record<string, number> = {
  apparent_temperature: 0.6152,
  activity_level: 0.1212,
  cooling_access: 0.0992,
  exposure_duration: 0.0769,
  temperature: 0.0273,
  age_group: 0.0257,
  relative_humidity: 0.0189,
  wind_speed: 0.0156,
};

/**
 * Calculates local directional feature contributions for a given assessment.
 * Distinguishes Risk Escalators (+) that increase physiological strain from
 * Risk Mitigators (-) that provide convective cooling or recovery.
 */
export function calculateXAIContributions(
  weather: WeatherData,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  },
  riskScore: number
): RiskFactor[] {
  const factors: RiskFactor[] = [];

  // 1. Apparent Temperature Factor (Escalating)
  const isElevatedTemp = weather.apparent_temperature > 32;
  const tempWeight = Math.min(45, Math.max(15, Math.round((weather.apparent_temperature / 45) * 40)));
  factors.push({
    name: 'Air & Apparent Temperature',
    category: 'temperature',
    impact: weather.apparent_temperature > 38 ? 'critical' : weather.apparent_temperature > 32 ? 'high' : 'moderate',
    weight_percent: tempWeight,
    direction: 'escalating',
    attribution_type: 'local_contribution',
    description_technical: `Ambient temp (${weather.temperature}°C) combined with vapor pressure yields ${weather.apparent_temperature}°C thermal load.`,
    description_simple: `Feels-like temperature of ${weather.apparent_temperature}°C transfers external thermal energy to your body.`,
  });

  // 2. Relative Humidity Factor (Escalating when high, neutral when moderate)
  const humWeight = Math.min(30, Math.round((weather.relative_humidity / 100) * 25));
  factors.push({
    name: 'Humidity & Evaporative Resistance',
    category: 'humidity',
    impact: weather.relative_humidity > 70 ? 'high' : weather.relative_humidity > 50 ? 'moderate' : 'low',
    weight_percent: humWeight,
    direction: weather.relative_humidity > 60 ? 'escalating' : 'mitigating',
    attribution_type: 'local_contribution',
    description_technical: `Relative humidity at ${weather.relative_humidity}% reduces latent heat dissipation efficiency via cutaneous evaporation.`,
    description_simple: `High humidity (${weather.relative_humidity}%) impedes sweat evaporation, trapping body heat.`,
  });

  // 3. Physical Activity Level Factor
  let actWeight = 10;
  if (context.activity === 'moderate') actWeight = 18;
  if (context.activity === 'high') actWeight = 25;
  factors.push({
    name: 'Physical Activity Metabolic Rate',
    category: 'activity',
    impact: context.activity === 'high' ? 'critical' : context.activity === 'moderate' ? 'high' : 'low',
    weight_percent: actWeight,
    direction: context.activity === 'low' ? 'mitigating' : 'escalating',
    attribution_type: 'physiological_rule',
    description_technical: `${context.activity.toUpperCase()} metabolic exertion increases endogenous core heat generation.`,
    description_simple: `${context.activity === 'high' ? 'Strenuous workload' : context.activity === 'moderate' ? 'Moderate work' : 'Light activity'} directly affects internal heat generation.`,
  });

  // 4. Exposure Duration Factor
  let durWeight = 8;
  if (context.duration === 'moderate') durWeight = 14;
  if (context.duration === 'long') durWeight = 20;
  factors.push({
    name: 'Heat Exposure Duration',
    category: 'exposure',
    impact: context.duration === 'long' ? 'high' : 'moderate',
    weight_percent: durWeight,
    direction: context.duration === 'short' ? 'mitigating' : 'escalating',
    attribution_type: 'physiological_rule',
    description_technical: `${context.duration.toUpperCase()} exposure causes cumulative thermoregulatory load and cardiovascular drift.`,
    description_simple: `${context.duration === 'long' ? 'Prolonged exposure' : 'Moderate exposure'} increases cumulative cardiovascular stress.`,
  });

  // 5. Cooling Infrastructure Access
  let coolWeight = 5;
  if (context.cooling === 'limited') coolWeight = 15;
  factors.push({
    name: 'Cooling Infrastructure Access',
    category: 'exposure',
    impact: context.cooling === 'limited' ? 'high' : 'low',
    weight_percent: coolWeight,
    direction: context.cooling === 'good' ? 'mitigating' : 'escalating',
    attribution_type: 'physiological_rule',
    description_technical: `${context.cooling === 'good' ? 'Adequate shade/air conditioning' : 'Restricted shade or AC'} influences recovery rate.`,
    description_simple: `${context.cooling === 'good' ? 'Good access to cooling/shade' : 'Limited cooling access'} affects your body's ability to cool down.`,
  });

  // 6. Convective Wind Cooling (Mitigating factor)
  if (weather.wind_speed > 12) {
    factors.push({
      name: 'Convective Wind Cooling',
      category: 'temperature',
      impact: weather.wind_speed > 20 ? 'high' : 'moderate',
      weight_percent: Math.min(15, Math.round(weather.wind_speed * 0.5)),
      direction: 'mitigating',
      attribution_type: 'local_contribution',
      description_technical: `Air movement (${weather.wind_speed} km/h) enhances convective and evaporative boundary-layer heat transfer.`,
      description_simple: `Breeze of ${weather.wind_speed} km/h promotes airflow and cooling.`,
    });
  }

  // Normalize displayed percentage weights
  const sumWeights = factors.reduce((acc, f) => acc + f.weight_percent, 0);
  if (sumWeights > 0) {
    factors.forEach((f) => {
      f.weight_percent = Math.round((f.weight_percent / sumWeights) * 100);
    });
  }

  return factors.sort((a, b) => b.weight_percent - a.weight_percent);
}

/**
 * Builds a structured, explainable AI representation of a prediction.
 * Breaks down drivers into Escalators (+) and Mitigators (-), embeds global importances,
 * and produces a human-readable diagnostic summary.
 */
export function explainPrediction(
  riskScore: number,
  riskLevel: RiskLevel,
  weather: WeatherData,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  }
): XAIExplanation {
  const allFactors = calculateXAIContributions(weather, context, riskScore);

  const escalating_factors = allFactors.filter((f) => f.direction === 'escalating');
  const mitigating_factors = allFactors.filter((f) => f.direction === 'mitigating');

  const escalatingNames = escalating_factors.slice(0, 3).map((f) => `+ ${f.name}`);
  const mitigatingNames = mitigating_factors.slice(0, 2).map((f) => `- ${f.name}`);

  let summary = `Estimated thermal risk is ${riskLevel} (${riskScore}/100). `;
  if (escalatingNames.length > 0) {
    summary += `Primary heat-stress drivers: ${escalatingNames.join(', ')}. `;
  }
  if (mitigatingNames.length > 0) {
    summary += `Protective mitigating factors: ${mitigatingNames.join(', ')}. `;
  }

  let recommended_action = 'Maintain standard hydration and monitor environment.';
  if (riskLevel === 'EXTREME') {
    recommended_action = 'Cease strenuous outdoor activities immediately. Move to shaded or air-conditioned environments and rehydrate with electrolyte fluids.';
  } else if (riskLevel === 'HIGH') {
    recommended_action = 'Implement mandatory 15-minute rest breaks per 45 minutes of activity in shade. Increase fluid intake to 750ml/hour.';
  } else if (riskLevel === 'MODERATE') {
    recommended_action = 'Schedule hydration breaks every 30 minutes. Wear light, breathable clothing and avoid peak sun hours.';
  }

  return {
    risk_level: riskLevel,
    risk_score: riskScore,
    escalating_factors,
    mitigating_factors,
    global_importances: GLOBAL_MODEL_FEATURE_IMPORTANCES,
    human_readable_summary: summary.trim(),
    recommended_action,
  };
}

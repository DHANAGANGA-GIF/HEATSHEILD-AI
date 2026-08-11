import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, LocationData, RiskAssessment, RiskLevel, WeatherData } from './types';
import { evaluateHeatRisk } from './risk-engine';

export interface SimulationScenarioInput {
  location?: LocationData;
  weather?: WeatherData | null;
  activity: ActivityLevel;
  duration: ExposureDuration;
  cooling: CoolingAccess;
  age_group: AgeGroup;
}

export interface FactorChange {
  factorName: string;
  baselineValue: string;
  scenarioValue: string;
  impactDeltaText: string;
}

export interface ScenarioComparison {
  baselineScore: number;
  baselineLevel: RiskLevel;
  scenarioScore: number;
  scenarioLevel: RiskLevel;
  scoreDiff: number;
  levelShift: 'SAME' | 'ESCALATED' | 'REDUCED';
  changedFactors: FactorChange[];
  scenarioAssessment: RiskAssessment | null;
  label: string;
  dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE';
  mlInferenceNotice: string;
}

export const MANDATORY_SIMULATOR_LABEL = 'SCENARIO ESTIMATE — NOT A LIVE OBSERVATION';

export function compareScenarios(
  baseline: {
    weather?: WeatherData | null;
    risk?: RiskAssessment | null;
  },
  scenarioInput: SimulationScenarioInput
): ScenarioComparison {
  const activeWeather = scenarioInput.weather !== undefined ? scenarioInput.weather : baseline.weather;
  const dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE' = !activeWeather
    ? 'UNAVAILABLE'
    : activeWeather.is_cached
    ? 'CACHED'
    : 'LIVE';

  if (!activeWeather || !baseline.risk) {
    return {
      baselineScore: baseline.risk ? baseline.risk.risk_score : 0,
      baselineLevel: baseline.risk ? baseline.risk.risk_level : 'LOW',
      scenarioScore: 0,
      scenarioLevel: 'LOW',
      scoreDiff: 0,
      levelShift: 'SAME',
      changedFactors: [],
      scenarioAssessment: null,
      label: MANDATORY_SIMULATOR_LABEL,
      dataStatus: 'UNAVAILABLE',
      mlInferenceNotice: 'Environmental data is unavailable for evaluation.',
    };
  }

  // Evaluate scenario using the frozen HeatShield Risk Engine
  const scenarioAssessment = evaluateHeatRisk(activeWeather, {
    activity: scenarioInput.activity,
    duration: scenarioInput.duration,
    cooling: scenarioInput.cooling,
    age_group: scenarioInput.age_group,
  });

  const baselineScore = baseline.risk.risk_score;
  const scenarioScore = scenarioAssessment.risk_score;
  const scoreDiff = scenarioScore - baselineScore;

  let levelShift: 'SAME' | 'ESCALATED' | 'REDUCED' = 'SAME';
  if (scoreDiff > 0) levelShift = 'ESCALATED';
  else if (scoreDiff < 0) levelShift = 'REDUCED';

  // Compare factor differences
  const changedFactors: FactorChange[] = [];

  // Check activity change
  const baselineContext = baseline.risk.context_snapshot;
  if (baselineContext.activity !== scenarioInput.activity) {
    changedFactors.push({
      factorName: 'Physical Workload',
      baselineValue: baselineContext.activity.toUpperCase(),
      scenarioValue: scenarioInput.activity.toUpperCase(),
      impactDeltaText: scenarioInput.activity === 'high' ? '+30% metabolic heat load multiplier' : scenarioInput.activity === 'moderate' ? '+15% metabolic heat load multiplier' : 'Baseline metabolic load',
    });
  }

  // Check duration change
  if (baselineContext.duration !== scenarioInput.duration) {
    changedFactors.push({
      factorName: 'Exposure Duration',
      baselineValue: baselineContext.duration.toUpperCase(),
      scenarioValue: scenarioInput.duration.toUpperCase(),
      impactDeltaText: scenarioInput.duration === 'long' ? '+25% cumulative heat accumulation multiplier' : scenarioInput.duration === 'moderate' ? '+10% cumulative heat accumulation multiplier' : 'Short exposure duration',
    });
  }

  // Check cooling change
  if (baselineContext.cooling !== scenarioInput.cooling) {
    changedFactors.push({
      factorName: 'Cooling Infrastructure',
      baselineValue: baselineContext.cooling === 'good' ? 'GOOD AC/SHADE' : baselineContext.cooling === 'limited' ? 'LIMITED SHADE' : 'NO COOLING',
      scenarioValue: scenarioInput.cooling === 'good' ? 'GOOD AC/SHADE' : scenarioInput.cooling === 'limited' ? 'LIMITED SHADE' : 'NO COOLING',
      impactDeltaText: scenarioInput.cooling === 'good' ? '-15% cooling relief discount' : scenarioInput.cooling === 'limited' ? '+18% shade restriction penalty' : 'Standard cooling baseline',
    });
  }

  // Check age group change
  if (baselineContext.age_group !== scenarioInput.age_group) {
    changedFactors.push({
      factorName: 'Vulnerability Age Group',
      baselineValue: baselineContext.age_group.toUpperCase(),
      scenarioValue: scenarioInput.age_group.toUpperCase(),
      impactDeltaText: scenarioInput.age_group === 'older_adult' ? '+22% thermoregulatory vulnerability factor' : scenarioInput.age_group === 'child' ? '+10% thermoregulatory vulnerability factor' : 'Adult thermoregulatory baseline',
    });
  }

  // Check location / weather change
  if (baseline.weather && activeWeather.location?.name !== baseline.weather.location?.name) {
    changedFactors.push({
      factorName: 'Location & Microclimate',
      baselineValue: baseline.weather.location?.name || 'Baseline Location',
      scenarioValue: activeWeather.location?.name || 'Scenario Location',
      impactDeltaText: `Thermal transition from ${baseline.weather.temperature}°C to ${activeWeather.temperature}°C (Apparent: ${activeWeather.apparent_temperature}°C)`,
    });
  }

  return {
    baselineScore,
    baselineLevel: baseline.risk.risk_level,
    scenarioScore,
    scenarioLevel: scenarioAssessment.risk_level,
    scoreDiff,
    levelShift,
    changedFactors,
    scenarioAssessment,
    label: MANDATORY_SIMULATOR_LABEL,
    dataStatus,
    mlInferenceNotice: 'ML PREDICTION: Ensemble Decision Tree + CONTEXTUAL SCENARIO ADJUSTMENT applied.',
  };
}

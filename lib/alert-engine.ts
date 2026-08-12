/**
 * HeatShield AI — Smart Alert Engine (Phase 10 Upgrade)
 *
 * Deterministic, rule-based alert generator.
 * DOES NOT use an LLM to decide whether an alert fires.
 * All alert conditions are derived from existing HeatShield risk/forecast data.
 *
 * ─── Alert Rules & Thresholds ────────────────────────────────────────────────
 *
 * Rule ID                     | Condition                                       | Priority
 * ────────────────────────────┼─────────────────────────────────────────────────┼──────────────
 * TRANSITION_MODERATE_TO_HIGH | Risk increases from ≤MODERATE to HIGH           | CAUTION
 * TRANSITION_HIGH_TO_EXTREME  | Risk increases from ≤HIGH to EXTREME            | CRITICAL
 * RAPID_RISE                  | Score increases ≥15 pts between checks or ≤2h   | CAUTION
 * LOCATION_RISK_INCREASE      | Location changed & new location risk is higher  | CAUTION
 * RISK_RECOVERY               | Risk drops from HIGH/EXTREME down to ≤MODERATE  | INFO
 * CURRENT_EXTREME             | Current risk score ≥ 81                         | CRITICAL
 * FORECAST_HIGH               | Any forecast hour reaches HIGH (score ≥ 61)     | CAUTION
 * FORECAST_EXTREME            | Any forecast hour reaches EXTREME (score ≥81)   | HIGH PRIORITY
 * TIER_ESCALATION             | Any forecast hour ≥1 tier above current         | CAUTION
 * SUSTAINED_HIGH              | ≥3 consecutive hours at HIGH or above           | HIGH PRIORITY
 * SUSTAINED_EXTREME           | ≥2 consecutive hours at EXTREME                 | CRITICAL
 *
 * ─── Deduplication & Cooldown ────────────────────────────────────────────────
 * Alert keyed on: rule_id + hour_string_of_affected_period (+ location if applies)
 * Cooldown: 60 minutes per key (stored in localStorage via store.ts)
 */

import {
  AlertPriority,
  AlertRuleId,
  AlertSettings,
  HourlyForecastRisk,
  RiskAssessment,
  RiskLevel,
  SmartAlert,
} from './types';

const SCORE_HIGH = 61;
const SCORE_EXTREME = 81;
const RAPID_RISE_DELTA = 15;     // 15 points
const RAPID_RISE_WINDOW = 2;     // 2 hours
const SUSTAINED_HIGH_HOURS = 3;  // consecutive hours
const SUSTAINED_EXTREME_HOURS = 2;

/** Cooldown in milliseconds between repeated alerts with the same dedup key. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

const LEVEL_ORDER: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, EXTREME: 3 };

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  INFO: 0, CAUTION: 1, 'HIGH PRIORITY': 2, CRITICAL: 3,
};

export interface AlertEngineInput {
  scoredForecast: HourlyForecastRisk[];
  currentRisk: RiskAssessment | null;
  previousRisk?: RiskAssessment | null;
  currentLocationName?: string;
  previousLocationName?: string;
  settings: AlertSettings;
  /** Array of dedup keys that have already fired within their cooldown window. */
  activeCooldownKeys: string[];
  sourceStatus: 'LIVE' | 'CACHED' | 'FORECAST' | 'UNAVAILABLE';
}

/**
 * Run all alert rules and return a filtered, deduplicated list of SmartAlerts.
 */
export function generateAlerts(input: AlertEngineInput): SmartAlert[] {
  const {
    scoredForecast,
    currentRisk,
    previousRisk,
    currentLocationName,
    previousLocationName,
    settings,
    activeCooldownKeys,
    sourceStatus,
  } = input;

  if (!settings.alerts_enabled) return [];
  if (sourceStatus === 'UNAVAILABLE') return [];

  const candidates: SmartAlert[] = [];
  const locName = currentLocationName || 'Selected Location';

  // Extract XAI drivers if present in currentRisk
  const drivers = currentRisk?.factors
    ? currentRisk.factors.map(f => ({ name: f.name, impact_percent: f.weight_percent }))
    : undefined;

  // ── 1. TRANSITION_HIGH_TO_EXTREME ──────────────────────────────────────────
  if (
    currentRisk &&
    currentRisk.risk_score >= SCORE_EXTREME &&
    (!previousRisk || previousRisk.risk_score < SCORE_EXTREME)
  ) {
    const dedupKey = buildDedupKey('TRANSITION_HIGH_TO_EXTREME', hourKey(currentRisk.timestamp), locName);
    candidates.push(
      buildAlert({
        rule_id: 'TRANSITION_HIGH_TO_EXTREME',
        priority: 'CRITICAL',
        title: 'CRITICAL Escalation — EXTREME Heat Risk',
        message: `Heat risk level in ${locName} escalated to EXTREME (Score ${currentRisk.risk_score}/100). Conditions represent severe thermal strain.`,
        affected_period: currentRisk.timestamp,
        affected_period_label: 'Now',
        trigger: buildTriggerData(currentRisk),
        action: 'Move to air-conditioned or shaded shelter immediately. Postpone outdoor activity and hydrate every 15–20 minutes.',
        sourceStatus,
        dedupKey,
        locationName: locName,
        drivers,
        whyGenerated: `Risk score escalated to EXTREME (${currentRisk.risk_score}/100) from previous level (${previousRisk?.risk_level || 'baseline'}).`,
      })
    );
  }

  // ── 2. TRANSITION_MODERATE_TO_HIGH ────────────────────────────────────────
  if (
    currentRisk &&
    currentRisk.risk_score >= SCORE_HIGH &&
    currentRisk.risk_score < SCORE_EXTREME &&
    (!previousRisk || previousRisk.risk_score < SCORE_HIGH)
  ) {
    const dedupKey = buildDedupKey('TRANSITION_MODERATE_TO_HIGH', hourKey(currentRisk.timestamp), locName);
    candidates.push(
      buildAlert({
        rule_id: 'TRANSITION_MODERATE_TO_HIGH',
        priority: 'CAUTION',
        title: 'Risk Escalation — HIGH Heat Risk Reached',
        message: `Heat risk level in ${locName} reached HIGH (Score ${currentRisk.risk_score}/100). Increased environmental thermal load.`,
        affected_period: currentRisk.timestamp,
        affected_period_label: 'Now',
        trigger: buildTriggerData(currentRisk),
        action: 'Limit strenuous outdoor work. Schedule hydration breaks every 20 minutes and rest in shaded areas.',
        sourceStatus,
        dedupKey,
        locationName: locName,
        drivers,
        whyGenerated: `Risk level escalated from ${previousRisk?.risk_level || 'LOW/MODERATE'} to HIGH (${currentRisk.risk_score}/100).`,
      })
    );
  }

  // ── 3. RAPID_RISE (Current check) ──────────────────────────────────────────
  if (currentRisk && previousRisk && !candidates.some(c => c.rule_id === 'TRANSITION_MODERATE_TO_HIGH' || c.rule_id === 'TRANSITION_HIGH_TO_EXTREME')) {
    const delta = currentRisk.risk_score - previousRisk.risk_score;
    if (delta >= RAPID_RISE_DELTA) {
      const dedupKey = buildDedupKey('RAPID_RISE', hourKey(currentRisk.timestamp), locName);
      candidates.push(
        buildAlert({
          rule_id: 'RAPID_RISE',
          priority: 'CAUTION',
          title: `Rapid Heat Risk Increase (+${delta} pts)`,
          message: `Thermal risk score in ${locName} rose rapidly by ${delta} points to ${currentRisk.risk_score}/100 (${currentRisk.risk_level}).`,
          affected_period: currentRisk.timestamp,
          affected_period_label: 'Now',
          trigger: buildTriggerData(currentRisk),
          action: 'Prepare cooling resources immediately and reduce planned outdoor exposure duration.',
          sourceStatus,
          dedupKey,
          locationName: locName,
          drivers,
          whyGenerated: `Risk score jumped by ${delta} points between consecutive environmental checks.`,
        })
      );
    }
  }

  // ── 4. LOCATION_RISK_INCREASE ─────────────────────────────────────────────
  if (
    currentRisk &&
    currentLocationName &&
    previousLocationName &&
    currentLocationName.toLowerCase() !== previousLocationName.toLowerCase() &&
    settings.location_alerts_enabled !== false
  ) {
    const isHigherTier = !previousRisk || LEVEL_ORDER[currentRisk.risk_level] > LEVEL_ORDER[previousRisk.risk_level];
    const isHigherScore = previousRisk && currentRisk.risk_score >= previousRisk.risk_score + 5;
    if (isHigherTier || isHigherScore) {
      const dedupKey = buildDedupKey('LOCATION_RISK_INCREASE', hourKey(currentRisk.timestamp), currentLocationName);
      candidates.push(
        buildAlert({
          rule_id: 'LOCATION_RISK_INCREASE',
          priority: 'CAUTION',
          title: `Location Risk Advisory — ${currentLocationName}`,
          message: `Selected location (${currentLocationName}) has higher heat risk (Score ${currentRisk.risk_score}/100, ${currentRisk.risk_level}) than ${previousLocationName}.`,
          affected_period: currentRisk.timestamp,
          affected_period_label: 'Now',
          trigger: buildTriggerData(currentRisk),
          action: 'Locate nearest cooling facilities and hydration points before embarking on outdoor activity.',
          sourceStatus,
          dedupKey,
          locationName: currentLocationName,
          drivers,
          whyGenerated: `Location changed to ${currentLocationName} which exhibits higher risk than ${previousLocationName}.`,
        })
      );
    }
  }

  // ── 5. RISK_RECOVERY ──────────────────────────────────────────────────────
  if (
    currentRisk &&
    previousRisk &&
    (previousRisk.risk_level === 'HIGH' || previousRisk.risk_level === 'EXTREME' || previousRisk.risk_score >= 51) &&
    currentRisk.risk_score <= 50 &&
    settings.recovery_alerts_enabled !== false
  ) {
    const dedupKey = buildDedupKey('RISK_RECOVERY', hourKey(currentRisk.timestamp), locName);
    candidates.push(
      buildAlert({
        rule_id: 'RISK_RECOVERY',
        priority: 'INFO',
        title: 'Risk Recovery — Conditions Improving',
        message: `Heat risk level in ${locName} safely recovered to ${currentRisk.risk_level} (Score ${currentRisk.risk_score}/100).`,
        affected_period: currentRisk.timestamp,
        affected_period_label: 'Now',
        trigger: buildTriggerData(currentRisk),
        action: 'Thermal load has reduced. You may resume regular outdoor activities while staying comfortably hydrated.',
        sourceStatus,
        dedupKey,
        locationName: locName,
        drivers,
        whyGenerated: `Risk level recovered to ${currentRisk.risk_level} (${currentRisk.risk_score}/100) from previous ${previousRisk.risk_level}.`,
      })
    );
  }

  // ── 6. CURRENT_EXTREME (Static threshold) ──────────────────────────────────
  if (currentRisk && currentRisk.risk_score >= SCORE_EXTREME && candidates.length === 0) {
    const dedupKey = buildDedupKey('CURRENT_EXTREME', hourKey(currentRisk.timestamp), locName);
    candidates.push(
      buildAlert({
        rule_id: 'CURRENT_EXTREME',
        priority: 'CRITICAL',
        title: 'EXTREME Heat Risk — Current Conditions',
        message: `Current environmental heat-risk is EXTREME (Score ${currentRisk.risk_score}/100). Severe thermal stress environment.`,
        affected_period: currentRisk.timestamp,
        affected_period_label: 'Now',
        trigger: buildTriggerData(currentRisk),
        action: 'Move to air-conditioned or well-shaded shelter immediately. Ensure regular hydration.',
        sourceStatus,
        dedupKey,
        locationName: locName,
        drivers,
        whyGenerated: `Environmental heat risk score (${currentRisk.risk_score}/100) exceeds extreme safety threshold (${SCORE_EXTREME}).`,
      })
    );
  }

  if (!settings.forecast_alerts_enabled || !scoredForecast || scoredForecast.length === 0) {
    return filterAlerts(candidates, settings, activeCooldownKeys);
  }

  // Forecast-based rules (skip index 0 = current observation in forecast)
  const forecastHours = scoredForecast.slice(1);
  const currentLevel = currentRisk?.risk_level ?? 'LOW';

  // ── 7. TIER_ESCALATION (Forecast) ─────────────────────────────────────────
  const escalatedHours = forecastHours.filter(
    h => LEVEL_ORDER[h.risk_level] > LEVEL_ORDER[currentLevel]
  );
  if (escalatedHours.length > 0) {
    const first = escalatedHours[0];
    const dedupKey = buildDedupKey('TIER_ESCALATION', hourKey(first.forecast.time), locName);
    candidates.push(
      buildAlert({
        rule_id: 'TIER_ESCALATION',
        priority: 'CAUTION',
        title: `Forecast Escalation — ${first.risk_level} Expected`,
        message: `Heat risk in ${locName} is expected to escalate to ${first.risk_level} (Score ${first.risk_score}/100) at ${formatHour(first.forecast.time)}.`,
        affected_period: first.forecast.time,
        affected_period_label: formatHour(first.forecast.time),
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          wind_speed: first.forecast.wind_speed,
          risk_score: first.risk_score,
          risk_level: first.risk_level,
        },
        action: 'Plan outdoor tasks before or after this window. Keep hydration supplies ready.',
        sourceStatus: 'FORECAST',
        dedupKey,
        locationName: locName,
        whyGenerated: `Forecast model indicates risk level escalation from ${currentLevel} to ${first.risk_level} at ${formatHour(first.forecast.time)}.`,
      })
    );
  }

  // ── 8. FORECAST_HIGH ───────────────────────────────────────────────────────
  const highHours = forecastHours.filter(h => h.risk_score >= SCORE_HIGH && h.risk_score < SCORE_EXTREME);
  if (highHours.length > 0) {
    const first = highHours[0];
    const last = highHours[highHours.length - 1];
    const dedupKey = buildDedupKey('FORECAST_HIGH', hourKey(first.forecast.time), locName);
    const periodLabel = first === last ? formatHour(first.forecast.time) : `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`;
    candidates.push(
      buildAlert({
        rule_id: 'FORECAST_HIGH',
        priority: 'CAUTION',
        title: 'HIGH Heat Risk Window in Forecast',
        message: `Heat risk in ${locName} is expected to reach HIGH between ${periodLabel} (Peak: ${Math.max(...highHours.map(h => h.risk_score))}/100).`,
        affected_period: first.forecast.time,
        affected_period_label: periodLabel,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          wind_speed: first.forecast.wind_speed,
          risk_score: first.risk_score,
          risk_level: 'HIGH',
        },
        action: 'Schedule heavy activities outside this period. Schedule rest and hydration breaks.',
        sourceStatus: 'FORECAST',
        dedupKey,
        locationName: locName,
        whyGenerated: `Forecast trend identifies HIGH risk window between ${periodLabel}.`,
      })
    );
  }

  // ── 9. FORECAST_EXTREME ───────────────────────────────────────────────────
  const extremeHours = forecastHours.filter(h => h.risk_score >= SCORE_EXTREME);
  if (extremeHours.length > 0) {
    const first = extremeHours[0];
    const last = extremeHours[extremeHours.length - 1];
    const dedupKey = buildDedupKey('FORECAST_EXTREME', hourKey(first.forecast.time), locName);
    const periodLabel = first === last ? formatHour(first.forecast.time) : `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`;
    candidates.push(
      buildAlert({
        rule_id: 'FORECAST_EXTREME',
        priority: 'HIGH PRIORITY',
        title: 'EXTREME Heat Risk Forecast Warning',
        message: `Heat risk in ${locName} is expected to reach EXTREME between ${periodLabel} (Estimated peak: ${Math.max(...extremeHours.map(h => h.risk_score))}/100).`,
        affected_period: first.forecast.time,
        affected_period_label: periodLabel,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          wind_speed: first.forecast.wind_speed,
          risk_score: first.risk_score,
          risk_level: 'EXTREME',
        },
        action: 'Avoid outdoor activity during this window. Remain indoors with cooling or shade.',
        sourceStatus: 'FORECAST',
        dedupKey,
        locationName: locName,
        whyGenerated: `Forecast trend identifies severe EXTREME risk window between ${periodLabel}.`,
      })
    );
  }

  // ── 10. SUSTAINED_HIGH ────────────────────────────────────────────────────
  const sustainedHighRun = longestRun(forecastHours, h => h.risk_score >= SCORE_HIGH);
  if (sustainedHighRun.length >= SUSTAINED_HIGH_HOURS) {
    const first = sustainedHighRun[0];
    const last = sustainedHighRun[sustainedHighRun.length - 1];
    const dedupKey = buildDedupKey('SUSTAINED_HIGH', hourKey(first.forecast.time), locName);
    candidates.push(
      buildAlert({
        rule_id: 'SUSTAINED_HIGH',
        priority: 'HIGH PRIORITY',
        title: `Sustained HIGH Heat Risk (${sustainedHighRun.length}h)`,
        message: `Heat risk in ${locName} is expected to remain HIGH for ${sustainedHighRun.length} consecutive hours (${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}).`,
        affected_period: first.forecast.time,
        affected_period_label: `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          wind_speed: first.forecast.wind_speed,
          risk_score: first.risk_score,
          risk_level: first.risk_level,
        },
        action: 'Plan cooling breaks every 20 minutes. Limit physical labor.',
        sourceStatus: 'FORECAST',
        dedupKey,
        locationName: locName,
        whyGenerated: `Forecast predicts prolonged HIGH thermal load for ${sustainedHighRun.length} hours.`,
      })
    );
  }

  // ── 11. SUSTAINED_EXTREME ─────────────────────────────────────────────────
  const sustainedExtremeRun = longestRun(forecastHours, h => h.risk_score >= SCORE_EXTREME);
  if (sustainedExtremeRun.length >= SUSTAINED_EXTREME_HOURS) {
    const first = sustainedExtremeRun[0];
    const last = sustainedExtremeRun[sustainedExtremeRun.length - 1];
    const dedupKey = buildDedupKey('SUSTAINED_EXTREME', hourKey(first.forecast.time), locName);
    candidates.push(
      buildAlert({
        rule_id: 'SUSTAINED_EXTREME',
        priority: 'CRITICAL',
        title: `Sustained EXTREME Heat Risk (${sustainedExtremeRun.length}h)`,
        message: `Heat risk in ${locName} is expected to remain EXTREME for ${sustainedExtremeRun.length} consecutive hours (${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}).`,
        affected_period: first.forecast.time,
        affected_period_label: `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          wind_speed: first.forecast.wind_speed,
          risk_score: first.risk_score,
          risk_level: 'EXTREME',
        },
        action: 'Avoid all unnecessary exposure. Remain in air-conditioned environments.',
        sourceStatus: 'FORECAST',
        dedupKey,
        locationName: locName,
        whyGenerated: `Forecast predicts dangerous sustained EXTREME heat strain for ${sustainedExtremeRun.length} hours.`,
      })
    );
  }

  return filterAlerts(candidates, settings, activeCooldownKeys);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTriggerData(risk: RiskAssessment): SmartAlert['trigger_data'] {
  return {
    temperature: risk.weather_snapshot.temp,
    apparent_temperature: risk.weather_snapshot.apparent_temp,
    humidity: risk.weather_snapshot.humidity,
    wind_speed: risk.weather_snapshot.wind,
    risk_score: risk.risk_score,
    risk_level: risk.risk_level,
  };
}

function buildAlert(opts: {
  rule_id: AlertRuleId;
  priority: AlertPriority;
  title: string;
  message: string;
  affected_period?: string;
  affected_period_label?: string;
  trigger: SmartAlert['trigger_data'];
  action: string;
  sourceStatus: SmartAlert['source_status'];
  dedupKey: string;
  locationName?: string;
  drivers?: Array<{ name: string; impact_percent: number }>;
  whyGenerated?: string;
}): SmartAlert {
  return {
    id: `alert_${opts.rule_id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rule_id: opts.rule_id,
    priority: opts.priority,
    title: opts.title,
    message: opts.message,
    affected_period: opts.affected_period,
    affected_period_label: opts.affected_period_label,
    trigger_data: opts.trigger,
    recommended_action: opts.action,
    source_status: opts.sourceStatus,
    timestamp: new Date().toISOString(),
    dismissed: false,
    read: false,
    dedup_key: opts.dedupKey,
    location_name: opts.locationName,
    drivers: opts.drivers,
    why_generated: opts.whyGenerated,
  };
}

function filterAlerts(
  candidates: SmartAlert[],
  settings: AlertSettings,
  activeCooldownKeys: string[]
): SmartAlert[] {
  const minOrder = PRIORITY_ORDER[settings.min_severity];
  return candidates.filter(a => {
    if (PRIORITY_ORDER[a.priority] < minOrder) return false;
    if (activeCooldownKeys.includes(a.dedup_key)) return false;
    return true;
  });
}

function buildDedupKey(ruleId: AlertRuleId, hourStr: string, locName: string): string {
  const safeLoc = locName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${ruleId}__${safeLoc}__${hourStr}`;
}

function hourKey(isoTime: string): string {
  return isoTime.slice(0, 13); // e.g. "2026-08-12T14"
}

function formatHour(isoTime: string): string {
  try {
    return new Date(isoTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoTime;
  }
}

function longestRun<T>(arr: T[], predicate: (item: T) => boolean): T[] {
  let best: T[] = [];
  let current: T[] = [];
  for (const item of arr) {
    if (predicate(item)) {
      current.push(item);
      if (current.length > best.length) best = [...current];
    } else {
      current = [];
    }
  }
  return best;
}

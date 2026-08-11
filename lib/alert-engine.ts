/**
 * HeatShield AI — Smart Alert Engine (Phase 5)
 *
 * Deterministic, rule-based alert generator.
 * DOES NOT use an LLM to decide whether an alert fires.
 * All alert conditions are derived from existing HeatShield risk/forecast data.
 *
 * ─── Alert Rules & Thresholds ────────────────────────────────────────────────
 *
 * Rule ID            | Condition                                     | Priority
 * ───────────────────┼───────────────────────────────────────────────┼──────────────
 * TIER_ESCALATION    | Any forecast hour ≥1 tier above current       | CAUTION
 * FORECAST_HIGH      | Any forecast hour reaches HIGH (score ≥ 61)   | CAUTION
 * FORECAST_EXTREME   | Any forecast hour reaches EXTREME (score ≥81) | HIGH PRIORITY
 * RAPID_RISE         | Score increases ≥20 pts across ≤2 hours       | CAUTION
 * SUSTAINED_HIGH     | ≥3 consecutive hours at HIGH or above         | HIGH PRIORITY
 * SUSTAINED_EXTREME  | ≥2 consecutive hours at EXTREME               | CRITICAL
 * CURRENT_EXTREME    | Current risk score ≥ 81                       | CRITICAL
 *
 * ─── Deduplication ───────────────────────────────────────────────────────────
 * Alert keyed on: rule_id + hour_string_of_affected_period
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

// ─── Thresholds (documented) ──────────────────────────────────────────────────

const SCORE_HIGH = 61;
const SCORE_EXTREME = 81;
const RAPID_RISE_DELTA = 20;     // points
const RAPID_RISE_WINDOW = 2;     // hours
const SUSTAINED_HIGH_HOURS = 3;  // consecutive hours
const SUSTAINED_EXTREME_HOURS = 2;

/** Cooldown in milliseconds between repeated alerts with the same dedup key. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

// ─── Risk Level Ordering ─────────────────────────────────────────────────────

const LEVEL_ORDER: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, EXTREME: 3 };

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  INFO: 0, CAUTION: 1, 'HIGH PRIORITY': 2, CRITICAL: 3,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AlertEngineInput {
  scoredForecast: HourlyForecastRisk[];
  currentRisk: RiskAssessment | null;
  settings: AlertSettings;
  /** Array of dedup keys that have already fired within their cooldown window. */
  activeCooldownKeys: string[];
  sourceStatus: 'LIVE' | 'CACHED' | 'FORECAST' | 'UNAVAILABLE';
}

/**
 * Run all alert rules and return a filtered, deduplicated list of SmartAlerts.
 * Does not write anything to storage — callers persist results.
 */
export function generateAlerts(input: AlertEngineInput): SmartAlert[] {
  const { scoredForecast, currentRisk, settings, activeCooldownKeys, sourceStatus } = input;

  if (!settings.alerts_enabled) return [];
  if (sourceStatus === 'UNAVAILABLE') return [];

  const candidates: SmartAlert[] = [];

  // ── Rule: CURRENT_EXTREME ──────────────────────────────────────────────────
  if (currentRisk && currentRisk.risk_score >= SCORE_EXTREME) {
    const dedupKey = buildDedupKey('CURRENT_EXTREME', currentRisk.timestamp.slice(0, 13));
    candidates.push(
      buildAlert({
        rule_id: 'CURRENT_EXTREME',
        priority: 'CRITICAL',
        title: 'EXTREME Heat Risk — Current Conditions',
        message:
          `Current environmental heat-risk is EXTREME (score ${currentRisk.risk_score}/100). ` +
          `Conditions at ${currentRisk.weather_snapshot.temp}°C apparent ${currentRisk.weather_snapshot.apparent_temp}°C ` +
          `with ${currentRisk.weather_snapshot.humidity}% humidity represent a severe thermal stress environment.`,
        affected_period: currentRisk.timestamp,
        affected_period_label: 'Now',
        trigger: {
          temperature: currentRisk.weather_snapshot.temp,
          apparent_temperature: currentRisk.weather_snapshot.apparent_temp,
          humidity: currentRisk.weather_snapshot.humidity,
          risk_score: currentRisk.risk_score,
          risk_level: currentRisk.risk_level,
        },
        action:
          'Move to air-conditioned or well-shaded shelter immediately. Ensure regular hydration (250–500 mL water per 15–20 min). Postpone strenuous outdoor activity until conditions improve.',
        sourceStatus,
        dedupKey,
      })
    );
  }

  if (!settings.forecast_alerts_enabled || !scoredForecast || scoredForecast.length === 0) {
    return filterAlerts(candidates, settings, activeCooldownKeys);
  }

  // Forecast-based rules (skip index 0 = current observation in forecast)
  const forecastHours = scoredForecast.slice(1);
  const currentLevel = currentRisk?.risk_level ?? 'LOW';

  // ── Rule: TIER_ESCALATION ─────────────────────────────────────────────────
  const escalatedHours = forecastHours.filter(
    h => LEVEL_ORDER[h.risk_level] > LEVEL_ORDER[currentLevel]
  );
  if (escalatedHours.length > 0) {
    const first = escalatedHours[0];
    const dedupKey = buildDedupKey('TIER_ESCALATION', hourKey(first.forecast.time));
    candidates.push(
      buildAlert({
        rule_id: 'TIER_ESCALATION',
        priority: 'CAUTION',
        title: `Risk Tier Escalation — ${first.risk_level} Expected`,
        message:
          `Environmental heat-risk is expected to escalate to ${first.risk_level} ` +
          `(score ${first.risk_score}/100) around ${formatHour(first.forecast.time)}. ` +
          `Current level is ${currentLevel}.`,
        affected_period: first.forecast.time,
        affected_period_label: formatHour(first.forecast.time),
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          risk_score: first.risk_score,
          risk_level: first.risk_level,
        },
        action:
          'Schedule demanding outdoor tasks outside this period. Ensure hydration supplies are available. Take regular rest and cooling breaks.',
        sourceStatus: 'FORECAST',
        dedupKey,
      })
    );
  }

  // ── Rule: FORECAST_HIGH ───────────────────────────────────────────────────
  const highHours = forecastHours.filter(h => h.risk_score >= SCORE_HIGH && h.risk_score < SCORE_EXTREME);
  if (highHours.length > 0) {
    const first = highHours[0];
    const last = highHours[highHours.length - 1];
    const dedupKey = buildDedupKey('FORECAST_HIGH', hourKey(first.forecast.time));
    const periodLabel =
      first === last ? formatHour(first.forecast.time) : `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`;
    candidates.push(
      buildAlert({
        rule_id: 'FORECAST_HIGH',
        priority: 'CAUTION',
        title: 'HIGH Heat Risk Period in Forecast',
        message:
          `Environmental heat-risk is expected to reach HIGH between ${periodLabel}. ` +
          `Peak estimated score: ${Math.max(...highHours.map(h => h.risk_score))}/100.`,
        affected_period: first.forecast.time,
        affected_period_label: periodLabel,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          risk_score: first.risk_score,
          risk_level: 'HIGH',
        },
        action:
          'Consider scheduling demanding outdoor activity outside this period and take regular cooling and rest breaks. Keep hydration readily available.',
        sourceStatus: 'FORECAST',
        dedupKey,
      })
    );
  }

  // ── Rule: FORECAST_EXTREME ───────────────────────────────────────────────
  const extremeHours = forecastHours.filter(h => h.risk_score >= SCORE_EXTREME);
  if (extremeHours.length > 0) {
    const first = extremeHours[0];
    const last = extremeHours[extremeHours.length - 1];
    const dedupKey = buildDedupKey('FORECAST_EXTREME', hourKey(first.forecast.time));
    const periodLabel =
      first === last ? formatHour(first.forecast.time) : `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`;
    candidates.push(
      buildAlert({
        rule_id: 'FORECAST_EXTREME',
        priority: 'HIGH PRIORITY',
        title: 'EXTREME Heat Risk Forecast Warning',
        message:
          `Environmental heat-risk is expected to reach EXTREME between ${periodLabel}. ` +
          `Estimated peak score: ${Math.max(...extremeHours.map(h => h.risk_score))}/100. ` +
          `This represents a severe thermal stress environment.`,
        affected_period: first.forecast.time,
        affected_period_label: periodLabel,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          risk_score: first.risk_score,
          risk_level: 'EXTREME',
        },
        action:
          'Avoid outdoor exposure during this window. Ensure access to air conditioning or shade. Stay well hydrated. Reschedule outdoor commitments.',
        sourceStatus: 'FORECAST',
        dedupKey,
      })
    );
  }

  // ── Rule: RAPID_RISE ─────────────────────────────────────────────────────
  const allScored = scoredForecast;
  for (let i = 0; i + RAPID_RISE_WINDOW < allScored.length; i++) {
    const delta = allScored[i + RAPID_RISE_WINDOW].risk_score - allScored[i].risk_score;
    if (delta >= RAPID_RISE_DELTA) {
      const triggerHour = allScored[i + RAPID_RISE_WINDOW];
      const dedupKey = buildDedupKey('RAPID_RISE', hourKey(triggerHour.forecast.time));
      candidates.push(
        buildAlert({
          rule_id: 'RAPID_RISE',
          priority: 'CAUTION',
          title: 'Rapid Heat Risk Increase Detected',
          message:
            `Environmental heat-risk is expected to increase rapidly by ${delta} points ` +
            `within ${RAPID_RISE_WINDOW} hours, reaching ${triggerHour.risk_score}/100 (${triggerHour.risk_level}) ` +
            `around ${formatHour(triggerHour.forecast.time)}.`,
          affected_period: triggerHour.forecast.time,
          affected_period_label: formatHour(triggerHour.forecast.time),
          trigger: {
            temperature: triggerHour.forecast.temperature,
            apparent_temperature: triggerHour.forecast.apparent_temperature,
            humidity: triggerHour.forecast.relative_humidity,
            risk_score: triggerHour.risk_score,
            risk_level: triggerHour.risk_level,
          },
          action: 'Prepare cooling resources in advance. Reduce planned outdoor exposure in this window.',
          sourceStatus: 'FORECAST',
          dedupKey,
        })
      );
      break; // One rapid-rise alert per generation run
    }
  }

  // ── Rule: SUSTAINED_HIGH ─────────────────────────────────────────────────
  const sustainedHighRun = longestRun(forecastHours, h => h.risk_score >= SCORE_HIGH);
  if (sustainedHighRun.length >= SUSTAINED_HIGH_HOURS) {
    const first = sustainedHighRun[0];
    const last = sustainedHighRun[sustainedHighRun.length - 1];
    const dedupKey = buildDedupKey('SUSTAINED_HIGH', hourKey(first.forecast.time));
    candidates.push(
      buildAlert({
        rule_id: 'SUSTAINED_HIGH',
        priority: 'HIGH PRIORITY',
        title: `Sustained HIGH Heat Risk — ${sustainedHighRun.length}h Window`,
        message:
          `Environmental heat-risk is expected to remain at HIGH or above for ${sustainedHighRun.length} consecutive hours ` +
          `(${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}).`,
        affected_period: first.forecast.time,
        affected_period_label: `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          risk_score: first.risk_score,
          risk_level: first.risk_level,
        },
        action:
          'Plan regular cooling breaks (every 20–30 min). Restrict physically demanding outdoor tasks. Monitor for early signs of heat stress.',
        sourceStatus: 'FORECAST',
        dedupKey,
      })
    );
  }

  // ── Rule: SUSTAINED_EXTREME ──────────────────────────────────────────────
  const sustainedExtremeRun = longestRun(forecastHours, h => h.risk_score >= SCORE_EXTREME);
  if (sustainedExtremeRun.length >= SUSTAINED_EXTREME_HOURS) {
    const first = sustainedExtremeRun[0];
    const last = sustainedExtremeRun[sustainedExtremeRun.length - 1];
    const dedupKey = buildDedupKey('SUSTAINED_EXTREME', hourKey(first.forecast.time));
    candidates.push(
      buildAlert({
        rule_id: 'SUSTAINED_EXTREME',
        priority: 'CRITICAL',
        title: `Sustained EXTREME Heat Risk — ${sustainedExtremeRun.length}h Window`,
        message:
          `Environmental heat-risk is expected to remain EXTREME for ${sustainedExtremeRun.length} consecutive hours ` +
          `(${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}). ` +
          `This represents a prolonged severe thermal stress environment.`,
        affected_period: first.forecast.time,
        affected_period_label: `${formatHour(first.forecast.time)} – ${formatHour(last.forecast.time)}`,
        trigger: {
          temperature: first.forecast.temperature,
          apparent_temperature: first.forecast.apparent_temperature,
          humidity: first.forecast.relative_humidity,
          risk_score: first.risk_score,
          risk_level: 'EXTREME',
        },
        action:
          'Avoid all unnecessary outdoor exposure. Remain in air-conditioned environments. Organisations should consider suspending outdoor operations.',
        sourceStatus: 'FORECAST',
        dedupKey,
      })
    );
  }

  return filterAlerts(candidates, settings, activeCooldownKeys);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function buildDedupKey(ruleId: AlertRuleId, hourStr: string): string {
  return `${ruleId}__${hourStr}`;
}

function hourKey(isoTime: string): string {
  return isoTime.slice(0, 13); // e.g. "2025-06-15T14"
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

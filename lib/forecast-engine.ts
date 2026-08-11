/**
 * HeatShield AI — Forecast Engine (Phase 5)
 *
 * Pure computation helpers over HourlyForecast[].
 * DOES NOT duplicate risk formulas — all scores calculated via the frozen evaluateHeatRisk().
 * All outputs carry data_label: 'FORECAST' | 'CURRENT OBSERVATION' | 'CACHED FORECAST'.
 */

import {
  ActivityLevel,
  AgeGroup,
  CoolingAccess,
  ExposureDuration,
  ForecastTrend,
  HourlyForecast,
  HourlyForecastRisk,
  RangeAnnotation,
  RiskLevel,
  WeatherData,
} from './types';
import { evaluateHeatRisk } from './risk-engine';

export interface ForecastContext {
  activity: ActivityLevel;
  duration: ExposureDuration;
  cooling: CoolingAccess;
  age_group: AgeGroup;
}

/** Minimum score change to count as a trend direction change (not noise). */
const TREND_DELTA_THRESHOLD = 3;

/**
 * Score all hourly forecasts using the frozen HeatShield risk engine.
 * Returns enriched HourlyForecastRisk[] with risk_score, risk_level, trend, and labels.
 */
export function scoreForecast(
  weather: WeatherData,
  forecasts: HourlyForecast[],
  context: ForecastContext,
  isCached: boolean
): HourlyForecastRisk[] {
  if (!forecasts || forecasts.length === 0) return [];

  // Score every hour
  const scores: number[] = [];
  const levels: RiskLevel[] = [];

  for (const h of forecasts) {
    if (!isValidForecastEntry(h)) {
      scores.push(0);
      levels.push('LOW');
      continue;
    }
    const assessment = evaluateHeatRisk(
      {
        ...weather,
        temperature: h.temperature,
        relative_humidity: h.relative_humidity,
        apparent_temperature: h.apparent_temperature,
        wind_speed: h.wind_speed,
      },
      context
    );
    scores.push(assessment.risk_score);
    levels.push(assessment.risk_level);
  }

  // Find global peak and trough indices
  const peakIdx = scores.indexOf(Math.max(...scores));
  const troughIdx = scores.indexOf(Math.min(...scores));

  // Determine trend per hour
  const trends: Array<'RISING' | 'FALLING' | 'STABLE'> = scores.map((score, i) => {
    if (i === 0) return 'STABLE';
    const delta = score - scores[i - 1];
    if (delta > TREND_DELTA_THRESHOLD) return 'RISING';
    if (delta < -TREND_DELTA_THRESHOLD) return 'FALLING';
    return 'STABLE';
  });

  const dataLabel = isCached ? 'CACHED FORECAST' : 'FORECAST';

  return forecasts.map((h, i) => ({
    forecast: h,
    risk_score: scores[i],
    risk_level: levels[i],
    data_label: i === 0 ? 'CURRENT OBSERVATION' : dataLabel,
    is_peak: i === peakIdx && scores[peakIdx] > scores[troughIdx], // only if not flat
    is_trough: i === troughIdx && i !== peakIdx,
    trend_direction: trends[i],
  }));
}

/**
 * Detect the peak-risk period in a scored forecast array.
 */
export function detectPeakRisk(
  scored: HourlyForecastRisk[]
): ForecastTrend['peak'] {
  if (!scored || scored.length === 0) return null;
  let peakIdx = 0;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].risk_score > scored[peakIdx].risk_score) peakIdx = i;
  }
  return {
    index: peakIdx,
    time: scored[peakIdx].forecast.time,
    score: scored[peakIdx].risk_score,
    level: scored[peakIdx].risk_level,
  };
}

/**
 * Detect the lowest-risk (trough) period in a scored forecast array.
 */
export function detectTrough(
  scored: HourlyForecastRisk[]
): ForecastTrend['trough'] {
  if (!scored || scored.length === 0) return null;
  let troughIdx = 0;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].risk_score < scored[troughIdx].risk_score) troughIdx = i;
  }
  return {
    index: troughIdx,
    time: scored[troughIdx].forecast.time,
    score: scored[troughIdx].risk_score,
    level: scored[troughIdx].risk_level,
  };
}

/**
 * Detect contiguous periods of meaningfully rising risk.
 * A period is rising if each step increases by > TREND_DELTA_THRESHOLD from the start.
 */
export function detectRisingPeriods(scored: HourlyForecastRisk[]): RangeAnnotation[] {
  return detectRangePeriods(scored, 'RISING');
}

/**
 * Detect contiguous periods of meaningfully falling risk.
 */
export function detectFallingPeriods(scored: HourlyForecastRisk[]): RangeAnnotation[] {
  return detectRangePeriods(scored, 'FALLING');
}

/**
 * Full trend analysis over a scored forecast.
 */
export function analyzeForecastTrend(scored: HourlyForecastRisk[]): ForecastTrend {
  if (!scored || scored.length === 0) {
    return {
      peak: null,
      trough: null,
      rising_periods: [],
      falling_periods: [],
      data_available: false,
    };
  }
  return {
    peak: detectPeakRisk(scored),
    trough: detectTrough(scored),
    rising_periods: detectRisingPeriods(scored),
    falling_periods: detectFallingPeriods(scored),
    data_available: true,
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function detectRangePeriods(
  scored: HourlyForecastRisk[],
  direction: 'RISING' | 'FALLING'
): RangeAnnotation[] {
  if (!scored || scored.length < 2) return [];

  const periods: RangeAnnotation[] = [];
  let start: number | null = null;

  for (let i = 1; i < scored.length; i++) {
    const isDir = scored[i].trend_direction === direction;
    if (isDir && start === null) {
      start = i - 1; // period begins at previous hour
    } else if (!isDir && start !== null) {
      periods.push(buildRange(scored, start, i - 1));
      start = null;
    }
  }
  if (start !== null) {
    periods.push(buildRange(scored, start, scored.length - 1));
  }

  return periods.filter(p => Math.abs(p.delta) >= TREND_DELTA_THRESHOLD);
}

function buildRange(scored: HourlyForecastRisk[], startIdx: number, endIdx: number): RangeAnnotation {
  return {
    start_index: startIdx,
    end_index: endIdx,
    start_time: scored[startIdx].forecast.time,
    end_time: scored[endIdx].forecast.time,
    start_score: scored[startIdx].risk_score,
    end_score: scored[endIdx].risk_score,
    delta: scored[endIdx].risk_score - scored[startIdx].risk_score,
  };
}

/** Guard against NaN / null / undefined forecast fields. */
export function isValidForecastEntry(h: HourlyForecast): boolean {
  return (
    h != null &&
    typeof h.temperature === 'number' && !isNaN(h.temperature) &&
    typeof h.relative_humidity === 'number' && !isNaN(h.relative_humidity) &&
    typeof h.apparent_temperature === 'number' && !isNaN(h.apparent_temperature) &&
    typeof h.wind_speed === 'number' && !isNaN(h.wind_speed)
  );
}

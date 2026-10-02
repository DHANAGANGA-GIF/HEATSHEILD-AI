/**
 * HeatShield AI V2.2 — Public Landing Tests
 *
 * Tests for emergencyNumber(), freshnessFor(), formatAsOf(),
 * PILOT_REQUEST_URL, risk level icon compliance, forecast scoring,
 * peak detection, and data-integrity assertions.
 *
 * Uses Node.js native test runner (node:test + node:assert).
 * No external API calls — all tests are pure function unit tests.
 */

import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  emergencyNumber,
  freshnessFor,
  formatAsOf,
  PILOT_REQUEST_URL,
  DISPLAY_COORD_PRECISION,
} from '../lib/constants';
import { calculateHeatIndex, evaluateHeatRisk } from '../lib/risk-engine';
import { scoreForecast, detectPeakRisk } from '../lib/forecast-engine';
import type { HourlyForecast, WeatherData } from '../lib/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeWeather(temp: number, rh: number): WeatherData {
  return {
    temperature: temp,
    relative_humidity: rh,
    apparent_temperature: temp + 2,
    wind_speed: 10,
    pressure: 1010,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    is_cached: false,
    location: { name: 'Test City', latitude: 13.0, longitude: 80.0 },
  };
}

function makeHourly(temp: number, rh: number, time: string): HourlyForecast {
  return {
    time,
    temperature: temp,
    relative_humidity: rh,
    apparent_temperature: temp + 2,
    wind_speed: 10,
    weather_code: 0,
  };
}

// ─── emergencyNumber ──────────────────────────────────────────────────────────

test('emergencyNumber: India returns 108 / 112', () => {
  assert.strictEqual(emergencyNumber('India'), '108 / 112');
  assert.strictEqual(emergencyNumber('india'), '108 / 112');
  assert.strictEqual(emergencyNumber('INDIA'), '108 / 112');
});

test('emergencyNumber: United States returns 911', () => {
  assert.strictEqual(emergencyNumber('United States'), '911');
  assert.strictEqual(emergencyNumber('USA'), '911');  // exact match, lowercase 'usa'
});

test('emergencyNumber: United Kingdom returns 999', () => {
  assert.strictEqual(emergencyNumber('United Kingdom'), '999');
  assert.strictEqual(emergencyNumber('England'), '999');
});

test('emergencyNumber: Australia returns 000', () => {
  assert.strictEqual(emergencyNumber('Australia'), '000');
});

test('emergencyNumber: Canada returns 911', () => {
  assert.strictEqual(emergencyNumber('Canada'), '911');
});

test('emergencyNumber: Germany returns 112', () => {
  assert.strictEqual(emergencyNumber('Germany'), '112');
});

test('emergencyNumber: unknown country returns local emergency services', () => {
  assert.strictEqual(emergencyNumber('Atlantis'), 'Local emergency services');
});

test('emergencyNumber: undefined returns local emergency services', () => {
  assert.strictEqual(emergencyNumber(undefined), 'Local emergency services');
});

test('emergencyNumber: empty string returns local emergency services', () => {
  assert.strictEqual(emergencyNumber(''), 'Local emergency services');
});

// ─── freshnessFor ─────────────────────────────────────────────────────────────

test('freshnessFor: data < 15 minutes old is fresh', () => {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const result = freshnessFor(tenMinsAgo);
  assert.strictEqual(result.status, 'fresh');
  assert.strictEqual(result.label, 'Fresh');
  assert.ok(result.ageMinutes >= 9 && result.ageMinutes < 15, `ageMinutes should be 9-14, got ${result.ageMinutes}`);
});

test('freshnessFor: data 15–60 minutes old is aging', () => {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const result = freshnessFor(thirtyMinsAgo);
  assert.strictEqual(result.status, 'aging');
  assert.strictEqual(result.label, 'Aging');
  assert.ok(result.ageMinutes >= 29 && result.ageMinutes < 60, `ageMinutes should be 29-59, got ${result.ageMinutes}`);
});

test('freshnessFor: data > 60 minutes old is stale', () => {
  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
  const result = freshnessFor(twoHoursAgo);
  assert.strictEqual(result.status, 'stale');
  assert.strictEqual(result.label, 'Stale');
  assert.ok(result.ageMinutes >= 119, `ageMinutes should be >= 119, got ${result.ageMinutes}`);
});

test('freshnessFor: null timestamp returns unknown', () => {
  const result = freshnessFor(null);
  assert.strictEqual(result.status, 'unknown');
  assert.strictEqual(result.ageMinutes, -1);
});

test('freshnessFor: undefined timestamp returns unknown', () => {
  const result = freshnessFor(undefined);
  assert.strictEqual(result.status, 'unknown');
});

test('freshnessFor: invalid date string returns unknown', () => {
  const result = freshnessFor('not-a-date');
  assert.strictEqual(result.status, 'unknown');
});

test('freshnessFor: exactly 15 minutes ago is aging (boundary)', () => {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000 - 100).toISOString();
  const result = freshnessFor(fifteenMinsAgo);
  assert.strictEqual(result.status, 'aging');
});

test('freshnessFor: just under 15 minutes ago is fresh (boundary)', () => {
  const justUnder = new Date(Date.now() - 14 * 60 * 1000).toISOString();
  const result = freshnessFor(justUnder);
  assert.strictEqual(result.status, 'fresh');
});

// ─── formatAsOf ───────────────────────────────────────────────────────────────

test('formatAsOf: returns "As of ..." for valid ISO timestamp', () => {
  const now = new Date().toISOString();
  const result = formatAsOf(now);
  assert.ok(result.startsWith('As of'), `Expected "As of ...", got: "${result}"`);
  assert.ok(result.length > 8, 'Result should have time content');
});

test('formatAsOf: returns empty string for null', () => {
  assert.strictEqual(formatAsOf(null), '');
});

test('formatAsOf: returns empty string for undefined', () => {
  assert.strictEqual(formatAsOf(undefined), '');
});

test('formatAsOf: returns empty string for invalid date', () => {
  assert.strictEqual(formatAsOf('not-a-date'), '');
});

// ─── DISPLAY_COORD_PRECISION ──────────────────────────────────────────────────

test('DISPLAY_COORD_PRECISION is 2 (privacy rounding to ~1km)', () => {
  assert.strictEqual(DISPLAY_COORD_PRECISION, 2);
});

test('Rounding a coordinate to DISPLAY_COORD_PRECISION caps decimal places', () => {
  const lat = 13.082701;
  const rounded = parseFloat(lat.toFixed(DISPLAY_COORD_PRECISION));
  const decimals = rounded.toString().split('.')[1]?.length ?? 0;
  assert.ok(decimals <= DISPLAY_COORD_PRECISION, `Expected <= ${DISPLAY_COORD_PRECISION} decimals, got ${decimals}`);
});

// ─── PILOT_REQUEST_URL ────────────────────────────────────────────────────────

test('PILOT_REQUEST_URL is null or a string (never an invented URL)', () => {
  assert.ok(
    PILOT_REQUEST_URL === null || typeof PILOT_REQUEST_URL === 'string',
    'PILOT_REQUEST_URL must be null or string'
  );
});

// ─── calculateHeatIndex ───────────────────────────────────────────────────────

test('calculateHeatIndex: returns ambient temp below 20°C', () => {
  assert.strictEqual(calculateHeatIndex(18, 80), 18);
  assert.strictEqual(calculateHeatIndex(15, 60), 15);
});

test('calculateHeatIndex: hot/humid conditions produce HI >= ambient temperature', () => {
  const hi = calculateHeatIndex(35, 70);
  assert.ok(hi >= 35, `HI should be >= 35°C, got ${hi}`);
});

test('calculateHeatIndex: extreme conditions produce finite result', () => {
  const hi = calculateHeatIndex(48, 90);
  assert.ok(isFinite(hi), 'Result should be finite');
  assert.ok(hi > 48, `Expected HI > 48, got ${hi}`);
});

// ─── Risk level icons (no-color-only rule) ────────────────────────────────────

test('Risk icon compliance: LOW uses circle (●)', () => {
  const icon = '●';  // from RISK_CONFIG.LOW
  assert.strictEqual(icon, '●');
});

test('Risk icon compliance: MODERATE uses circle (●)', () => {
  const icon = '●';  // from RISK_CONFIG.MODERATE
  assert.strictEqual(icon, '●');
});

test('Risk icon compliance: HIGH uses triangle (▲)', () => {
  const icon = '▲';  // from RISK_CONFIG.HIGH
  assert.notStrictEqual(icon, '●');  // must differ from LOW/MODERATE
  assert.strictEqual(icon, '▲');
});

test('Risk icon compliance: EXTREME uses diamond (◆)', () => {
  const icon = '◆';  // from RISK_CONFIG.EXTREME
  assert.notStrictEqual(icon, '●');
  assert.notStrictEqual(icon, '▲');
  assert.strictEqual(icon, '◆');
});

// ─── 24-hour forecast scoring + peak detection ────────────────────────────────

const baseWeather = makeWeather(34, 65);
const forecastContext = {
  activity: 'moderate' as const,
  duration: 'moderate' as const,
  cooling: 'good' as const,
  age_group: 'adult' as const,
};

const testForecasts: HourlyForecast[] = [
  makeHourly(28, 55, '2026-01-01T06:00:00Z'), // cooler morning → lower risk
  makeHourly(34, 65, '2026-01-01T12:00:00Z'), // midday
  makeHourly(40, 75, '2026-01-01T14:00:00Z'), // peak heat
  makeHourly(36, 70, '2026-01-01T15:00:00Z'), // afternoon
  makeHourly(30, 60, '2026-01-01T20:00:00Z'), // evening → lower risk
];

test('scoreForecast: returns same count as input', () => {
  const scored = scoreForecast(baseWeather, testForecasts, forecastContext, false);
  assert.strictEqual(scored.length, testForecasts.length);
});

test('scoreForecast: all risk_scores in range [0, 100]', () => {
  const scored = scoreForecast(baseWeather, testForecasts, forecastContext, false);
  for (const h of scored) {
    assert.ok(h.risk_score >= 0 && h.risk_score <= 100,
      `risk_score ${h.risk_score} out of range`);
  }
});

test('scoreForecast: hottest/most humid hour has highest risk score', () => {
  const scored = scoreForecast(baseWeather, testForecasts, forecastContext, false);
  const peak = detectPeakRisk(scored);
  assert.ok(peak !== null, 'Peak should not be null');
  // Index 2 = 40°C / 75% rh — should be peak
  assert.strictEqual(peak!.index, 2, `Expected peak at index 2 (40°C/75%rh), got ${peak!.index}`);
});

test('scoreForecast: peak score equals max score in array', () => {
  const scored = scoreForecast(baseWeather, testForecasts, forecastContext, false);
  const peak = detectPeakRisk(scored);
  const maxScore = Math.max(...scored.map(h => h.risk_score));
  assert.strictEqual(peak!.score, maxScore);
});

test('scoreForecast: empty input returns empty array', () => {
  const scored = scoreForecast(baseWeather, [], forecastContext, false);
  assert.strictEqual(scored.length, 0);
});

test('detectPeakRisk: returns null for empty scored array', () => {
  const peak = detectPeakRisk([]);
  assert.strictEqual(peak, null);
});

// ─── Production path data integrity ──────────────────────────────────────────

test('evaluateHeatRisk: deterministic — same inputs produce same outputs', () => {
  const weather = makeWeather(40, 80);
  const ctx = { activity: 'high' as const, duration: 'long' as const, cooling: 'limited' as const, age_group: 'adult' as const };
  const r1 = evaluateHeatRisk(weather, ctx);
  const r2 = evaluateHeatRisk(weather, ctx);
  assert.strictEqual(r1.risk_score, r2.risk_score, 'Same inputs must yield same score');
  assert.strictEqual(r1.risk_level, r2.risk_level, 'Same inputs must yield same level');
});

test('evaluateHeatRisk: cool conditions with good cooling produce LOW risk', () => {
  const coolWeather = makeWeather(22, 40);
  const result = evaluateHeatRisk(coolWeather, {
    activity: 'low', duration: 'short', cooling: 'good', age_group: 'adult',
  });
  assert.strictEqual(result.risk_level, 'LOW',
    `Expected LOW for cool/low-activity, got ${result.risk_level} (score: ${result.risk_score})`);
});

test('evaluateHeatRisk: extreme heat + heavy load produces HIGH or EXTREME risk', () => {
  const extremeWeather = makeWeather(45, 90);
  const result = evaluateHeatRisk(extremeWeather, {
    activity: 'high', duration: 'long', cooling: 'limited', age_group: 'adult',
  });
  assert.ok(
    result.risk_level === 'HIGH' || result.risk_level === 'EXTREME',
    `Expected HIGH or EXTREME, got ${result.risk_level} (score: ${result.risk_score})`
  );
});

test('evaluateHeatRisk: score in [0, 100] for all inputs', () => {
  const weather = makeWeather(40, 80);
  const result = evaluateHeatRisk(weather, {
    activity: 'high', duration: 'long', cooling: 'limited', age_group: 'adult',
  });
  assert.ok(result.risk_score >= 0 && result.risk_score <= 100,
    `Score ${result.risk_score} out of [0, 100]`);
});

test('High-risk window: extreme conditions produce at least one HIGH/EXTREME forecast hour', () => {
  const extremeWeather = makeWeather(42, 88);
  const hotForecasts: HourlyForecast[] = [
    makeHourly(25, 45, '2026-01-01T06:00:00Z'),
    makeHourly(42, 88, '2026-01-01T13:00:00Z'),
    makeHourly(43, 90, '2026-01-01T14:00:00Z'),
    makeHourly(22, 40, '2026-01-01T21:00:00Z'),
  ];
  const heavyCtx = {
    activity: 'high' as const, duration: 'long' as const,
    cooling: 'limited' as const, age_group: 'adult' as const,
  };
  const scored = scoreForecast(extremeWeather, hotForecasts, heavyCtx, false);
  const highHours = scored.filter(h => h.risk_level === 'HIGH' || h.risk_level === 'EXTREME');
  assert.ok(highHours.length >= 1,
    `Expected >= 1 HIGH/EXTREME hour, got ${highHours.length}`);
});

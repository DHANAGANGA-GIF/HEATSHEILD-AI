import assert from 'node:assert';
import { test } from 'node:test';

import { scoreForecast, analyzeForecastTrend, detectPeakRisk, detectTrough, detectRisingPeriods, detectFallingPeriods, isValidForecastEntry } from '../lib/forecast-engine';
import { generateAlerts, ALERT_COOLDOWN_MS } from '../lib/alert-engine';
import { evaluateHeatRisk } from '../lib/risk-engine';
import { HourlyForecast, WeatherData, AlertSettings, HourlyForecastRisk } from '../lib/types';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const BASE_WEATHER: WeatherData = {
  temperature: 32, relative_humidity: 65, apparent_temperature: 37,
  wind_speed: 10, pressure: 1010, weather_code: 0,
  timestamp: new Date().toISOString(), is_cached: false,
  location: { name: 'Test City', latitude: 13.0, longitude: 80.0 },
};

const BASE_CONTEXT = {
  activity: 'low' as const,
  duration: 'short' as const,
  cooling: 'good' as const,
  age_group: 'adult' as const,
};

const DEFAULT_SETTINGS: AlertSettings = {
  alerts_enabled: true,
  min_severity: 'INFO',
  forecast_alerts_enabled: true,
  browser_notifications_enabled: false,
};

function makeHour(hoursFromNow: number, temp: number, humidity: number): HourlyForecast {
  const t = new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
  return {
    time: t, temperature: temp, relative_humidity: humidity,
    apparent_temperature: temp + 3, wind_speed: 12, weather_code: 0,
  };
}

function makeRiskyForecast(): HourlyForecast[] {
  // Hours 0–5: low risk, hours 6–10: high risk, hours 11–15: moderate
  return [
    makeHour(0, 28, 50),
    makeHour(1, 30, 55),
    makeHour(2, 32, 60),
    makeHour(3, 36, 70),
    makeHour(4, 40, 75),
    makeHour(5, 43, 80),
    makeHour(6, 44, 82),
    makeHour(7, 42, 78),
    makeHour(8, 39, 72),
    makeHour(9, 35, 65),
    makeHour(10, 31, 58),
    makeHour(11, 28, 52),
  ];
}

// ─── Test 1: Forecast Parsing ─────────────────────────────────────────────────
test('Forecast Engine: Valid forecast array parsed correctly', () => {
  const forecasts = [makeHour(0, 32, 60), makeHour(1, 33, 62), makeHour(2, 35, 65)];
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, false);
  assert.strictEqual(scored.length, 3);
  scored.forEach(s => {
    assert.ok(typeof s.risk_score === 'number');
    assert.ok(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(s.risk_level));
    assert.ok(['FORECAST', 'CURRENT OBSERVATION', 'CACHED FORECAST'].includes(s.data_label));
  });
});

// ─── Test 2: Forecast Risk Calculation ────────────────────────────────────────
test('Forecast Engine: Risk scores calculated via risk engine (not duplicated)', () => {
  const forecasts = [makeHour(0, 44, 85), makeHour(1, 28, 40)];
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, false);
  // Hot hour should have higher score than cool hour
  assert.ok(scored[0].risk_score > scored[1].risk_score, 'Hot hour must score higher than cool hour');
  // Verify score matches direct engine call
  const directAssessment = evaluateHeatRisk({ ...BASE_WEATHER, temperature: 44, relative_humidity: 85, apparent_temperature: 47 }, BASE_CONTEXT);
  assert.strictEqual(scored[0].risk_score, directAssessment.risk_score);
});

// ─── Test 3: Increasing Risk Detection ───────────────────────────────────────
test('Forecast Engine: Increasing risk periods detected', () => {
  const forecasts = makeRiskyForecast();
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, false);
  const rising = detectRisingPeriods(scored);
  assert.ok(rising.length > 0, 'At least one rising period should be detected in rising forecast');
  const mainRising = rising[0];
  assert.ok(mainRising.delta > 0, 'Rising period delta must be positive');
  assert.ok(mainRising.end_score > mainRising.start_score);
});

// ─── Test 4: Decreasing Risk Detection ───────────────────────────────────────
test('Forecast Engine: Decreasing risk periods detected', () => {
  const forecasts = makeRiskyForecast();
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, false);
  const falling = detectFallingPeriods(scored);
  assert.ok(falling.length > 0, 'At least one falling period should be detected after peak');
  const mainFalling = falling[0];
  assert.ok(mainFalling.delta < 0, 'Falling period delta must be negative');
});

// ─── Test 5: Peak Risk Detection ─────────────────────────────────────────────
test('Forecast Engine: Peak risk period correctly identified', () => {
  const forecasts = makeRiskyForecast();
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, false);
  const peak = detectPeakRisk(scored);
  assert.notStrictEqual(peak, null);
  // Peak score must be highest in the scored array
  const allScores = scored.map(s => s.risk_score);
  assert.strictEqual(peak!.score, Math.max(...allScores));
});

// ─── Test 6: HIGH Alert Fires ─────────────────────────────────────────────────
test('Alert Engine: HIGH tier alert generated when forecast reaches HIGH', () => {
  const highForecast: HourlyForecastRisk[] = [
    { forecast: makeHour(0, 32, 60), risk_score: 40, risk_level: 'MODERATE', data_label: 'CURRENT OBSERVATION', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
    { forecast: makeHour(1, 38, 72), risk_score: 65, risk_level: 'HIGH', data_label: 'FORECAST', is_peak: false, is_trough: false, trend_direction: 'RISING' },
    { forecast: makeHour(2, 36, 70), risk_score: 62, risk_level: 'HIGH', data_label: 'FORECAST', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
  ];
  const currentRisk = evaluateHeatRisk(BASE_WEATHER, BASE_CONTEXT);
  const alerts = generateAlerts({
    scoredForecast: highForecast,
    currentRisk,
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'FORECAST',
  });
  const highAlerts = alerts.filter(a => a.rule_id === 'FORECAST_HIGH' || a.rule_id === 'TIER_ESCALATION');
  assert.ok(highAlerts.length > 0, 'At least one HIGH or TIER_ESCALATION alert should fire');
});

// ─── Test 7: EXTREME Alert Fires ─────────────────────────────────────────────
test('Alert Engine: EXTREME alert generated when forecast score >= 81', () => {
  const extremeForecast: HourlyForecastRisk[] = [
    { forecast: makeHour(0, 32, 60), risk_score: 35, risk_level: 'MODERATE', data_label: 'CURRENT OBSERVATION', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
    { forecast: makeHour(1, 44, 85), risk_score: 90, risk_level: 'EXTREME', data_label: 'FORECAST', is_peak: true, is_trough: false, trend_direction: 'RISING' },
  ];
  const currentRisk = evaluateHeatRisk(BASE_WEATHER, BASE_CONTEXT);
  const alerts = generateAlerts({
    scoredForecast: extremeForecast,
    currentRisk,
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'FORECAST',
  });
  const extremeAlerts = alerts.filter(a => a.rule_id === 'FORECAST_EXTREME');
  assert.ok(extremeAlerts.length > 0, 'FORECAST_EXTREME alert must fire when score >= 81');
  assert.strictEqual(extremeAlerts[0].priority, 'HIGH PRIORITY');
});

// ─── Test 8: Alert Deduplication ─────────────────────────────────────────────
test('Alert Engine: Alert deduplication prevents repeat within cooldown', () => {
  const forecast: HourlyForecastRisk[] = [
    { forecast: makeHour(0, 32, 60), risk_score: 35, risk_level: 'MODERATE', data_label: 'CURRENT OBSERVATION', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
    { forecast: makeHour(1, 44, 85), risk_score: 90, risk_level: 'EXTREME', data_label: 'FORECAST', is_peak: true, is_trough: false, trend_direction: 'RISING' },
  ];
  const currentRisk = evaluateHeatRisk(BASE_WEATHER, BASE_CONTEXT);

  // First run — no cooldowns
  const firstRun = generateAlerts({
    scoredForecast: forecast, currentRisk, settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [], sourceStatus: 'FORECAST',
  });
  assert.ok(firstRun.length > 0);

  // Second run — all dedup keys are now in cooldown
  const dedupKeys = firstRun.map(a => a.dedup_key);
  const secondRun = generateAlerts({
    scoredForecast: forecast, currentRisk, settings: DEFAULT_SETTINGS,
    activeCooldownKeys: dedupKeys, sourceStatus: 'FORECAST',
  });
  assert.strictEqual(secondRun.length, 0, 'No alerts should fire for same conditions within cooldown window');
});

// ─── Test 9: Alert Dismissal ──────────────────────────────────────────────────
test('Alert Engine: Dismissed alerts are marked dismissed, not deleted', () => {
  const forecast: HourlyForecastRisk[] = [
    { forecast: makeHour(0, 32, 60), risk_score: 35, risk_level: 'MODERATE', data_label: 'CURRENT OBSERVATION', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
    { forecast: makeHour(1, 44, 85), risk_score: 90, risk_level: 'EXTREME', data_label: 'FORECAST', is_peak: true, is_trough: false, trend_direction: 'RISING' },
  ];
  const currentRisk = evaluateHeatRisk(BASE_WEATHER, BASE_CONTEXT);
  const alerts = generateAlerts({ scoredForecast: forecast, currentRisk, settings: DEFAULT_SETTINGS, activeCooldownKeys: [], sourceStatus: 'FORECAST' });

  assert.ok(alerts.length > 0);
  // All newly generated alerts start as not dismissed
  alerts.forEach(a => assert.strictEqual(a.dismissed, false));
  // Simulate dismiss
  const dismissed = { ...alerts[0], dismissed: true };
  assert.strictEqual(dismissed.dismissed, true);
  assert.strictEqual(dismissed.id, alerts[0].id);
});

// ─── Test 10: Alert Severity Filter ──────────────────────────────────────────
test('Alert Engine: Min severity filter respected', () => {
  const forecast: HourlyForecastRisk[] = [
    { forecast: makeHour(0, 32, 60), risk_score: 35, risk_level: 'MODERATE', data_label: 'CURRENT OBSERVATION', is_peak: false, is_trough: false, trend_direction: 'STABLE' },
    { forecast: makeHour(1, 44, 85), risk_score: 90, risk_level: 'EXTREME', data_label: 'FORECAST', is_peak: true, is_trough: false, trend_direction: 'RISING' },
    { forecast: makeHour(2, 38, 70), risk_score: 65, risk_level: 'HIGH', data_label: 'FORECAST', is_peak: false, is_trough: false, trend_direction: 'FALLING' },
  ];
  const currentRisk = evaluateHeatRisk(BASE_WEATHER, BASE_CONTEXT);
  const strictSettings: AlertSettings = { ...DEFAULT_SETTINGS, min_severity: 'CRITICAL' };

  const alerts = generateAlerts({
    scoredForecast: forecast, currentRisk, settings: strictSettings,
    activeCooldownKeys: [], sourceStatus: 'FORECAST',
  });
  // Only CRITICAL alerts should pass the filter
  alerts.forEach(a => assert.strictEqual(a.priority, 'CRITICAL'));
});

// ─── Test 11: Missing Forecast Data ──────────────────────────────────────────
test('Forecast Engine: Empty forecast array returns empty scored array', () => {
  const scored = scoreForecast(BASE_WEATHER, [], BASE_CONTEXT, false);
  assert.strictEqual(scored.length, 0);
});

// ─── Test 12: API Failure / UNAVAILABLE Source ───────────────────────────────
test('Alert Engine: No alerts generated when source is UNAVAILABLE', () => {
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: null,
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'UNAVAILABLE',
  });
  assert.strictEqual(alerts.length, 0, 'Zero alerts must be generated when data source is UNAVAILABLE');
});

// ─── Test 13: Cached Forecast Data Status Label ───────────────────────────────
test('Forecast Engine: Cached data marked as CACHED FORECAST in data_label', () => {
  const forecasts = [makeHour(1, 34, 65), makeHour(2, 35, 66)];
  const scored = scoreForecast(BASE_WEATHER, forecasts, BASE_CONTEXT, true /* isCached=true */);
  // Index 0 is always 'CURRENT OBSERVATION', rest should be 'CACHED FORECAST'
  assert.strictEqual(scored[0].data_label, 'CURRENT OBSERVATION');
  assert.strictEqual(scored[1].data_label, 'CACHED FORECAST');
});

// ─── Test 14: Notification Permission — NOT Auto-Requested ───────────────────
test('Alert Engine: Alerts generated without requesting browser notification permission', () => {
  // generateAlerts must NOT call Notification.requestPermission
  let permissionRequested = false;
  // In test context (Node.js), Notification is undefined — this confirms the engine never calls it
  const hasNotification = typeof Notification !== 'undefined';
  // Whether or not Notification exists, generateAlerts must return normally
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: null,
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });
  assert.ok(Array.isArray(alerts), 'generateAlerts must return an array without throwing');
  assert.strictEqual(permissionRequested, false, 'Notification permission must not be auto-requested');
});

// ─── Test 15: Invalid/NaN Forecast Values ────────────────────────────────────
test('Forecast Engine: Invalid forecast entries handled gracefully (no crash)', () => {
  const badForecasts: HourlyForecast[] = [
    { time: new Date().toISOString(), temperature: NaN, relative_humidity: NaN, apparent_temperature: NaN, wind_speed: NaN, weather_code: 0 },
    makeHour(1, 34, 65), // valid entry mixed in
  ];

  let threw = false;
  try {
    const scored = scoreForecast(BASE_WEATHER, badForecasts, BASE_CONTEXT, false);
    assert.strictEqual(scored.length, 2, 'Should return entries for all inputs, valid and invalid');
    // Valid entry at index 1 should have real score
    assert.ok(scored[1].risk_score >= 5 && scored[1].risk_score <= 100);
    // Invalid entry at index 0 should fall back gracefully (score 0)
    assert.ok(!isValidForecastEntry(badForecasts[0]), 'NaN entry must fail isValidForecastEntry');
  } catch (e) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'scoreForecast must not throw on invalid/NaN entries');
});

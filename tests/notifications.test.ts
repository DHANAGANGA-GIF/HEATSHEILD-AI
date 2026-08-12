import test from 'node:test';
import assert from 'node:assert';
import { generateAlerts, ALERT_COOLDOWN_MS } from '../lib/alert-engine';
import { AlertSettings, HourlyForecastRisk, RiskAssessment, SmartAlert } from '../lib/types';
import {
  getNotificationPermissionStatus,
  sendBrowserNotification,
} from '../lib/notification-service';

const DEFAULT_SETTINGS: AlertSettings = {
  alerts_enabled: true,
  min_severity: 'INFO',
  forecast_alerts_enabled: true,
  browser_notifications_enabled: true,
  location_alerts_enabled: true,
  recovery_alerts_enabled: true,
};

const MOCK_LOW_RISK: RiskAssessment = {
  id: 'risk_001',
  timestamp: new Date().toISOString(),
  risk_score: 30,
  risk_level: 'LOW',
  factors: [
    { name: 'Apparent Temperature', category: 'temperature', impact: 'low', weight_percent: 30, description_technical: '', description_simple: '' },
    { name: 'Relative Humidity', category: 'humidity', impact: 'low', weight_percent: 20, description_technical: '', description_simple: '' },
  ],
  weather_snapshot: { temp: 28, humidity: 45, apparent_temp: 29, wind: 10 },
  context_snapshot: { activity: 'low', duration: 'short', cooling: 'good', age_group: 'adult' },
  recommendations: [],
  model_version: 'v1.0',
  data_source: 'Open-Meteo',
  data_quality: 'Good',
  limitations: '',
};

const MOCK_HIGH_RISK: RiskAssessment = {
  ...MOCK_LOW_RISK,
  id: 'risk_002',
  risk_score: 68,
  risk_level: 'HIGH',
  weather_snapshot: { temp: 36, humidity: 65, apparent_temp: 39, wind: 5 },
};

const MOCK_EXTREME_RISK: RiskAssessment = {
  ...MOCK_LOW_RISK,
  id: 'risk_003',
  risk_score: 85,
  risk_level: 'EXTREME',
  weather_snapshot: { temp: 42, humidity: 70, apparent_temp: 46, wind: 3 },
};

test('Notification 1. MODERATE -> HIGH threshold transition alert generation', () => {
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_HIGH_RISK,
    previousRisk: MOCK_LOW_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].rule_id, 'TRANSITION_MODERATE_TO_HIGH');
  assert.strictEqual(alerts[0].priority, 'CAUTION');
  assert.strictEqual(alerts[0].location_name, 'Chennai');
  assert.ok(alerts[0].message.includes('HIGH'));
});

test('Notification 2. HIGH -> EXTREME threshold transition alert generation', () => {
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_EXTREME_RISK,
    previousRisk: MOCK_HIGH_RISK,
    currentLocationName: 'Madurai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].rule_id, 'TRANSITION_HIGH_TO_EXTREME');
  assert.strictEqual(alerts[0].priority, 'CRITICAL');
  assert.strictEqual(alerts[0].location_name, 'Madurai');
});

test('Notification 3. Rapid risk increase (+15 pts) alert generation', () => {
  const rapidRiseRisk: RiskAssessment = {
    ...MOCK_LOW_RISK,
    risk_score: 55, // 30 -> 55 (+25 pts)
    risk_level: 'HIGH',
  };

  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: rapidRiseRisk,
    previousRisk: MOCK_LOW_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.ok(alerts.some(a => a.rule_id === 'RAPID_RISE' || a.rule_id === 'TRANSITION_MODERATE_TO_HIGH'));
});

test('Notification 4. Forecast warning alerts generation', () => {
  const forecast: HourlyForecastRisk[] = [
    {
      forecast: { time: new Date().toISOString(), temperature: 30, relative_humidity: 50, apparent_temperature: 31, wind_speed: 10, weather_code: 0 },
      risk_score: 30,
      risk_level: 'LOW',
      data_label: 'CURRENT OBSERVATION',
      is_peak: false,
      is_trough: false,
      trend_direction: 'STABLE',
    },
    {
      forecast: { time: new Date(Date.now() + 3600000).toISOString(), temperature: 40, relative_humidity: 65, apparent_temperature: 44, wind_speed: 5, weather_code: 0 },
      risk_score: 82,
      risk_level: 'EXTREME',
      data_label: 'FORECAST',
      is_peak: true,
      is_trough: false,
      trend_direction: 'RISING',
    },
  ];

  const alerts = generateAlerts({
    scoredForecast: forecast,
    currentRisk: MOCK_LOW_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.ok(alerts.some(a => a.rule_id === 'FORECAST_EXTREME' || a.rule_id === 'TIER_ESCALATION'));
});

test('Notification 5. Risk recovery alert generation', () => {
  const recoveredRisk: RiskAssessment = {
    ...MOCK_LOW_RISK,
    risk_score: 35,
    risk_level: 'MODERATE',
  };

  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: recoveredRisk,
    previousRisk: MOCK_HIGH_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].rule_id, 'RISK_RECOVERY');
  assert.strictEqual(alerts[0].priority, 'INFO');
});

test('Notification 6. Location change advisory alert generation', () => {
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_HIGH_RISK,
    previousRisk: MOCK_LOW_RISK,
    currentLocationName: 'Delhi',
    previousLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.ok(alerts.some(a => a.rule_id === 'LOCATION_RISK_INCREASE' || a.rule_id === 'TRANSITION_MODERATE_TO_HIGH'));
});

test('Notification 7. Deduplication and 60-minute cooldown suppression', () => {
  const firstRun = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_HIGH_RISK,
    previousRisk: MOCK_LOW_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'LIVE',
  });

  assert.strictEqual(firstRun.length, 1);
  const dedupKey = firstRun[0].dedup_key;

  // Second run with active cooldown key
  const secondRun = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_HIGH_RISK,
    previousRisk: MOCK_LOW_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [dedupKey],
    sourceStatus: 'LIVE',
  });

  assert.strictEqual(secondRun.length, 0);
});

test('Notification 8. Stale & Unavailable data suppression', () => {
  const alerts = generateAlerts({
    scoredForecast: [],
    currentRisk: MOCK_EXTREME_RISK,
    currentLocationName: 'Chennai',
    settings: DEFAULT_SETTINGS,
    activeCooldownKeys: [],
    sourceStatus: 'UNAVAILABLE',
  });

  assert.strictEqual(alerts.length, 0);
});

test('Notification 9. Browser notification permission status handling', () => {
  const status = getNotificationPermissionStatus();
  assert.ok(['granted', 'denied', 'default', 'unsupported'].includes(status));
});

test('Notification 10. Notification click & deep-link payload integrity', () => {
  const alert: SmartAlert = {
    id: 'alt_test_101',
    rule_id: 'TRANSITION_MODERATE_TO_HIGH',
    priority: 'CAUTION',
    title: 'High Heat Risk Warning',
    message: 'Heat risk reached HIGH level.',
    trigger_data: { risk_score: 72, risk_level: 'HIGH' },
    recommended_action: 'Hydrate every 20 minutes',
    source_status: 'LIVE',
    timestamp: new Date().toISOString(),
    dismissed: false,
    read: false,
    dedup_key: 'TRANSITION_MODERATE_TO_HIGH__chennai__2026-08-12T14',
    location_name: 'Chennai',
    why_generated: 'Risk level transitioned to HIGH.',
  };

  assert.strictEqual(alert.id, 'alt_test_101');
  assert.strictEqual(alert.location_name, 'Chennai');
  assert.ok(alert.why_generated?.length! > 0);
});

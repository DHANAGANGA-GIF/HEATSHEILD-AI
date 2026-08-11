import assert from 'node:assert';
import { test } from 'node:test';
import { calculateHeatIndex, evaluateHeatRisk } from '../lib/risk-engine';

test('Steadman Heat Index Calculation', () => {
  // Test mild ambient temp below 20°C
  const mild = calculateHeatIndex(18, 50);
  assert.strictEqual(mild, 18);

  // Test high heat & humidity (35°C, 75% RH) -> expect Heat Index > 42°C
  const highHI = calculateHeatIndex(35, 75);
  assert.ok(highHI > 40, `Expected HI > 40, got ${highHI}`);
});

test('Heat Risk Engine Evaluation', () => {
  const mockWeather = {
    temperature: 36,
    relative_humidity: 70,
    apparent_temperature: 42,
    wind_speed: 10,
    pressure: 1008,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    location: { name: 'Test Loc', latitude: 13.0, longitude: 80.0 },
  };

  const risk = evaluateHeatRisk(mockWeather, {
    activity: 'high',
    duration: 'long',
    cooling: 'limited',
    age_group: 'adult',
  });

  assert.ok(risk.risk_score >= 61, `Expected High/Extreme risk score >= 61, got ${risk.risk_score}`);
  assert.ok(risk.factors.length > 0, 'Risk factors array should not be empty');
  assert.ok(risk.recommendations.length > 0, 'Recommendations array should not be empty');
});

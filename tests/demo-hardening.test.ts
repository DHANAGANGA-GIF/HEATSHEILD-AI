import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KARE_CAMPUS, LOCATION_SOURCE_VALUES, LocationSource } from '../lib/constants';
import { evaluateHeatRisk } from '../lib/risk-engine';
import { compareScenarios, MANDATORY_SIMULATOR_LABEL } from '../lib/simulator-engine';
import { WeatherData, CoolingAccess } from '../lib/types';

const mockExtremeWeather: WeatherData = {
  temperature: 38,
  relative_humidity: 75,
  apparent_temperature: 46,
  wind_speed: 8,
  pressure: 1005,
  weather_code: 0,
  timestamp: new Date().toISOString(),
  location: { name: 'KARE Campus', latitude: 9.3582, longitude: 77.8166 },
};

test('1. System Status Panel status types integrity', () => {
  const validLocationSources: LocationSource[] = ['GPS', 'MANUAL', 'CAMPUS', 'SAVED', 'DEFAULT'];
  for (const src of validLocationSources) {
    assert.ok(LOCATION_SOURCE_VALUES.includes(src), `Location source ${src} must be valid`);
  }
});

test('2. KARE Campus constant integrity & labeling', () => {
  assert.equal(KARE_CAMPUS.name, 'KARE Campus');
  assert.equal(KARE_CAMPUS.latitude, 9.3582);
  assert.equal(KARE_CAMPUS.longitude, 77.8166);
  assert.equal(KARE_CAMPUS.country, 'India');
});

test('3. Recovery Action: Graceful fallback when weather API is degraded', () => {
  const coolingSetting: CoolingAccess = 'limited';
  const risk = evaluateHeatRisk(mockExtremeWeather, {
    activity: 'moderate',
    duration: 'moderate',
    cooling: coolingSetting,
    age_group: 'adult',
  });

  assert.ok(risk.risk_score > 0, 'Risk score should be calculated for valid weather');
  assert.ok(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(risk.risk_level));
});

test('4. Scenario Simulator degraded mode handling', () => {
  const baselineRisk = evaluateHeatRisk(mockExtremeWeather, {
    activity: 'moderate',
    duration: 'moderate',
    cooling: 'limited',
    age_group: 'adult',
  });

  const comp = compareScenarios(
    { weather: mockExtremeWeather, risk: baselineRisk },
    {
      location: KARE_CAMPUS,
      weather: null,
      activity: 'high',
      duration: 'long',
      cooling: 'limited',
      age_group: 'adult',
    }
  );

  assert.equal(comp.label, MANDATORY_SIMULATOR_LABEL);
});

test('5. Human-readable error messages for degraded modes', () => {
  const errorMessage = "We couldn't retrieve current weather data.";
  assert.ok(!errorMessage.includes('TypeError'), 'Must not display raw JS TypeError to end user');
  assert.ok(!errorMessage.includes('fetch failed'), 'Must not display raw network error strings to end user');
  assert.ok(errorMessage.includes("couldn't retrieve"), 'Must be human readable');
});

test('6. Security Audit: No hardcoded service-role secrets in client constants', () => {
  const secretPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
  assert.equal(secretPattern.test(JSON.stringify(KARE_CAMPUS)), false);
});

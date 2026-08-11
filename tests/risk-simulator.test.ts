import assert from 'node:assert';
import { test } from 'node:test';
import { compareScenarios, MANDATORY_SIMULATOR_LABEL } from '../lib/simulator-engine';
import { evaluateHeatRisk } from '../lib/risk-engine';

const mockBaselineWeather = {
  temperature: 34,
  relative_humidity: 60,
  apparent_temperature: 38,
  wind_speed: 10,
  pressure: 1008,
  weather_code: 0,
  timestamp: new Date().toISOString(),
  is_cached: false,
  location: { name: 'Chennai Baseline', latitude: 13.0827, longitude: 80.2707 },
};

const mockBaselineContext = {
  activity: 'low' as const,
  duration: 'short' as const,
  cooling: 'good' as const,
  age_group: 'adult' as const,
};

const mockBaselineRisk = evaluateHeatRisk(mockBaselineWeather, mockBaselineContext);

// Test 1: Baseline Scenario Initialization
test('Risk Simulator: Baseline Scenario Initialization', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'low',
      duration: 'short',
      cooling: 'good',
      age_group: 'adult',
      weather: mockBaselineWeather,
    }
  );

  assert.strictEqual(result.baselineScore, mockBaselineRisk.risk_score);
  assert.strictEqual(result.scenarioScore, mockBaselineRisk.risk_score);
  assert.strictEqual(result.scoreDiff, 0);
  assert.strictEqual(result.levelShift, 'SAME');
  assert.strictEqual(result.changedFactors.length, 0);
  assert.strictEqual(result.dataStatus, 'LIVE');
});

// Test 2: Activity Change Scenario
test('Risk Simulator: Activity Level Change Scenario', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'short',
      cooling: 'good',
      age_group: 'adult',
      weather: mockBaselineWeather,
    }
  );

  assert.ok(result.scenarioScore > result.baselineScore, 'High activity should increase risk score');
  assert.ok(result.scoreDiff > 0, 'Score difference should be positive');
  assert.strictEqual(result.levelShift, 'ESCALATED');
  assert.ok(result.changedFactors.some((f) => f.factorName === 'Physical Workload'));
});

// Test 3: Exposure Duration Change Scenario
test('Risk Simulator: Exposure Duration Change Scenario', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'low',
      duration: 'long',
      cooling: 'good',
      age_group: 'adult',
      weather: mockBaselineWeather,
    }
  );

  assert.ok(result.scenarioScore > result.baselineScore, 'Long exposure duration should increase risk score');
  assert.ok(result.changedFactors.some((f) => f.factorName === 'Exposure Duration'));
});

// Test 4: Location Change Scenario
test('Risk Simulator: Location Change Scenario', () => {
  const hotterScenarioWeather = {
    ...mockBaselineWeather,
    temperature: 42,
    apparent_temperature: 48,
    location: { name: 'New Delhi Scenario', latitude: 28.6139, longitude: 77.209 },
  };

  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'low',
      duration: 'short',
      cooling: 'good',
      age_group: 'adult',
      weather: hotterScenarioWeather,
    }
  );

  assert.ok(result.scenarioScore > result.baselineScore, 'Hotter location should increase risk score');
  assert.ok(result.changedFactors.some((f) => f.factorName === 'Location & Microclimate'));
});

// Test 5: Risk Score Comparison & Difference Calculation
test('Risk Simulator: Score Diff Calculation', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'long',
      cooling: 'limited',
      age_group: 'older_adult',
      weather: mockBaselineWeather,
    }
  );

  const expectedDiff = result.scenarioScore - result.baselineScore;
  assert.strictEqual(result.scoreDiff, expectedDiff);
});

// Test 6: Risk Tier Transition
test('Risk Simulator: Risk Tier Transition', () => {
  const extremeWeather = {
    ...mockBaselineWeather,
    temperature: 44,
    apparent_temperature: 52,
    relative_humidity: 80,
  };

  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'long',
      cooling: 'prefer_not_to_say',
      age_group: 'older_adult',
      weather: extremeWeather,
    }
  );

  assert.strictEqual(result.scenarioLevel, 'EXTREME');
  assert.strictEqual(result.levelShift, 'ESCALATED');
});

// Test 7: Invalid & Extreme Input Handling
test('Risk Simulator: Extreme Input Values', () => {
  const extremeInputWeather = {
    ...mockBaselineWeather,
    temperature: 55,
    apparent_temperature: 65,
    relative_humidity: 99,
  };

  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'long',
      cooling: 'prefer_not_to_say',
      age_group: 'older_adult',
      weather: extremeInputWeather,
    }
  );

  assert.ok(result.scenarioScore <= 100, 'Score must be capped at 100 max');
  assert.ok(result.scenarioScore >= 5, 'Score must be at least 5 min');
});

// Test 8: Reset Scenario Functionality
test('Risk Simulator: Reset Scenario', () => {
  const initial = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: mockBaselineContext.activity,
      duration: mockBaselineContext.duration,
      cooling: mockBaselineContext.cooling,
      age_group: mockBaselineContext.age_group,
      weather: mockBaselineWeather,
    }
  );

  assert.strictEqual(initial.scoreDiff, 0);
  assert.strictEqual(initial.changedFactors.length, 0);
});

// Test 9: Missing Weather Data Handling
test('Risk Simulator: Missing Weather Data Handling', () => {
  const result = compareScenarios(
    { weather: null, risk: null },
    {
      activity: 'high',
      duration: 'long',
      cooling: 'limited',
      age_group: 'adult',
      weather: null,
    }
  );

  assert.strictEqual(result.dataStatus, 'UNAVAILABLE');
  assert.strictEqual(result.scenarioAssessment, null);
  assert.strictEqual(result.label, MANDATORY_SIMULATOR_LABEL);
});

// Test 10: ML Prediction vs Contextual Adjustment Distinction
test('Risk Simulator: ML & Contextual Notice Inclusion', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'long',
      cooling: 'good',
      age_group: 'adult',
      weather: mockBaselineWeather,
    }
  );

  assert.ok(result.mlInferenceNotice.includes('ML PREDICTION'));
  assert.ok(result.mlInferenceNotice.includes('CONTEXTUAL SCENARIO ADJUSTMENT'));
});

// Test 11: Mandatory Scenario Labeling Assertion
test('Risk Simulator: Mandatory Labeling Assertion', () => {
  const result = compareScenarios(
    { weather: mockBaselineWeather, risk: mockBaselineRisk },
    {
      activity: 'high',
      duration: 'short',
      cooling: 'good',
      age_group: 'adult',
      weather: mockBaselineWeather,
    }
  );

  assert.strictEqual(result.label, 'SCENARIO ESTIMATE — NOT A LIVE OBSERVATION');
});

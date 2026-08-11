import assert from 'node:assert';
import { test } from 'node:test';
import { generateAssistantResponse } from '../lib/ai-assistant';

const mockRisk = {
  id: 'r1',
  timestamp: new Date().toISOString(),
  risk_score: 75,
  risk_level: 'HIGH' as const,
  factors: [
    {
      name: 'Air Temperature',
      category: 'temperature' as const,
      impact: 'high' as const,
      weight_percent: 40,
      description_technical: 'High ambient air temperature imposing thermal load.',
      description_simple: 'Air temperature is very hot.',
    },
    {
      name: 'Relative Humidity',
      category: 'humidity' as const,
      impact: 'moderate' as const,
      weight_percent: 25,
      description_technical: 'Elevated atmospheric moisture inhibiting sweat evaporation.',
      description_simple: 'High humidity makes it harder to cool down.',
    },
  ],
  weather_snapshot: { temp: 36, humidity: 65, apparent_temp: 41, wind: 10 },
  context_snapshot: { activity: 'high' as const, duration: 'long' as const, cooling: 'limited' as const, age_group: 'adult' as const },
  recommendations: [
    {
      id: 'g1',
      category: 'hydration' as const,
      title: 'Increased Fluid Intake',
      technical_text: 'Consume 500-750mL of electrolyte-enhanced fluid per hour of active exposure.',
      simple_text: 'Drink plenty of water or electoral drinks every hour.',
      priority: 'high' as const,
    },
  ],
  model_version: 'v1.2',
  data_source: 'Open-Meteo',
  data_quality: 'Good' as const,
  limitations: 'Microclimate',
};

const mockWeather = {
  temperature: 36,
  relative_humidity: 65,
  apparent_temperature: 41,
  wind_speed: 10,
  pressure: 1008,
  weather_code: 0,
  timestamp: new Date().toISOString(),
  is_cached: false,
  location: { name: 'Test City', latitude: 13, longitude: 80 },
  hourly_forecast: [
    {
      time: '2026-08-11T14:00:00Z',
      temperature: 38,
      relative_humidity: 60,
      apparent_temperature: 45,
      wind_speed: 12,
      weather_code: 0,
    },
  ],
};

// Test 1: Emergency Safety Filter
test('AI Assistant: Emergency Safety Trigger', () => {
  const resp = generateAssistantResponse('Someone fainted and has chest pain', mockRisk, mockWeather, 'technical');
  assert.strictEqual(resp.is_emergency_warning, true);
  assert.ok(resp.text.includes('EMERGENCY REFERRAL NOTICE'));
  assert.ok(resp.text.includes('DOES NOT perform medical diagnosis'));
  assert.ok(resp.text.includes('108 / 112 / 911'));
});

// Test 2: Risk Driver Question
test('AI Assistant: Risk Driver Question', () => {
  const resp = generateAssistantResponse('Why is my risk high?', mockRisk, mockWeather, 'technical');
  assert.strictEqual(resp.is_emergency_warning, undefined);
  assert.strictEqual(resp.data_status, 'LIVE');
  assert.ok(resp.text.includes('75'));
  assert.ok(resp.text.includes('Air Temperature'));
  assert.ok(resp.text.includes('MAIN DRIVERS'));
});

// Test 3: Guidance / Precautions Question
test('AI Assistant: Guidance & Precautions Question', () => {
  const resp = generateAssistantResponse('What precautions should I take right now?', mockRisk, mockWeather, 'technical');
  assert.ok(resp.text.includes('Increased Fluid Intake'));
  assert.ok(resp.text.includes('ACTION'));
});

// Test 4: Forecast Question
test('AI Assistant: Forecast & Peak Hours Question', () => {
  const resp = generateAssistantResponse('When will the risk be highest?', mockRisk, mockWeather, 'technical');
  assert.ok(resp.text.includes('FORECAST'));
  assert.ok(resp.text.includes('45'));
});

// Test 5: Simple Mode
test('AI Assistant: Simple Mode Response', () => {
  const resp = generateAssistantResponse('Explain my risk simply', mockRisk, mockWeather, 'simple');
  assert.ok(resp.text.includes('Your Heat Risk is HIGH'));
  assert.ok(resp.text.includes('Air temperature is very hot'));
});

// Test 6: Technical Mode
test('AI Assistant: Technical Mode Response', () => {
  const resp = generateAssistantResponse('Explain my risk technically', mockRisk, mockWeather, 'technical');
  assert.ok(resp.text.includes('Air Temp: 36°C'));
  assert.ok(resp.text.includes('Elevated atmospheric moisture'));
});

// Test 7: Missing Environmental / Risk Data
test('AI Assistant: Missing Environmental Data Handling', () => {
  const resp = generateAssistantResponse('Why is my risk high?', null, null, 'technical');
  assert.strictEqual(resp.data_status, 'UNAVAILABLE');
  assert.ok(resp.text.includes('Environmental observation data is currently unavailable'));
  assert.ok(resp.text.includes('DATA STATUS\n→ UNAVAILABLE'));
});

// Test 8: Empty Input Handling
test('AI Assistant: Empty Input Handling', () => {
  const resp = generateAssistantResponse('', mockRisk, mockWeather, 'technical');
  assert.ok(resp.text.includes('Please ask a question'));
});

// Test 9: Cached Data Status Preservation
test('AI Assistant: Cached Data Status Preservation', () => {
  const cachedWeather = { ...mockWeather, is_cached: true };
  const resp = generateAssistantResponse('What precautions should I take?', mockRisk, cachedWeather, 'technical');
  assert.strictEqual(resp.data_status, 'CACHED');
  assert.ok(resp.text.includes('DATA STATUS\n→ CACHED'));
});

// Test 10: General Fallback Question
test('AI Assistant: General Fallback Question', () => {
  const resp = generateAssistantResponse('Tell me about HeatShield', mockRisk, mockWeather, 'technical');
  assert.ok(resp.text.includes('CURRENT CONDITIONS'));
  assert.ok(resp.text.includes('RISK'));
});

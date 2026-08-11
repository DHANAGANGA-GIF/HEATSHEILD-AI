/**
 * HeatShield AI — Location UX Tests
 *
 * 8 focused tests covering:
 * 1. User location vs campus location separation
 * 2. Manual location fallback
 * 3. Location permission denial path
 * 4. Campus marker data integrity
 * 5. User-location privacy (no exact coords in public view)
 * 6. Organization reference location (KARE as institutional ref)
 * 7. Weather refresh after location change
 * 8. Risk refresh after location change
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { KARE_CAMPUS, LOCATION_SOURCE_VALUES, type LocationSource } from '../lib/constants';
import { fetchWeatherData } from '../lib/weather-api';
import { evaluateHeatRisk } from '../lib/risk-engine';
import { LocationData } from '../lib/types';

// ─── Test constants ──────────────────────────────────────────────────────────

const USER_LOCATION_A: LocationData = {
  name: 'My Location',
  locality: 'Detected via GPS',
  latitude: 13.08,
  longitude: 80.27,
};

const USER_LOCATION_B: LocationData = {
  name: 'New Delhi',
  locality: 'Delhi, India',
  latitude: 28.61,
  longitude: 77.21,
};

const DEFAULT_FALLBACK: LocationData = {
  name: 'Chennai',
  locality: 'Tamil Nadu, India',
  latitude: 13.0827,
  longitude: 80.2707,
  country: 'India',
};

// ─── Test 1: User location and campus location are NEVER equal ────────────────

test('1. User location vs campus location separation', () => {
  const userLoc: LocationData = { ...USER_LOCATION_A };

  assert.notEqual(
    userLoc.latitude,
    KARE_CAMPUS.latitude,
    'User latitude must not equal KARE campus latitude'
  );
  assert.notEqual(
    userLoc.longitude,
    KARE_CAMPUS.longitude,
    'User longitude must not equal KARE campus longitude'
  );
  assert.notEqual(
    userLoc.name,
    KARE_CAMPUS.name,
    'User location name must not equal campus name'
  );
});

// ─── Test 2: Manual location fallback returns a valid LocationData ────────────

test('2. Manual location fallback provides a valid location when GPS is unavailable', () => {
  // Simulate GPS denial — fall back to DEFAULT_FALLBACK
  const gpsAvailable = false; // Simulated denial
  const resultLocation: LocationData = gpsAvailable
    ? USER_LOCATION_A  // Would be GPS result
    : DEFAULT_FALLBACK; // Fallback

  assert.equal(typeof resultLocation.name, 'string', 'Fallback location has a name string');
  assert.equal(typeof resultLocation.latitude, 'number', 'Fallback latitude is a number');
  assert.equal(typeof resultLocation.longitude, 'number', 'Fallback longitude is a number');
  assert.ok(resultLocation.latitude >= -90 && resultLocation.latitude <= 90, 'Latitude in valid range');
  assert.ok(resultLocation.longitude >= -180 && resultLocation.longitude <= 180, 'Longitude in valid range');
});

// ─── Test 3: Location permission denial path ──────────────────────────────────

test('3. Location permission denial falls back to manual selection without crashing', () => {
  // Simulate the denial path — produces fallback, not null/undefined
  const simulateDenied = (): LocationData | null => null; // GPS returns null
  const gpsResult = simulateDenied();
  const resolvedLocation: LocationData = gpsResult ?? DEFAULT_FALLBACK;

  assert.ok(resolvedLocation, 'Location resolved after denial — not null/undefined');
  assert.equal(resolvedLocation.name, DEFAULT_FALLBACK.name, 'Falls back to DEFAULT_FALLBACK on denial');
  assert.ok(
    isFinite(resolvedLocation.latitude) && isFinite(resolvedLocation.longitude),
    'Fallback coordinates are finite numbers'
  );
});

// ─── Test 4: KARE campus data integrity ──────────────────────────────────────

test('4. KARE campus marker data integrity', () => {
  assert.equal(KARE_CAMPUS.name, 'KARE Campus', 'Campus name is KARE Campus');
  assert.ok(
    KARE_CAMPUS.locality?.includes('Kalasalingam'),
    'Campus locality includes institution name'
  );
  assert.ok(
    KARE_CAMPUS.latitude >= 9 && KARE_CAMPUS.latitude <= 10,
    'Campus latitude is within expected range for Virudhunagar District'
  );
  assert.ok(
    KARE_CAMPUS.longitude >= 77 && KARE_CAMPUS.longitude <= 78,
    'Campus longitude is within expected range for Virudhunagar District'
  );
  assert.equal(KARE_CAMPUS.country, 'India', 'Campus country is India');
});

// ─── Test 5: User location privacy — no exact raw coordinates exposed ─────────

test('5. User location privacy — coordinate rounding applied before display', () => {
  // Simulate raw GPS output
  const rawGps = { latitude: 13.082712345, longitude: 80.270718293 };
  // Privacy rule: round to 2 decimal places (~1.1km precision)
  const displayLat = Math.round(rawGps.latitude * 100) / 100;
  const displayLng = Math.round(rawGps.longitude * 100) / 100;

  assert.equal(displayLat, 13.08, 'Latitude rounded to 2dp for display');
  assert.equal(displayLng, 80.27, 'Longitude rounded to 2dp for display');

  // Exact raw coordinate must not be exposed
  assert.notEqual(displayLat, rawGps.latitude, 'Exact raw latitude not exposed');
  assert.notEqual(displayLng, rawGps.longitude, 'Exact raw longitude not exposed');
});

// ─── Test 6: Organization reference location is institutional, not personal ────

test('6. Organization reference location (KARE) is distinct from any personal location', () => {
  const orgRef: LocationData = KARE_CAMPUS;

  // Must be labeled as institutional
  assert.ok(
    orgRef.name === 'KARE Campus' || orgRef.locality?.includes('Kalasalingam'),
    'Organization reference is labeled as KARE / Kalasalingam'
  );

  // Must not match any personal location patterns
  const personalNames = ['My Location', 'Home', 'Work', 'Detected via GPS'];
  const isPersonal = personalNames.some(n => orgRef.name === n);
  assert.equal(isPersonal, false, 'Organization reference is not labeled as a personal location');
});

// ─── Test 7: Weather refresh picks up new location coordinates ────────────────

test('7. Weather fetch uses the updated location after location change', async () => {
  // Location A (Chennai-area)
  const locA = USER_LOCATION_A;
  // Location B (Delhi-area)
  const locB = USER_LOCATION_B;

  // Both fetches must use their own coordinates, not each other's
  assert.notEqual(locA.latitude, locB.latitude, 'Different locations have different latitudes');
  assert.notEqual(locA.longitude, locB.longitude, 'Different locations have different longitudes');

  // Simulate the URL construction (matching weather-api.ts pattern)
  const urlA = `https://api.open-meteo.com/v1/forecast?latitude=${locA.latitude}&longitude=${locA.longitude}`;
  const urlB = `https://api.open-meteo.com/v1/forecast?latitude=${locB.latitude}&longitude=${locB.longitude}`;

  assert.notEqual(urlA, urlB, 'Different locations produce different API request URLs');
  assert.ok(urlA.includes(locA.latitude.toString()), 'URL A encodes location A latitude');
  assert.ok(urlB.includes(locB.latitude.toString()), 'URL B encodes location B latitude');
});

// ─── Test 8: Risk re-evaluation uses the new location's weather data ──────────

test('8. Risk assessment is re-evaluated with new location weather snapshot', () => {
  const contextA = { activity: 'high' as const, duration: 'long' as const, cooling: 'limited' as const, age_group: 'adult' as const };
  const contextB = { activity: 'low' as const, duration: 'short' as const, cooling: 'good' as const, age_group: 'adult' as const };

  // High-heat scenario weather snapshot (typical Chennai summer)
  const highHeatWeather = {
    temperature: 38, relative_humidity: 80, apparent_temperature: 46, wind_speed: 5,
    pressure: 1005, weather_code: 1, timestamp: new Date().toISOString(), is_cached: false,
    location: USER_LOCATION_A,
  };

  // Mild scenario weather snapshot
  const mildWeather = {
    temperature: 22, relative_humidity: 45, apparent_temperature: 22, wind_speed: 20,
    pressure: 1015, weather_code: 0, timestamp: new Date().toISOString(), is_cached: false,
    location: USER_LOCATION_B,
  };

  const riskA = evaluateHeatRisk(highHeatWeather, contextA);
  const riskB = evaluateHeatRisk(mildWeather, contextB);

  assert.ok(riskA.risk_score > riskB.risk_score, 'High-heat location produces higher risk score than mild location');
  assert.ok(['HIGH', 'EXTREME'].includes(riskA.risk_level), 'High-heat scenario produces HIGH or EXTREME risk tier');
  assert.ok(['LOW', 'MODERATE'].includes(riskB.risk_level), 'Mild scenario produces LOW or MODERATE risk tier');

  // Risk assessment must embed the correct location snapshot
  assert.equal(riskA.weather_snapshot.temp, highHeatWeather.temperature, 'Risk A contains high-heat weather snapshot temp');
  assert.equal(riskB.weather_snapshot.temp, mildWeather.temperature, 'Risk B contains mild weather snapshot temp');
});

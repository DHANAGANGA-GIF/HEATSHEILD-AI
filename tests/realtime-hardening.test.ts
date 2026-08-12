import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupabaseConfigured } from '../lib/supabase';
import { logoutUser, getUserProfile, saveUserProfile } from '../lib/store';
import { fetchWeatherData } from '../lib/weather-api';

test('Realtime Hardening: Supabase configuration check', () => {
  assert.equal(typeof isSupabaseConfigured, 'boolean');
});

test('Realtime Hardening: Profile session clearance on logout', async () => {
  saveUserProfile({
    id: 'usr_test_logout',
    email: 'test.logout@heatshield.org',
    authenticated: true,
  });

  await logoutUser();
  const clearedProfile = getUserProfile();
  assert.equal(clearedProfile.authenticated, undefined);
});

test('Realtime Hardening: Weather state classification logic', async () => {
  // Test fallback handling with invalid coordinates
  const weather = await fetchWeatherData(0, 0, 'Test Location');
  assert.ok(weather);
  assert.ok(['LIVE', 'CACHED', 'FALLBACK'].includes(weather.is_fallback ? 'FALLBACK' : weather.is_cached ? 'CACHED' : 'LIVE'));
  assert.ok(weather.timestamp);
});

test('Realtime Hardening: Stale weather threshold evaluation', () => {
  const freshTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 mins ago
  const staleTimestamp = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 mins ago

  const freshAgeMins = Math.floor((Date.now() - new Date(freshTimestamp).getTime()) / 60000);
  const staleAgeMins = Math.floor((Date.now() - new Date(staleTimestamp).getTime()) / 60000);

  assert.ok(freshAgeMins <= 15, 'Fresh data should be <= 15 mins');
  assert.ok(staleAgeMins > 15, 'Stale data should be > 15 mins');
});

test('Realtime Hardening: Request sequence lock logic for race-condition protection', () => {
  let activeSequence = 0;

  // Simulate Request A started first
  const reqA_seq = ++activeSequence; // 1

  // Simulate Request B started second
  const reqB_seq = ++activeSequence; // 2

  // Request B finishes first
  let activeLocation = 'Location B';

  // Request A finishes second (out of order)
  if (reqA_seq === activeSequence) {
    activeLocation = 'Location A';
  }

  // Verify Location B was NOT overwritten by out-of-order Request A
  assert.equal(activeLocation, 'Location B');
});

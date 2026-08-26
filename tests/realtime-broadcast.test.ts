import test from 'node:test';
import assert from 'node:assert';
import { broadcastLiveAlertsToAllRecipients } from '../lib/broadcast-service';
import { saveUserProfile, getRecipientProfiles, getNotificationLogs, saveRecipientProfile } from '../lib/store';
import { calculateRiskAssessment } from '../lib/risk-engine';
import { generatePersonalizedGuidance } from '../lib/guidance-engine';

test('1. Broadcast Engine: Dispatches live thermal alerts & precautions to all registered users', async () => {
  const result = await broadcastLiveAlertsToAllRecipients({
    sendToAll: true,
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.totalRecipients >= 4, 'Should broadcast to all registered recipients');
  assert.strictEqual(result.successfulDispatches, result.totalRecipients);
  assert.strictEqual(result.failedDispatches, 0);

  // Check each recipient result
  for (const item of result.results) {
    assert.ok(item.recipient.includes('@'), 'Recipient must have valid email');
    assert.strictEqual(item.success, true);
    assert.strictEqual(item.channel, 'EMAIL');
    assert.ok(item.locationName.length > 0, 'Must have resolved location name');
    assert.ok(item.temperature !== undefined, 'Must have temperature data');
    assert.ok(item.riskScore !== undefined, 'Must have risk score');
    assert.ok(item.precautionsCount && item.precautionsCount >= 5, 'Must have at least 5 precautions');
  }
});

test('2. Broadcast Engine: Single recipient target dispatch with custom subject', async () => {
  const target = '99240040560@klu.ac.in';
  const customSub = 'Emergency Heat Advisory - Immediate Action Required';

  const result = await broadcastLiveAlertsToAllRecipients({
    targetEmail: target,
    sendToAll: false,
    customSubject: customSub,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalRecipients, 1);
  assert.strictEqual(result.results[0].recipient.toLowerCase(), target.toLowerCase());
  assert.strictEqual(result.results[0].success, true);
});

test('3. Broadcast Engine: Client live GPS coordinate override', async () => {
  const liveGpsOverride = {
    latitude: 17.3850,
    longitude: 78.4867,
    location_name: 'Hyderabad Central',
    location_source: 'LIVE_GPS' as const,
    gps_accuracy: 8,
  };

  const result = await broadcastLiveAlertsToAllRecipients({
    targetEmail: 'live.gps.user@example.com',
    sendToAll: false,
    clientLocation: liveGpsOverride,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.results[0].locationSource, 'LIVE_GPS');
  assert.strictEqual(result.results[0].locationName, 'Hyderabad Central');
  assert.strictEqual(result.results[0].coordinates.latitude, 17.3850);
});

test('4. Registration Sync: Newly registered user is automatically added to subscriber pool', async () => {
  const testUserEmail = `newuser_${Date.now()}@example.com`;
  
  saveUserProfile({
    id: `usr_${Date.now()}`,
    email: testUserEmail,
    name: 'New Safety Subscriber',
    location: {
      name: 'Bengaluru',
      latitude: 12.9716,
      longitude: 77.5946,
      gps_accuracy: 10,
    },
    authenticated: true,
  });

  const recipients = getRecipientProfiles();
  const found = recipients.find(r => r.email.toLowerCase() === testUserEmail.toLowerCase());

  assert.ok(found, 'New user should be automatically found in recipient subscriber directory');
  assert.strictEqual(found?.location_name, 'Bengaluru');
  assert.strictEqual(found?.location_source, 'LIVE_GPS');
});

test('5. Precautions Generation: Generates complete 5-7 step dynamic safety guidance', async () => {
  const mockWeather = {
    temperature: 38.5,
    relative_humidity: 68,
    apparent_temperature: 44.0,
    wind_speed: 12,
    pressure: 1010,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    location: { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
  };

  const guidance = generatePersonalizedGuidance(
    'HIGH',
    { activity: 'high', duration: 'long', cooling: 'limited', age_group: 'adult' },
    mockWeather
  );

  assert.ok(guidance.length >= 5, 'Must generate at least 5 customized precautions');
  assert.ok(guidance.some(g => g.category === 'hydration'), 'Must contain hydration guidance');
  assert.ok(guidance.some(g => g.category === 'cooling'), 'Must contain cooling guidance');
});

test('6. Notification Audit Logs: Persistent logs recorded with idempotency keys', async () => {
  await broadcastLiveAlertsToAllRecipients({
    targetEmail: 'audit.test.user@example.com',
    sendToAll: false,
  });

  const logs = getNotificationLogs();
  assert.ok(Array.isArray(logs));
  assert.ok(logs.length > 0, 'Notification logs should record past dispatches');

  const latestLog = logs[0];
  assert.ok(latestLog.id.startsWith('log_'), 'Log ID format validation');
  assert.ok(latestLog.idempotency_key, 'Must have idempotency key');
  assert.ok(latestLog.sent_at, 'Must have dispatch timestamp');
});

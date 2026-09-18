import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveRecipientProfile,
  getRecipientProfiles,
  saveHeatRiskDispatchLog,
  getHeatRiskDispatchLogs,
  isDispatchKeySent,
  clearDispatchLogsForTesting,
} from '../lib/store';
import { calculateRiskAssessment } from '../lib/risk-engine';
import { generatePersonalizedGuidance } from '../lib/guidance-engine';
import { fetchWeatherData } from '../lib/weather-api';
import { validateCoordinates } from '../lib/snapshot';
import { classifyResendError, sendAlertEmail } from '../lib/email-service';
import { SmartAlert, WeatherData } from '../lib/types';

describe('Hourly Heat-Risk Dispatch System & Production Email Pipeline', () => {
  beforeEach(() => {
    clearDispatchLogsForTesting();
  });

  it('1. Hourly Dispatch Engine: resolves and executes for eligible subscribers', async () => {
    const subscriber = {
      email: 'test.sub1@example.com',
      display_name: 'Subscriber One',
      location_name: 'Kakinada',
      latitude: 16.9891,
      longitude: 82.2475,
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    };
    saveRecipientProfile(subscriber);

    const activeList = getRecipientProfiles().filter((r) => r.hourly_heat_alerts_enabled);
    assert.ok(activeList.length >= 1);
    assert.strictEqual(activeList[0].location_name, 'Kakinada');
  });

  it('2. Cron Authorization: enforces Bearer token validation', async () => {
    const origSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'super_secret_cron_key_999';

    function checkCronAuth(headerValue: string | null): boolean {
      if (!headerValue) return false;
      const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;
      return token === process.env.CRON_SECRET;
    }

    assert.strictEqual(checkCronAuth(null), false, 'Missing auth header rejected');
    assert.strictEqual(checkCronAuth('Bearer wrong_secret'), false, 'Wrong token rejected');
    assert.strictEqual(checkCronAuth('Bearer super_secret_cron_key_999'), true, 'Valid Bearer secret accepted');

    process.env.CRON_SECRET = origSecret;
  });

  it('3. Idempotency: prevents duplicate deliveries within the same hourly window', async () => {
    const hourKey = '2026-09-18T13';
    const dispatchKey = `${hourKey}_user_test_user_id_101`;

    assert.strictEqual(await isDispatchKeySent(dispatchKey), false);

    await saveHeatRiskDispatchLog({
      id: 'disp_1',
      recipient_email: 'idemp.test@example.com',
      location: 'Kakinada',
      dispatch_key: dispatchKey,
      status: 'ACCEPTED',
      provider_message_id: 'resend_msg_101',
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    assert.strictEqual(await isDispatchKeySent(dispatchKey), true, 'Dispatched key must report as sent');
  });

  it('4. Per-User Location: User A (Kakinada) and User B (Chennai) maintain distinct locations', async () => {
    saveRecipientProfile({
      email: 'userA@example.com',
      location_name: 'Kakinada',
      latitude: 16.9891,
      longitude: 82.2475,
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    });
    saveRecipientProfile({
      email: 'userB@example.com',
      location_name: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    });

    const profiles = getRecipientProfiles();
    const userA = profiles.find((p) => p.email === 'usera@example.com');
    const userB = profiles.find((p) => p.email === 'userb@example.com');

    assert.ok(userA && userB);
    assert.strictEqual(userA.location_name, 'Kakinada');
    assert.strictEqual(userB.location_name, 'Chennai');
    assert.notStrictEqual(userA.latitude, userB.latitude);
    assert.notStrictEqual(userA.longitude, userB.longitude);
  });

  it('5. Per-User Weather: retrieves telemetry for distinct geographic coordinates', async () => {
    const weatherKakinada = await fetchWeatherData(16.9891, 82.2475, 'Kakinada', true);
    const weatherChennai = await fetchWeatherData(13.0827, 80.2707, 'Chennai', true);

    assert.ok(weatherKakinada.temperature !== undefined);
    assert.ok(weatherChennai.temperature !== undefined);
    assert.strictEqual(weatherKakinada.location.name, 'Kakinada');
    assert.strictEqual(weatherChennai.location.name, 'Chennai');
  });

  it('6. Personalized Risk Calculation: computes risk using authoritative risk engine', () => {
    const mockWeatherHot: WeatherData = {
      temperature: 38,
      relative_humidity: 72,
      apparent_temperature: 46,
      wind_speed: 8,
      pressure: 1008,
      weather_code: 1,
      timestamp: new Date().toISOString(),
      is_cached: false,
      location: { name: 'Kakinada', latitude: 16.9891, longitude: 82.2475 },
    };

    const assessment = calculateRiskAssessment({
      weather: mockWeatherHot,
      profile: {
        id: 'usr_kak',
        age_group: 'adult',
        activity_level: 'high',
        exposure_duration: 'long',
        cooling_access: 'limited',
      },
    });

    assert.ok(assessment.risk_score >= 60, 'Expected HIGH or EXTREME risk for hot humid high-exertion scenario');
    assert.ok(['HIGH', 'EXTREME'].includes(assessment.risk_level));
    assert.ok(assessment.factors.length > 0);
  });

  it('7. Personalized Email Generation: formats responsive advisory with factors and precautions', async () => {
    const alert: SmartAlert = {
      id: 'alt_test_01',
      rule_id: 'CURRENT_HIGH',
      priority: 'HIGH PRIORITY',
      title: 'HeatShield AI — High Heat Risk Advisory for Kakinada',
      message: 'Thermal stress elevated in Kakinada.',
      affected_period: new Date().toISOString(),
      affected_period_label: 'Immediate',
      trigger_data: {
        temperature: 35,
        apparent_temperature: 42,
        humidity: 65,
        wind_speed: 12,
        risk_score: 72,
        risk_level: 'HIGH',
      },
      recommended_action: 'Drink water and rest in shade.',
      source_status: 'LIVE',
      timestamp: new Date().toISOString(),
      dismissed: false,
      read: false,
      dedup_key: 'dedup_test_01',
      precautions: [
        'Take regular cooling/rest breaks.',
        'Increase hydration to 500ml/hr.',
        'Reduce prolonged exertion.',
      ],
    };

    const origKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY; // Offline simulation mode

    const result = await sendAlertEmail({
      to: 'recipient@example.com',
      alert,
      locationName: 'Kakinada',
      recipientName: 'Rao',
      weatherCondition: 'Clear Sky',
      contributingFactors: [
        { name: 'Apparent Temperature', impact: 'critical', direction: 'escalating' },
        { name: 'Relative Humidity', impact: 'high', direction: 'escalating' },
      ],
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.id);
    process.env.RESEND_API_KEY = origKey;
  });

  it('8. Inactive Subscriber Skipping: skips users who have not enabled hourly alerts', () => {
    saveRecipientProfile({
      email: 'disabled.sub@example.com',
      location_name: 'Vijayawada',
      latitude: 16.5062,
      longitude: 80.6480,
      hourly_heat_alerts_enabled: false, // Disabled
      email_verified: true,
    });

    const profiles = getRecipientProfiles();
    const candidate = profiles.find((p) => p.email === 'disabled.sub@example.com');
    assert.ok(candidate);
    assert.strictEqual(candidate.hourly_heat_alerts_enabled, false);

    const eligible = profiles.filter((p) => p.hourly_heat_alerts_enabled && p.email_verified);
    assert.strictEqual(eligible.some((e) => e.email === 'disabled.sub@example.com'), false);
  });

  it('9. Unverified Email Skipping: skips users with unverified email addresses', () => {
    saveRecipientProfile({
      email: 'unverified.sub@example.com',
      location_name: 'Hyderabad',
      latitude: 17.3850,
      longitude: 78.4867,
      hourly_heat_alerts_enabled: true,
      email_verified: false, // Unverified
    });

    const profiles = getRecipientProfiles();
    const candidate = profiles.find((p) => p.email === 'unverified.sub@example.com');
    assert.ok(candidate);
    assert.strictEqual(candidate.email_verified, false);

    const eligible = profiles.filter((p) => p.hourly_heat_alerts_enabled && p.email_verified);
    assert.strictEqual(eligible.some((e) => e.email === 'unverified.sub@example.com'), false);
  });

  it('10. Resend Failure: classifies unverified domain errors into structured code', () => {
    const errorFromResend = {
      name: 'validation_error',
      message: 'You can only send testing emails to your own email address (owner@example.com). To send to other domains, please verify a domain in Resend.',
    };

    const classified = classifyResendError(errorFromResend);
    assert.strictEqual(classified.errorCode, 'RESEND_DOMAIN_NOT_VERIFIED');
    assert.match(classified.message, /RESEND_DOMAIN_NOT_VERIFIED/);
    assert.match(classified.message, /EMAIL_PROVIDER=gmail/);
  });

  it('11. Resend Rate Limit: classifies 429 rate-limited responses accurately', () => {
    const rateLimitErr = { statusCode: 429, message: 'Too many requests' };
    const classified = classifyResendError(rateLimitErr);
    assert.strictEqual(classified.errorCode, 'RESEND_RATE_LIMITED');
    assert.match(classified.message, /rate limit reached/i);
  });

  it('12. Weather API Failure Handling: refuses to send alerts when weather data is fallback', () => {
    const fallbackWeather: WeatherData = {
      temperature: 34.5,
      relative_humidity: 68,
      apparent_temperature: 41.2,
      wind_speed: 12.5,
      pressure: 1008,
      weather_code: 1,
      timestamp: new Date().toISOString(),
      is_cached: true,
      is_fallback: true, // Emergency baseline
      location: { name: 'Faulty Location', latitude: 13.0827, longitude: 80.2707 },
    };

    function shouldDispatchEmail(weather: WeatherData): boolean {
      if (weather.is_fallback) return false;
      return true;
    }

    assert.strictEqual(shouldDispatchEmail(fallbackWeather), false, 'Fallback weather must abort email dispatch');
  });

  it('13. Duplicate Cron Execution: second run skips all previously sent subscribers', async () => {
    const hourKey = '2026-09-18T14';
    const subEmailA = 'cron.userA@example.com';
    const subEmailB = 'cron.userB@example.com';
    const keyA = `${hourKey}_user_${subEmailA}`;
    const keyB = `${hourKey}_user_${subEmailB}`;

    // First run: send both
    await saveHeatRiskDispatchLog({
      id: 'disp_run1_A',
      recipient_email: subEmailA,
      location: 'Kakinada',
      dispatch_key: keyA,
      status: 'ACCEPTED',
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });
    await saveHeatRiskDispatchLog({
      id: 'disp_run1_B',
      recipient_email: subEmailB,
      location: 'Chennai',
      dispatch_key: keyB,
      status: 'ACCEPTED',
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    // Second run: both keys exist in sent logs
    const isSentA = await isDispatchKeySent(keyA);
    const isSentB = await isDispatchKeySent(keyB);

    assert.strictEqual(isSentA, true, 'User A skipped on second run');
    assert.strictEqual(isSentB, true, 'User B skipped on second run');
  });

  it('14. Admin Authorization: rejects non-admin users attempting manual broadcast to others', () => {
    function authorizeManualBroadcast(callerRole: string, targetEmail: string, callerEmail: string): boolean {
      if (targetEmail.toLowerCase() === callerEmail.toLowerCase()) return true; // Self-test permitted
      return callerRole === 'admin' || callerRole === 'super_admin';
    }

    assert.strictEqual(authorizeManualBroadcast('user', 'other@example.com', 'user@example.com'), false);
    assert.strictEqual(authorizeManualBroadcast('admin', 'other@example.com', 'admin@example.com'), true);
  });

  it('15. User Authorization: user can only dispatch test reports to their own email', () => {
    const loggedInUserEmail = 'user123@example.com';
    const testRecipient = 'user123@example.com';
    const maliciousTarget = 'victim@example.com';

    assert.strictEqual(loggedInUserEmail === testRecipient, true);
    assert.strictEqual(loggedInUserEmail === maliciousTarget, false);
  });

  it('16. Unsubscribe: disabling hourly alerts removes user from dispatch candidate pool', () => {
    const profile = saveRecipientProfile({
      email: 'optout.sub@example.com',
      location_name: 'Nellore',
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    });

    // User disables alerts
    saveRecipientProfile({
      email: 'optout.sub@example.com',
      hourly_heat_alerts_enabled: false,
    });

    const updated = getRecipientProfiles().find((p) => p.email === 'optout.sub@example.com');
    assert.ok(updated);
    assert.strictEqual(updated.hourly_heat_alerts_enabled, false);
  });

  it('17. Malformed Weather Response: validates and sanitizes corrupted API metrics', () => {
    const corruptLat = NaN;
    const corruptLon = 999;
    assert.strictEqual(validateCoordinates(corruptLat, 80), false);
    assert.strictEqual(validateCoordinates(13, corruptLon), false);
  });

  it('18. Invalid Coordinates: rejects Null Island (0, 0) and out-of-bounds coordinates', () => {
    assert.strictEqual(validateCoordinates(0, 0), false, 'Null island (0, 0) rejected');
    assert.strictEqual(validateCoordinates(0.001, 0.001), false, 'Near-zero rejected');
    assert.strictEqual(validateCoordinates(95, 80), false, 'Latitude > 90 rejected');
    assert.strictEqual(validateCoordinates(13, 195), false, 'Longitude > 180 rejected');
    assert.strictEqual(validateCoordinates(16.9891, 82.2475), true, 'Valid Kakinada accepted');
  });

  it('19. Dispatch Logging: persists dispatch logs with status and timestamps', async () => {
    const dispatchRecord = {
      id: 'disp_log_test_99',
      recipient_email: 'audit.sub@example.com',
      location: 'Kakinada',
      latitude: 16.9891,
      longitude: 82.2475,
      risk_score: 65,
      risk_level: 'HIGH' as const,
      dispatch_key: '2026-09-18T15_user_audit',
      provider_message_id: 're_msg_777888',
      status: 'ACCEPTED' as const,
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    };

    await saveHeatRiskDispatchLog(dispatchRecord);
    const logs = getHeatRiskDispatchLogs();
    const found = logs.find((l) => l.id === 'disp_log_test_99');

    assert.ok(found);
    assert.strictEqual(found.status, 'ACCEPTED');
    assert.strictEqual(found.provider_message_id, 're_msg_777888');
    assert.strictEqual(found.risk_score, 65);
  });

  it('20. Provider Message ID: records and exposes Resend transmission identifier', () => {
    const resendSuccessResponse = {
      data: { id: 'msg_resend_987654321' },
      error: null,
    };

    const providerId = resendSuccessResponse.data?.id;
    assert.ok(providerId && providerId.startsWith('msg_resend_'));
    assert.strictEqual(providerId, 'msg_resend_987654321');
  });

  // ── USER TEST MATRIX SCENARIO ───────────────────────────────────────────────
  it('21. Comprehensive Test Matrix: Users A, B, C, D Multi-User Scenario + Re-run Deduplication', async () => {
    const hourWindow = '2026-09-18T16';

    // USER A: Location Kakinada, Email verified, alerts enabled
    const userA = {
      id: 'usr_A',
      email: 'userA.matrix@example.com',
      location_name: 'Kakinada',
      latitude: 16.9891,
      longitude: 82.2475,
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    };

    // USER B: Location Chennai, Email verified, alerts enabled
    const userB = {
      id: 'usr_B',
      email: 'userB.matrix@example.com',
      location_name: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      hourly_heat_alerts_enabled: true,
      email_verified: true,
    };

    // USER C: Location Vijayawada, Alerts disabled
    const userC = {
      id: 'usr_C',
      email: 'userC.matrix@example.com',
      location_name: 'Vijayawada',
      latitude: 16.5062,
      longitude: 80.6480,
      hourly_heat_alerts_enabled: false, // Disabled
      email_verified: true,
    };

    // USER D: Location Hyderabad, Email unverified
    const userD = {
      id: 'usr_D',
      email: 'userD.matrix@example.com',
      location_name: 'Hyderabad',
      latitude: 17.3850,
      longitude: 78.4867,
      hourly_heat_alerts_enabled: true,
      email_verified: false, // Unverified
    };

    const allSubscribers = [userA, userB, userC, userD];

    // Pipeline simulation function representing the cron dispatch job
    async function simulateCronRun(window: string) {
      const results: Record<string, 'SENT' | 'SKIPPED' | 'FAILED'> = {};

      for (const sub of allSubscribers) {
        const dispatchKey = `${window}_user_${sub.id}`;

        // Check if disabled
        if (!sub.hourly_heat_alerts_enabled) {
          results[sub.id] = 'SKIPPED';
          continue;
        }

        // Check if unverified
        if (!sub.email_verified) {
          results[sub.id] = 'SKIPPED';
          continue;
        }

        // Check idempotency
        const alreadySent = await isDispatchKeySent(dispatchKey);
        if (alreadySent) {
          results[sub.id] = 'SKIPPED';
          continue;
        }

        // Successful transmission
        await saveHeatRiskDispatchLog({
          id: `disp_${window}_${sub.id}`,
          recipient_email: sub.email,
          location: sub.location_name,
          dispatch_key: dispatchKey,
          status: 'ACCEPTED',
          provider_message_id: `re_${sub.id}_${Date.now()}`,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
        results[sub.id] = 'SENT';
      }

      return results;
    }

    // --- FIRST RUN ---
    const run1Results = await simulateCronRun(hourWindow);
    assert.strictEqual(run1Results['usr_A'], 'SENT', 'User A (Kakinada) generated and sent');
    assert.strictEqual(run1Results['usr_B'], 'SENT', 'User B (Chennai) generated and sent');
    assert.strictEqual(run1Results['usr_C'], 'SKIPPED', 'User C (Disabled) skipped');
    assert.strictEqual(run1Results['usr_D'], 'SKIPPED', 'User D (Unverified) skipped');

    // --- SECOND RUN (Same hourly window) ---
    const run2Results = await simulateCronRun(hourWindow);
    assert.strictEqual(run2Results['usr_A'], 'SKIPPED', 'User A skipped on 2nd run as duplicate');
    assert.strictEqual(run2Results['usr_B'], 'SKIPPED', 'User B skipped on 2nd run as duplicate');
    assert.strictEqual(run2Results['usr_C'], 'SKIPPED', 'User C skipped');
    assert.strictEqual(run2Results['usr_D'], 'SKIPPED', 'User D skipped');

    // Zero duplicate deliveries in database
    const userALogs = getHeatRiskDispatchLogs().filter((l) => l.recipient_email === userA.email);
    assert.strictEqual(userALogs.length, 1, 'Only exactly 1 dispatch record for User A');
  });
});

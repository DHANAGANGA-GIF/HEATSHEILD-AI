import assert from 'node:assert';
import { test } from 'node:test';
import { generateAssistantResponse } from '../lib/ai-assistant';
import { evaluateHeatRisk, calculateHeatIndex } from '../lib/risk-engine';
import { compareScenarios, MANDATORY_SIMULATOR_LABEL } from '../lib/simulator-engine';
import { sanitizeHtml, validateCoordinates, validateReportInput, checkDuplicateSubmission, clearSubmissionTracker } from '../lib/community-moderation';
import { canUserModifyReport, deleteCommunityReport, getCommunityReports, filterCommunityReports, VERIFIED_COOLING_LOCATIONS } from '../lib/store';
import { createOrganization, addOrganizationMember, isUserInOrganization, isAdminAuthorized, hasPermission, logAuditEvent, getAuditLogs } from '../lib/organization-service';
import { CommunityReport, WeatherData } from '../lib/types';

test('Security 1. Authentication & Role Boundaries', () => {
  assert.strictEqual(isAdminAuthorized('admin'), true);
  assert.strictEqual(isAdminAuthorized('organization_admin'), true);
  assert.strictEqual(isAdminAuthorized('user'), false);
  assert.strictEqual(isAdminAuthorized('member'), false);
  assert.strictEqual(isAdminAuthorized(''), false);
  assert.strictEqual(isAdminAuthorized(undefined), false);
});

test('Security 2. User Data Isolation Safeguards', async () => {
  const aliceReport: CommunityReport = {
    id: 'rep_sec_alice',
    user_id: 'usr_alice_sec',
    category: 'water_access',
    description: 'Alice private report',
    location: { name: 'Alice Yard', latitude: 13.08, longitude: 80.27 },
    timestamp: new Date().toISOString(),
    status: 'SUBMITTED',
    votes_count: 1,
  };

  // Alice can modify her own report
  assert.strictEqual(canUserModifyReport('usr_alice_sec', aliceReport), true);

  // Bob CANNOT modify or delete Alice's report
  assert.strictEqual(canUserModifyReport('usr_bob_sec', aliceReport), false);

  const bobDeleteAttempt = await deleteCommunityReport('usr_bob_sec', aliceReport.id, aliceReport);
  assert.strictEqual(bobDeleteAttempt.success, false);
  assert.ok(bobDeleteAttempt.error?.includes('Unauthorized'));
});

test('Security 3. Organization Isolation Safeguards', () => {
  const orgX = createOrganization('Org X Security', 'school', { name: 'X Loc', latitude: 13.08, longitude: 80.27 });
  const orgY = createOrganization('Org Y Security', 'worksite', { name: 'Y Loc', latitude: 13.09, longitude: 80.28 });

  addOrganizationMember(orgX.id, 'usr_x_member', 'User X', 'school');

  assert.strictEqual(isUserInOrganization('usr_x_member', orgX.id), true);
  assert.strictEqual(isUserInOrganization('usr_x_member', orgY.id), false);
});

test('Security 4. Admin Access & RBAC Route Authorization', () => {
  assert.strictEqual(hasPermission('admin', 'manage_users'), true);
  assert.strictEqual(hasPermission('organization_admin', 'edit_org'), true);
  assert.strictEqual(hasPermission('member', 'manage_users'), false);
  assert.strictEqual(hasPermission('user', 'edit_org'), false);
});

test('Security 5. Community Input Sanitization & Script Stripping', () => {
  const malPayload = '<script>document.cookie="stolen";</script>Broken water tap';
  const clean = sanitizeHtml(malPayload);
  assert.strictEqual(clean.includes('<script>'), false);
  assert.strictEqual(clean.includes('Broken water tap'), true);

  const invalidCoords = validateCoordinates(999.0, -500.0);
  assert.strictEqual(invalidCoords, false);
});

test('Security 6. API Failure & Degradation Handling', () => {
  const nullWeatherResponse = generateAssistantResponse('Why is my risk high?', null, null, 'technical');
  assert.strictEqual(nullWeatherResponse.data_status, 'UNAVAILABLE');
  assert.ok(nullWeatherResponse.text.includes('UNAVAILABLE'));
});

test('Security 7. ML Input Bounds & NaN Safety', () => {
  const nanWeather: WeatherData = {
    temperature: NaN,
    relative_humidity: NaN,
    apparent_temperature: 30.0,
    wind_speed: 5.0,
    pressure: 1013,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    location: { name: 'Test', latitude: 13.08, longitude: 80.27 },
  };

  const risk = evaluateHeatRisk(nanWeather, {
    activity: 'moderate',
    duration: 'moderate',
    cooling: 'good',
    age_group: 'adult',
  });

  assert.ok(!isNaN(risk.risk_score));
  assert.ok(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(risk.risk_level));
});

test('Security 8. AI Safety Assistant: Medical & Emergency Guardrails', () => {
  // Emergency symptom redirection - "passed out" is an emergency keyword
  const emgRes = generateAssistantResponse('I passed out from severe heat dizziness', null, null, 'simple');
  assert.strictEqual(emgRes.is_emergency_warning, true);
  assert.ok(emgRes.text.includes('EMERGENCY') || emgRes.text.includes('emergency'));

  // Medical medication query without emergency keywords → hits medical guardrail
  const medRes = generateAssistantResponse('What dosage of medicine should I take?', null, null, 'simple');
  assert.strictEqual(medRes.is_emergency_warning, true);
  assert.ok(
    medRes.text.includes('DISCLAIMER') ||
    medRes.text.includes('DOES NOT perform medical diagnoses') ||
    medRes.text.includes('EMERGENCY REFERRAL')
  );
});

test('Security 9. Simulator Safety & Mandatory Labeling', () => {
  const comparison = compareScenarios(
    { weather: null, risk: null },
    { activity: 'high', duration: 'long', cooling: 'limited', age_group: 'adult' }
  );

  assert.strictEqual(comparison.label, MANDATORY_SIMULATOR_LABEL);
  assert.strictEqual(comparison.dataStatus, 'UNAVAILABLE');
});

test('Security 10. Alert Deduplication & Cooldown Safety', () => {
  clearSubmissionTracker();
  const existingReports: CommunityReport[] = [
    {
      id: 'rep_dedup_1',
      user_id: 'usr_sec_dedup',
      category: 'water_access',
      description: 'Broken fountain',
      location: { name: 'Loc', latitude: 13.08, longitude: 80.27 },
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
  ];

  const dupCheck = checkDuplicateSubmission('usr_sec_dedup', 'Broken fountain', existingReports, 30);
  assert.strictEqual(dupCheck.isDuplicate, true);
});

test('Security 11. Privacy & Audit Log Credential Integrity', () => {
  const auditLog = logAuditEvent('TEST_SECURITY_AUDIT', { status: 'OK' }, 'usr_tester');
  assert.ok(auditLog.id);
  assert.strictEqual(JSON.stringify(auditLog.details).includes('password'), false);
  assert.strictEqual(JSON.stringify(auditLog.details).includes('secret'), false);

  const logs = getAuditLogs();
  assert.ok(logs.length > 0);
});

test('Security 12. Offline & Degraded Mode Resilience', () => {
  const filtered = filterCommunityReports([], { category: 'water_access' });
  assert.strictEqual(filtered.length, 0);

  const verifiedCooling = VERIFIED_COOLING_LOCATIONS;
  assert.ok(verifiedCooling.length > 0);
  assert.strictEqual(verifiedCooling[0].data_type, 'VERIFIED_LOCATION');
});

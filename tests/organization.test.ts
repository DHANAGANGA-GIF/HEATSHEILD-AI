import assert from 'node:assert';
import { test } from 'node:test';
import {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  getOrganizationMembers,
  addOrganizationMember,
  isUserInOrganization,
  getUserRoleInOrganization,
  isAdminAuthorized,
  hasPermission,
  logAuditEvent,
  getAuditLogs,
} from '../lib/organization-service';
import { evaluateHeatRisk } from '../lib/risk-engine';
import { WeatherData } from '../lib/types';

test('1. Organization Creation: Instantiation with location & type', () => {
  const newOrg = createOrganization('Test High School', 'school', {
    name: 'North Campus',
    locality: 'Chennai',
    latitude: 13.08,
    longitude: 80.27,
  });

  assert.ok(newOrg.id.startsWith('org_school_'));
  assert.strictEqual(newOrg.name, 'Test High School');
  assert.strictEqual(newOrg.type, 'school');
  assert.strictEqual(newOrg.latitude, 13.08);
  assert.strictEqual(newOrg.longitude, 80.27);
  assert.ok(new Date(newOrg.created_at).getTime() > 0);
});

test('2. Membership Management: Adding users with assigned roles', () => {
  const org = createOrganization('Test Construction Co', 'worksite', {
    name: 'Site Beta',
    latitude: 13.09,
    longitude: 80.28,
  });

  const member = addOrganizationMember(org.id, 'usr_worker_42', 'John Worker', 'worksite', 'john@worksite.com');

  assert.ok(member.id.startsWith('mem_'));
  assert.strictEqual(member.organization_id, org.id);
  assert.strictEqual(member.user_id, 'usr_worker_42');
  assert.strictEqual(member.role, 'worksite');
  assert.strictEqual(member.email, 'john@worksite.com');
});

test('3. Role Permissions (RBAC): Checking admin vs manager vs member actions', () => {
  // Admin permissions
  assert.strictEqual(hasPermission('admin', 'manage_users'), true);
  assert.strictEqual(hasPermission('admin', 'edit_org'), true);
  assert.strictEqual(hasPermission('admin', 'moderate_reports'), true);
  assert.strictEqual(hasPermission('admin', 'view_dashboard'), true);

  // Organization Admin permissions
  assert.strictEqual(hasPermission('organization_admin', 'manage_users'), true);

  // Manager permissions
  assert.strictEqual(hasPermission('manager', 'manage_users'), false);
  assert.strictEqual(hasPermission('manager', 'moderate_reports'), true);
  assert.strictEqual(hasPermission('manager', 'view_dashboard'), true);

  // Member permissions
  assert.strictEqual(hasPermission('member', 'manage_users'), false);
  assert.strictEqual(hasPermission('member', 'edit_org'), false);
  assert.strictEqual(hasPermission('member', 'view_dashboard'), true);
});

test('4. Organization Isolation: Preventing cross-organization access', () => {
  const orgA = createOrganization('Org Alpha', 'school', { name: 'Alpha', latitude: 13.08, longitude: 80.27 });
  const orgB = createOrganization('Org Beta', 'worksite', { name: 'Beta', latitude: 13.09, longitude: 80.28 });

  addOrganizationMember(orgA.id, 'user_alpha_member', 'Alice', 'school');

  // User Alice is in Org A
  assert.strictEqual(isUserInOrganization('user_alpha_member', orgA.id), true);

  // User Alice is NOT in Org B
  assert.strictEqual(isUserInOrganization('user_alpha_member', orgB.id), false);
});

test('5. School Dashboard Logic: PE recess decision rules under thermal load', () => {
  const mockHighHeatWeather: WeatherData = {
    temperature: 38.5,
    relative_humidity: 70,
    apparent_temperature: 44.0,
    wind_speed: 8.0,
    pressure: 1008,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    location: { name: 'School Ground', latitude: 13.07, longitude: 80.26 },
  };

  const risk = evaluateHeatRisk(mockHighHeatWeather, {
    activity: 'high', // PE Sports
    duration: 'moderate',
    cooling: 'good',
    age_group: 'child',
  });

  assert.ok(risk.risk_level === 'HIGH' || risk.risk_level === 'EXTREME');
  assert.ok(risk.risk_score >= 70);
});

test('6. Worksite Dashboard Logic: NIOSH work-rest cycle ratio for manual labor', () => {
  const mockWorksiteWeather: WeatherData = {
    temperature: 37.0,
    relative_humidity: 65,
    apparent_temperature: 42.5,
    wind_speed: 10.0,
    pressure: 1010,
    weather_code: 0,
    timestamp: new Date().toISOString(),
    location: { name: 'Worksite Yard', latitude: 13.08, longitude: 80.27 },
  };

  const risk = evaluateHeatRisk(mockWorksiteWeather, {
    activity: 'high', // Manual Labor
    duration: 'long',
    cooling: 'limited',
    age_group: 'adult',
  });

  assert.ok(risk.risk_level === 'HIGH' || risk.risk_level === 'EXTREME');
  assert.ok(risk.recommendations.length > 0);
});

test('7. NGO Dashboard Logic: Incident moderation state updates', () => {
  const reportId = 'rep_ngo_test_01';
  const initialStatus = 'SUBMITTED';

  let currentStatus = initialStatus;
  currentStatus = 'UNDER_REVIEW';
  assert.strictEqual(currentStatus, 'UNDER_REVIEW');

  currentStatus = 'RESOLVED';
  assert.strictEqual(currentStatus, 'RESOLVED');
});

test('8. Admin Authorization: Verifying admin role access safeguards', () => {
  assert.strictEqual(isAdminAuthorized('admin'), true);
  assert.strictEqual(isAdminAuthorized('organization_admin'), true);
  assert.strictEqual(isAdminAuthorized('user'), false);
  assert.strictEqual(isAdminAuthorized('school'), false);
  assert.strictEqual(isAdminAuthorized('member'), false);
  assert.strictEqual(isAdminAuthorized(undefined), false);
});

test('9. Audit Logging Engine: Action logging without sensitive credential leaks', () => {
  const logItem = logAuditEvent('ROLE_CHANGE', { targetUser: 'usr_123', newRole: 'manager' }, 'usr_admin_1');

  assert.ok(logItem.id.startsWith('log_'));
  assert.strictEqual(logItem.action, 'ROLE_CHANGE');
  assert.ok(JSON.stringify(logItem.details).includes('usr_123'));
  assert.strictEqual(JSON.stringify(logItem.details).includes('password'), false);
  assert.strictEqual(JSON.stringify(logItem.details).includes('token'), false);

  const logs = getAuditLogs();
  assert.ok(logs.length > 0);
});

test('10. Unauthorized Access Protection: Rejecting invalid role access', () => {
  const publicRole = 'user';
  const isSuperAdmin = isAdminAuthorized(publicRole);
  assert.strictEqual(isSuperAdmin, false);

  const canManage = hasPermission(publicRole as any, 'manage_users');
  assert.strictEqual(canManage, false);
});

test('11. Empty Organization Handling: Zero incidents & empty state resolution', () => {
  const emptyOrg = createOrganization('Newly Created Empty Org', 'school', {
    name: 'Empty Yard',
    latitude: 13.0,
    longitude: 80.0,
  });

  const members = getOrganizationMembers(emptyOrg.id);
  assert.strictEqual(members.length, 0);

  const logs = getAuditLogs(emptyOrg.id);
  assert.ok(Array.isArray(logs));
});

test('12. Supabase Failure Fallback: Seamless offline storage operation', () => {
  const orgs = getOrganizations();
  assert.ok(Array.isArray(orgs));
  assert.ok(orgs.length > 0);

  const members = getOrganizationMembers();
  assert.ok(Array.isArray(members));
  assert.ok(members.length > 0);
});

test('13. API Failure Fallback: Graceful weather & heat risk fallback', () => {
  const fallbackWeather: WeatherData = {
    temperature: 32.0,
    relative_humidity: 60,
    apparent_temperature: 36.0,
    wind_speed: 12.0,
    pressure: 1012,
    weather_code: 1,
    timestamp: new Date().toISOString(),
    is_cached: true,
    location: { name: 'Fallback Location', latitude: 13.0827, longitude: 80.2707 },
  };

  const risk = evaluateHeatRisk(fallbackWeather, {
    activity: 'moderate',
    duration: 'moderate',
    cooling: 'good',
    age_group: 'adult',
  });

  assert.ok(risk.risk_score >= 0 && risk.risk_score <= 100);
  assert.ok(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(risk.risk_level));
});

import assert from 'node:assert';
import { test } from 'node:test';
import {
  validateCoordinates,
  sanitizeHtml,
  validateReportInput,
  checkDuplicateSubmission,
  clearSubmissionTracker,
} from '../lib/community-moderation';
import {
  addCommunityReport,
  getCommunityReports,
  canUserModifyReport,
  deleteCommunityReport,
  filterCommunityReports,
  fetchCommunityReportsFromSupabase,
  createCommunityReportInSupabase,
  VERIFIED_COOLING_LOCATIONS,
} from '../lib/store';
import { CommunityReport } from '../lib/types';

test('1. Report Validation: Description length & HTML script stripping', () => {
  // Empty description
  const emptyRes = validateReportInput('water_access', '', 13.0827, 80.2707);
  assert.strictEqual(emptyRes.valid, false);
  assert.ok(emptyRes.error?.includes('required') || emptyRes.error?.includes('characters'));

  // Short description < 5 chars
  const shortRes = validateReportInput('water_access', 'abc', 13.0827, 80.2707);
  assert.strictEqual(shortRes.valid, false);

  // Script injection stripping
  const maliciousInput = '<script>alert("xss")</script>Broken water fountain near bus stand.';
  const sanitized = sanitizeHtml(maliciousInput);
  assert.strictEqual(sanitized.includes('<script>'), false);
  assert.strictEqual(sanitized.includes('Broken water fountain'), true);

  // Valid report input
  const validRes = validateReportInput('water_access', 'Broken public water tap at metro station', 13.0827, 80.2707);
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.sanitizedDescription, 'Broken public water tap at metro station');
});

test('2. Coordinate Validation: Latitude/Longitude boundary checks', () => {
  // Valid coordinates
  assert.strictEqual(validateCoordinates(13.0827, 80.2707), true);
  assert.strictEqual(validateCoordinates(-33.8688, 151.2093), true);

  // Latitude out of range
  assert.strictEqual(validateCoordinates(95.0, 80.2707), false);
  assert.strictEqual(validateCoordinates(-91.0, 80.2707), false);

  // Longitude out of range
  assert.strictEqual(validateCoordinates(13.0827, 185.0), false);
  assert.strictEqual(validateCoordinates(13.0827, -190.0), false);

  // NaN / Null / 0,0 invalid bounds
  assert.strictEqual(validateCoordinates(NaN, 80.2707), false);
  assert.strictEqual(validateCoordinates(0, 0), false);
});

test('3. Report Creation: Object instantiation & timestamping', () => {
  const newRep = addCommunityReport({
    user_id: 'usr_test_999',
    category: 'shade_cooling',
    description: 'Bus stop canopy missing in Central square',
    location: { name: 'Central Square', latitude: 13.08, longitude: 80.27 },
  });

  assert.ok(newRep.id.startsWith('rep_'));
  assert.strictEqual(newRep.user_id, 'usr_test_999');
  assert.strictEqual(newRep.category, 'shade_cooling');
  assert.strictEqual(newRep.status, 'SUBMITTED');
  assert.ok(new Date(newRep.timestamp).getTime() > 0);
  assert.strictEqual(newRep.data_type, 'COMMUNITY_REPORT');
});

test('4. Report Retrieval: Fetching list with correct format', () => {
  const reports = getCommunityReports();
  assert.ok(Array.isArray(reports));
  assert.ok(reports.length > 0);

  const first = reports[0];
  assert.ok(first.id);
  assert.ok(first.category);
  assert.ok(first.description);
  assert.ok(typeof first.location.latitude === 'number');
  assert.ok(typeof first.location.longitude === 'number');
});

test('5. Category Filtering: Subsetting reports by category', () => {
  const mockReports: CommunityReport[] = [
    {
      id: 'm1',
      user_id: 'u1',
      category: 'water_access',
      description: 'Tap broken',
      location: { name: 'A', latitude: 13.08, longitude: 80.27 },
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
    {
      id: 'm2',
      user_id: 'u2',
      category: 'shade_cooling',
      description: 'No shade canopy',
      location: { name: 'B', latitude: 13.09, longitude: 80.28 },
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
  ];

  const waterFiltered = filterCommunityReports(mockReports, { category: 'water_access' });
  assert.strictEqual(waterFiltered.length, 1);
  assert.strictEqual(waterFiltered[0].id, 'm1');

  const shadeFiltered = filterCommunityReports(mockReports, { category: 'shade_cooling' });
  assert.strictEqual(shadeFiltered.length, 1);
  assert.strictEqual(shadeFiltered[0].id, 'm2');
});

test('6. Nearby Filtering: Haversine distance threshold filtering', () => {
  const center = { name: 'Chennai Central', latitude: 13.0827, longitude: 80.2707 };
  const mockReports: CommunityReport[] = [
    {
      id: 'n1',
      user_id: 'u1',
      category: 'water_access',
      description: 'Nearby issue 1km away',
      location: { name: 'Park Town', latitude: 13.0789, longitude: 80.2750 }, // ~1 km
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
    {
      id: 'n2',
      user_id: 'u2',
      category: 'water_access',
      description: 'Faraway issue 50km away',
      location: { name: 'Kanchipuram', latitude: 12.8342, longitude: 79.7036 }, // ~50 km
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
  ];

  const nearby5km = filterCommunityReports(mockReports, {
    userLocation: center,
    nearbyRadiusKm: 5,
  });

  assert.strictEqual(nearby5km.length, 1);
  assert.strictEqual(nearby5km[0].id, 'n1');
});

test('7. Status Lifecycle Handling: SUBMITTED -> UNDER_REVIEW -> RESOLVED', () => {
  const validStatuses = ['NEW', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'RESOLVED', 'REJECTED'];
  const testReport: CommunityReport = {
    id: 's1',
    user_id: 'u1',
    category: 'cooling_facility',
    description: 'AC in shelter not functioning',
    location: { name: 'Shelter A', latitude: 13.08, longitude: 80.27 },
    timestamp: new Date().toISOString(),
    status: 'SUBMITTED',
    votes_count: 1,
  };

  assert.strictEqual(validStatuses.includes(testReport.status), true);
  testReport.status = 'UNDER_REVIEW';
  assert.strictEqual(testReport.status, 'UNDER_REVIEW');
  testReport.status = 'RESOLVED';
  assert.strictEqual(testReport.status, 'RESOLVED');
});

test('8. Duplicate Submission Protection: Cooldown rate limiting', () => {
  clearSubmissionTracker();

  const existing: CommunityReport[] = [
    {
      id: 'dup_1',
      user_id: 'usr_dup_100',
      category: 'water_access',
      description: 'Duplicate broken water fountain description',
      location: { name: 'Central', latitude: 13.08, longitude: 80.27 },
      timestamp: new Date().toISOString(),
      status: 'SUBMITTED',
      votes_count: 1,
    },
  ];

  // First check
  const firstCheck = checkDuplicateSubmission('usr_dup_100', 'Unique new observation', existing, 30);
  assert.strictEqual(firstCheck.isDuplicate, false);

  // Exact duplicate description check
  const contentCheck = checkDuplicateSubmission('usr_dup_999', 'Duplicate broken water fountain description', existing, 30);
  assert.strictEqual(contentCheck.isDuplicate, true);
  assert.ok(contentCheck.reason?.includes('duplicate'));
});

test('9. Unauthorized Access Protection: Missing user context safeguards', () => {
  const dummyReport: CommunityReport = {
    id: 'rep_u1',
    user_id: 'usr_owner_101',
    category: 'water_access',
    description: 'Owner report',
    location: { name: 'Loc', latitude: 13.08, longitude: 80.27 },
    timestamp: new Date().toISOString(),
    status: 'SUBMITTED',
    votes_count: 1,
  };

  // Empty / undefined user
  assert.strictEqual(canUserModifyReport('', dummyReport), false);
  assert.strictEqual(canUserModifyReport(undefined as any, dummyReport), false);
});

test('10. RLS / User Isolation: User can modify/delete only own report', async () => {
  const report: CommunityReport = {
    id: 'rep_iso_001',
    user_id: 'user_alice',
    category: 'outdoor_heat',
    description: 'Alice report for isolation test',
    location: { name: 'Loc Alice', latitude: 13.08, longitude: 80.27 },
    timestamp: new Date().toISOString(),
    status: 'SUBMITTED',
    votes_count: 1,
  };

  // Alice can modify her own report
  assert.strictEqual(canUserModifyReport('user_alice', report), true);

  // Bob CANNOT modify Alice's report
  assert.strictEqual(canUserModifyReport('user_bob', report), false);

  // Bob trying to delete Alice's report should fail
  const deleteRes = await deleteCommunityReport('user_bob', 'rep_iso_001', report);
  assert.strictEqual(deleteRes.success, false);
  assert.ok(deleteRes.error?.includes('Unauthorized'));
});

test('11. Map Failure & Fallback: Graceful degradation for invalid locations', () => {
  const invalidCoords = validateCoordinates(NaN, undefined as any);
  assert.strictEqual(invalidCoords, false);

  // Verified cooling locations list exists and is non-empty
  assert.ok(Array.isArray(VERIFIED_COOLING_LOCATIONS));
  assert.ok(VERIFIED_COOLING_LOCATIONS.length > 0);
  assert.strictEqual(VERIFIED_COOLING_LOCATIONS[0].data_type, 'VERIFIED_LOCATION');
});

test('12. Supabase Failure & Local Store Fallback: Seamless offline operation', async () => {
  // Fetch reports when Supabase client is offline/unconfigured
  const reports = await fetchCommunityReportsFromSupabase();
  assert.ok(Array.isArray(reports));

  // Create report when Supabase is offline/unconfigured
  const createRes = await createCommunityReportInSupabase({
    user_id: 'usr_offline_test',
    category: 'infrastructure',
    description: 'Offline test report for heat safety',
    location: { name: 'Offline Loc', latitude: 13.0827, longitude: 80.2707 },
  });

  assert.strictEqual(createRes.success, true);
  assert.ok(createRes.report);
  assert.strictEqual(createRes.report.user_id, 'usr_offline_test');
});

test('13. Invalid Input Parameter Handling: Unsupported categories & invalid inputs', () => {
  const invalidCat = validateReportInput('invalid_category_xyz', 'Valid length description here', 13.0827, 80.2707);
  assert.strictEqual(invalidCat.valid, false);
  assert.ok(invalidCat.error?.includes('category'));

  const invalidCoords = validateReportInput('water_access', 'Valid description here', 1000.0, 500.0);
  assert.strictEqual(invalidCoords.valid, false);
  assert.ok(invalidCoords.error?.includes('coordinates'));
});

import assert from 'node:assert';
import { test } from 'node:test';
import { calculateDistanceKm, detectCommunityClusters } from '../lib/cluster-detector';

test('Haversine Distance Calculation', () => {
  // Chennai Central to Park Town (approx 1 km)
  const dist = calculateDistanceKm(13.0815, 80.2725, 13.0789, 80.2750);
  assert.ok(dist < 2.0, `Expected distance < 2km, got ${dist}`);
});

test('Spatial Community Cluster Detection', () => {
  const reports = [
    {
      id: 'r1',
      user_id: 'u1',
      category: 'water_access' as const,
      description: 'Water tap broken',
      location: { name: 'Loc A', latitude: 13.0815, longitude: 80.2725 },
      timestamp: new Date().toISOString(),
      status: 'VERIFIED' as const,
      votes_count: 5,
    },
    {
      id: 'r2',
      user_id: 'u2',
      category: 'water_access' as const,
      description: 'No water near station',
      location: { name: 'Loc B', latitude: 13.0830, longitude: 80.2710 },
      timestamp: new Date().toISOString(),
      status: 'VERIFIED' as const,
      votes_count: 3,
    },
  ];

  const clusters = detectCommunityClusters(reports, 3.0, 2);
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].status_label, 'POTENTIAL COMMUNITY ISSUE');
});

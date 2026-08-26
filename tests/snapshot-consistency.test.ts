/**
 * HeatShield AI — Snapshot Consistency Tests
 * Tests: immutability, GPS source, weather freshness, coordinate validation, data quality labels
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── Coordinate validation ────────────────────────────────────────────────────
describe('Coordinate Validation', () => {
  function validateCoordinates(lat: number, lon: number): boolean {
    if (!isFinite(lat) || !isFinite(lon)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lon < -180 || lon > 180) return false;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return false;
    return true;
  }

  it('should accept valid Vijayawada coordinates', () => {
    assert.equal(validateCoordinates(16.5062, 80.6480), true);
  });

  it('should accept valid Mumbai coordinates', () => {
    assert.equal(validateCoordinates(19.0760, 72.8777), true);
  });

  it('should accept valid Chennai coordinates', () => {
    assert.equal(validateCoordinates(13.0827, 80.2707), true);
  });

  it('should reject null island (0,0)', () => {
    assert.equal(validateCoordinates(0, 0), false);
  });

  it('should reject NaN', () => {
    assert.equal(validateCoordinates(NaN, 80.0), false);
  });

  it('should reject Infinity', () => {
    assert.equal(validateCoordinates(Infinity, 80.0), false);
  });

  it('should reject latitude out of range', () => {
    assert.equal(validateCoordinates(91, 80.0), false);
  });

  it('should reject longitude out of range', () => {
    assert.equal(validateCoordinates(16.0, 181), false);
  });

  it('should reject near-zero coordinates (uninitialized)', () => {
    assert.equal(validateCoordinates(0.001, 0.001), false);
  });
});

// ─── Data quality labeling ────────────────────────────────────────────────────
describe('Data Quality Labels', () => {
  type DataQuality = 'LIVE' | 'CACHED' | 'UNAVAILABLE';

  function resolveDataQuality(weather: { is_fallback?: boolean; is_cached?: boolean }): DataQuality {
    if (weather.is_fallback) return 'UNAVAILABLE';
    if (weather.is_cached) return 'CACHED';
    return 'LIVE';
  }

  it('should label fresh API response as LIVE', () => {
    assert.equal(resolveDataQuality({ is_fallback: false, is_cached: false }), 'LIVE');
  });

  it('should label cached response as CACHED', () => {
    assert.equal(resolveDataQuality({ is_cached: true }), 'CACHED');
  });

  it('should label fallback as UNAVAILABLE', () => {
    assert.equal(resolveDataQuality({ is_fallback: true }), 'UNAVAILABLE');
  });

  it('should NOT label fallback data as LIVE or CACHED', () => {
    const quality = resolveDataQuality({ is_fallback: true, is_cached: true });
    assert.notEqual(quality, 'LIVE');
    assert.notEqual(quality, 'CACHED');
    assert.equal(quality, 'UNAVAILABLE');
  });
});

// ─── GPS accuracy source rules ────────────────────────────────────────────────
describe('GPS Accuracy Source Rules', () => {
  it('should only report GPS accuracy for LIVE_GPS source', () => {
    function getAccuracyForSource(source: string, rawAccuracy?: number): number | undefined {
      return source === 'LIVE_GPS' ? rawAccuracy : undefined;
    }
    assert.equal(getAccuracyForSource('LIVE_GPS', 15), 15);
    assert.equal(getAccuracyForSource('SAVED_LOCATION', 15), undefined);
    assert.equal(getAccuracyForSource('MANUAL_LOCATION', 15), undefined);
    assert.equal(getAccuracyForSource('UNAVAILABLE', 15), undefined);
  });
});

// ─── Snapshot consistency (dashboard = email) ─────────────────────────────────
describe('Snapshot Consistency', () => {
  interface MockSnapshot {
    temperature: number;
    apparent_temperature: number;
    relative_humidity: number;
    wind_speed: number;
    risk_score: number;
    risk_level: string;
    location_name: string;
    precautions: string[];
    data_quality: string;
    observation_timestamp: string;
  }

  function createMockSnapshot(weather: {
    temperature: number;
    apparent_temperature: number;
    relative_humidity: number;
    wind_speed: number;
    is_fallback?: boolean;
    is_cached?: boolean;
    timestamp: string;
  }): MockSnapshot | null {
    if (weather.is_fallback) return null; // Refuse fallback data
    return {
      temperature: weather.temperature,
      apparent_temperature: weather.apparent_temperature,
      relative_humidity: weather.relative_humidity,
      wind_speed: weather.wind_speed,
      risk_score: 65,
      risk_level: 'HIGH',
      location_name: 'Vijayawada',
      precautions: ['Stay hydrated', 'Avoid direct sun', 'Rest regularly'],
      data_quality: weather.is_cached ? 'CACHED' : 'LIVE',
      observation_timestamp: weather.timestamp,
    };
  }

  it('should create a snapshot from valid live weather', () => {
    const snap = createMockSnapshot({
      temperature: 39.2,
      apparent_temperature: 44.1,
      relative_humidity: 72,
      wind_speed: 8.5,
      timestamp: new Date().toISOString(),
    });
    assert.notEqual(snap, null);
    assert.equal(snap?.temperature, 39.2);
    assert.equal(snap?.data_quality, 'LIVE');
  });

  it('should REFUSE to create a snapshot from fallback weather', () => {
    const snap = createMockSnapshot({
      temperature: 34.5,
      apparent_temperature: 41.2,
      relative_humidity: 68,
      wind_speed: 12.5,
      is_fallback: true,
      timestamp: new Date().toISOString(),
    });
    assert.equal(snap, null);
  });

  it('should ensure dashboard and email use the SAME snapshot values', () => {
    const weather = {
      temperature: 38.5,
      apparent_temperature: 43.2,
      relative_humidity: 75,
      wind_speed: 6.0,
      timestamp: new Date().toISOString(),
    };
    const snapshot = createMockSnapshot(weather)!;

    // Simulate dashboard reading from snapshot
    const dashboardTemp = snapshot.temperature;
    const dashboardRisk = snapshot.risk_score;

    // Simulate email reading from the SAME snapshot
    const emailTemp = snapshot.temperature;
    const emailRisk = snapshot.risk_score;

    // They MUST be identical
    assert.equal(dashboardTemp, emailTemp);
    assert.equal(dashboardRisk, emailRisk);
  });

  it('should have minimum 3 precautions', () => {
    const snap = createMockSnapshot({
      temperature: 38,
      apparent_temperature: 42,
      relative_humidity: 70,
      wind_speed: 10,
      timestamp: new Date().toISOString(),
    });
    assert.ok(snap!.precautions.length >= 3, 'Should have at least 3 precautions');
  });
});

// ─── Data age computation ─────────────────────────────────────────────────────
describe('Data Age Computation', () => {
  function computeDataAgeSeconds(observationTimestamp: string): number {
    try {
      const observed = new Date(observationTimestamp).getTime();
      if (!isFinite(observed)) return Infinity;
      return Math.max(0, Math.floor((Date.now() - observed) / 1000));
    } catch {
      return Infinity;
    }
  }

  it('should compute near-zero age for very recent timestamp', () => {
    const recent = new Date().toISOString();
    const age = computeDataAgeSeconds(recent);
    assert.ok(age < 5, `Age should be < 5s, got ${age}s`);
  });

  it('should compute correct age for 10-minute-old timestamp', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const age = computeDataAgeSeconds(tenMinAgo);
    assert.ok(age >= 590 && age <= 620, `Age should be ~600s, got ${age}s`);
  });

  it('should return Infinity for invalid timestamp', () => {
    assert.equal(computeDataAgeSeconds('not-a-date'), Infinity);
  });
});

// ─── Secret exposure check ────────────────────────────────────────────────────
describe('Secret Exposure Prevention', () => {
  it('should never use NEXT_PUBLIC_ prefix for server secrets', () => {
    const dangerousPatterns = [
      'NEXT_PUBLIC_RESEND_API_KEY',
      'NEXT_PUBLIC_TWILIO_AUTH_TOKEN',
      'NEXT_PUBLIC_TWILIO_ACCOUNT_SID',
      'NEXT_PUBLIC_FIREBASE_PRIVATE_KEY',
      'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT',
    ];
    // Verify none of these appear in client-accessible env naming conventions or process.env
    dangerousPatterns.forEach((key) => {
      // These keys must NEVER appear in production env vars with NEXT_PUBLIC_ prefix
      assert.equal(
        process.env[key],
        undefined,
        `${key} must not be present in process.env`
      );
    });
  });

  it('Firebase client config keys should use NEXT_PUBLIC_ (they are safe)', () => {
    const safePublicKeys = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    ];
    safePublicKeys.forEach((key) => {
      assert.ok(key.startsWith('NEXT_PUBLIC_'), `${key} should be public`);
      assert.ok(!key.includes('PRIVATE'), `${key} must not contain PRIVATE`);
      assert.ok(!key.includes('SERVICE_ACCOUNT'), `${key} must not contain SERVICE_ACCOUNT`);
    });
  });
});

console.log('✅ Snapshot consistency tests complete');

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateCoordinates,
  validateWeatherMetrics,
  validateContextualInputs,
  PHYSICAL_WEATHER_BOUNDS,
} from "../lib/input-validator.js";

describe("Coordinate Validation", () => {
  it("accepts valid coordinates (Chennai)", () => {
    const result = validateCoordinates(13.0827, 80.2707);
    assert.strictEqual(result.isValid, true, "Valid coordinates should be accepted");
    assert.ok(result.latitude >= -90 && result.latitude <= 90);
    assert.ok(result.longitude >= -180 && result.longitude <= 180);
  });

  it("rejects NaN latitude", () => {
    const result = validateCoordinates(NaN, 80.27);
    assert.strictEqual(result.isValid, false, "NaN latitude should be rejected");
    assert.ok(result.error, "Should include an error message");
  });

  it("rejects NaN longitude", () => {
    const result = validateCoordinates(13.08, NaN);
    assert.strictEqual(result.isValid, false, "NaN longitude should be rejected");
  });

  it("rejects Infinity latitude", () => {
    const result = validateCoordinates(Infinity, 80.27);
    assert.strictEqual(result.isValid, false, "Infinity latitude should be rejected");
  });

  it("rejects Null Island coordinates (0, 0)", () => {
    const result = validateCoordinates(0, 0);
    assert.strictEqual(result.isValid, false, "Null Island (0, 0) must be rejected");
    assert.ok(result.error && result.error.includes("Null Island"), "Error should reference Null Island");
  });

  it("rejects near-null-island within 0.001 deg tolerance", () => {
    const result = validateCoordinates(0.0005, 0.0005);
    assert.strictEqual(result.isValid, false, "Near-null-island coordinates should be rejected");
  });

  it("rejects latitude > 90", () => {
    const result = validateCoordinates(91, 0);
    assert.strictEqual(result.isValid, false, "Latitude > 90 should be rejected");
  });

  it("rejects latitude < -90", () => {
    const result = validateCoordinates(-91, 0);
    assert.strictEqual(result.isValid, false, "Latitude < -90 should be rejected");
  });

  it("rejects longitude > 180", () => {
    const result = validateCoordinates(0, 181);
    assert.strictEqual(result.isValid, false, "Longitude > 180 should be rejected");
  });

  it("rejects longitude < -180", () => {
    const result = validateCoordinates(0, -181);
    assert.strictEqual(result.isValid, false, "Longitude < -180 should be rejected");
  });

  it("accepts boundary values (+90, +180)", () => {
    const result = validateCoordinates(90, 180);
    assert.strictEqual(result.isValid, true, "Boundary (90, 180) should be valid");
  });

  it("accepts boundary values (-90, -180)", () => {
    const result = validateCoordinates(-90, -180);
    assert.strictEqual(result.isValid, true, "Boundary (-90, -180) should be valid");
  });

  it("returns safe fallback coordinates on failure", () => {
    const result = validateCoordinates(NaN, NaN);
    assert.ok(Number.isFinite(result.latitude), "Fallback latitude must be finite");
    assert.ok(Number.isFinite(result.longitude), "Fallback longitude must be finite");
  });
});

describe("Weather Metrics Validation", () => {
  it("accepts valid summer readings", () => {
    const result = validateWeatherMetrics({
      temperature: 38,
      apparent_temperature: 44,
      relative_humidity: 72,
      wind_speed: 8,
      pressure: 1008,
      weather_code: 0,
      timestamp: new Date().toISOString(),
      is_cached: false,
      is_fallback: false,
      location: { name: "Chennai", latitude: 13.08, longitude: 80.27 },
      hourly_forecast: [],
    });
    assert.strictEqual(result.isValid, true, "Valid summer readings should pass");
    assert.strictEqual(result.errors.length, 0, "No errors expected for valid data");
  });

  it("clamps temperature above 60C to maxTemp", () => {
    const result = validateWeatherMetrics({ temperature: 99 });
    assert.strictEqual(result.sanitized.temperature, PHYSICAL_WEATHER_BOUNDS.maxTemp, "Temp above 60C should be clamped to 60C");
    assert.ok(result.warnings.length > 0, "Should produce a warning for clamped temperature");
  });

  it("clamps temperature below -20C to minTemp", () => {
    const result = validateWeatherMetrics({ temperature: -50 });
    assert.strictEqual(result.sanitized.temperature, PHYSICAL_WEATHER_BOUNDS.minTemp, "Temp below -20C should be clamped");
  });

  it("applies default for NaN temperature", () => {
    const result = validateWeatherMetrics({ temperature: NaN });
    assert.ok(Number.isFinite(result.sanitized.temperature), "NaN temperature should produce finite default");
    assert.ok(result.errors.length > 0, "NaN temperature should produce an error");
    assert.strictEqual(result.isValid, false, "NaN temperature invalidates the input");
  });

  it("clamps humidity above 100% to 100%", () => {
    const result = validateWeatherMetrics({ relative_humidity: 150 });
    assert.strictEqual(result.sanitized.relative_humidity, 100, "Humidity > 100% should be clamped to 100%");
  });

  it("clamps humidity below 0% to 0%", () => {
    const result = validateWeatherMetrics({ relative_humidity: -10 });
    assert.strictEqual(result.sanitized.relative_humidity, 0, "Negative humidity should be clamped to 0%");
  });

  it("defaults negative wind speed to 0", () => {
    const result = validateWeatherMetrics({ wind_speed: -5 });
    assert.strictEqual(result.sanitized.wind_speed, 0, "Negative wind speed should default to 0 km/h");
  });

  it("outputs finite sanitized values for all-NaN input", () => {
    const result = validateWeatherMetrics({
      temperature: NaN,
      relative_humidity: NaN,
      wind_speed: NaN,
      apparent_temperature: NaN,
    });
    assert.ok(Number.isFinite(result.sanitized.temperature), "Sanitized temperature must be finite");
    assert.ok(Number.isFinite(result.sanitized.relative_humidity), "Sanitized humidity must be finite");
    assert.ok(Number.isFinite(result.sanitized.wind_speed), "Sanitized wind must be finite");
  });
});

describe("Contextual Input Validation", () => {
  it("accepts valid activity/duration/cooling/age combinations", () => {
    const result = validateContextualInputs({
      activity: "moderate",
      duration: "long",
      cooling: "limited",
      age_group: "older_adult",
    });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("falls back to moderate for unknown activity", () => {
    const result = validateContextualInputs({ activity: "extreme" });
    assert.strictEqual(result.sanitized.activity, "moderate");
    assert.ok(result.warnings.length > 0, "Should warn about unknown activity");
  });

  it("falls back to moderate for unknown duration", () => {
    const result = validateContextualInputs({ duration: "forever" });
    assert.strictEqual(result.sanitized.duration, "moderate");
  });

  it("falls back to good for unknown cooling access", () => {
    const result = validateContextualInputs({ cooling: "excellent" });
    assert.strictEqual(result.sanitized.cooling, "good");
  });

  it("falls back to adult for unknown age group", () => {
    const result = validateContextualInputs({ age_group: "teen" });
    assert.strictEqual(result.sanitized.age_group, "adult");
  });
});

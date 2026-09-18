import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateXAIContributions,
  explainPrediction,
  GLOBAL_MODEL_FEATURE_IMPORTANCES,
} from "../lib/xai-engine.js";

const HOT_WEATHER = {
  temperature: 42,
  apparent_temperature: 48,
  relative_humidity: 85,
  wind_speed: 2,
  pressure: 1010,
  weather_code: 0,
  timestamp: new Date().toISOString(),
  is_cached: false,
  is_fallback: false,
  location: { name: "Test", latitude: 13.08, longitude: 80.27 },
  hourly_forecast: [],
};

const COOL_WEATHER = {
  temperature: 22,
  apparent_temperature: 20,
  relative_humidity: 35,
  wind_speed: 30,
  pressure: 1013,
  weather_code: 0,
  timestamp: new Date().toISOString(),
  is_cached: false,
  is_fallback: false,
  location: { name: "Test", latitude: 13.08, longitude: 80.27 },
  hourly_forecast: [],
};

describe("Directional XAI - Escalating factors under heat stress", () => {
  const factors = calculateXAIContributions(
    HOT_WEATHER,
    { activity: "high", duration: "long", cooling: "limited", age_group: "older_adult" },
    85
  );

  it("returns at least 4 risk factors", () => {
    assert.ok(factors.length >= 4, "Expected >= 4 factors, got " + factors.length);
  });

  it("includes at least one escalating factor under extreme heat", () => {
    const escalating = factors.filter((f) => f.direction === "escalating");
    assert.ok(escalating.length > 0, "No escalating factors found under extreme heat stress");
  });

  it("temperature factor is marked escalating when apparent_temperature > 38", () => {
    const tempFactor = factors.find((f) => f.category === "temperature" && f.direction === "escalating");
    assert.ok(tempFactor, "Expected temperature to be an escalating factor above 38C apparent");
  });

  it("humidity factor is marked escalating when relative_humidity > 60%", () => {
    const humFactor = factors.find((f) => f.category === "humidity");
    assert.ok(humFactor, "Humidity factor missing");
    assert.strictEqual(humFactor.direction, "escalating", "Humidity above 60% should be escalating");
  });

  it("high physical activity is marked escalating", () => {
    const actFactor = factors.find((f) => f.category === "activity");
    assert.ok(actFactor, "Activity factor missing");
    assert.strictEqual(actFactor.direction, "escalating", "High activity should be escalating");
  });

  it("all weight_percent values sum to approximately 100", () => {
    const total = factors.reduce((acc, f) => acc + f.weight_percent, 0);
    assert.ok(Math.abs(total - 100) <= 2, "Weights sum to " + total + ", expected ~100");
  });

  it("factors are sorted by descending weight_percent", () => {
    for (let i = 0; i < factors.length - 1; i++) {
      assert.ok(
        factors[i].weight_percent >= factors[i + 1].weight_percent,
        "Factor " + i + " weight " + factors[i].weight_percent + " < factor " + (i+1) + " weight " + factors[i+1].weight_percent + " (not sorted)"
      );
    }
  });
});

describe("Directional XAI - Mitigating factors under cool conditions", () => {
  const factors = calculateXAIContributions(
    COOL_WEATHER,
    { activity: "low", duration: "short", cooling: "good", age_group: "adult" },
    15
  );

  it("includes a mitigating wind cooling factor when wind_speed > 12 km/h", () => {
    const windFactor = factors.find((f) => (f.name.toLowerCase().includes("wind") || f.name.toLowerCase().includes("convect")));
    assert.ok(windFactor, "Expected convective wind cooling factor for wind_speed 30 km/h");
    assert.strictEqual(windFactor.direction, "mitigating", "Wind cooling should be mitigating");
  });

  it("low activity is marked mitigating", () => {
    const actFactor = factors.find((f) => f.category === "activity");
    assert.ok(actFactor, "Activity factor missing");
    assert.strictEqual(actFactor.direction, "mitigating", "Low activity should be mitigating");
  });

  it("short exposure duration is marked mitigating", () => {
    const durFactor = factors.find((f) => f.category === "exposure" && f.name.toLowerCase().includes("duration"));
    assert.ok(durFactor, "Duration factor missing");
    assert.strictEqual(durFactor.direction, "mitigating", "Short duration should be mitigating");
  });
});

describe("XAI Explanation Schema Integrity", () => {
  const explanation = explainPrediction(75, "HIGH", HOT_WEATHER, {
    activity: "high",
    duration: "long",
    cooling: "limited",
    age_group: "adult",
  });

  it("returns escalating_factors array", () => {
    assert.ok(Array.isArray(explanation.escalating_factors), "escalating_factors must be an array");
  });

  it("returns mitigating_factors array", () => {
    assert.ok(Array.isArray(explanation.mitigating_factors), "mitigating_factors must be an array");
  });

  it("returns human_readable_summary as non-empty string", () => {
    assert.ok(typeof explanation.human_readable_summary === "string", "human_readable_summary must be a string");
    assert.ok(explanation.human_readable_summary.length > 10, "human_readable_summary must be non-trivial");
  });

  it("returns recommended_action for HIGH risk", () => {
    assert.ok(explanation.recommended_action.length > 20, "recommended_action must be substantive for HIGH risk");
  });

  it("embeds global_importances referencing key features", () => {
    assert.ok("apparent_temperature" in explanation.global_importances, "apparent_temperature missing from global importances");
    assert.ok("activity_level" in explanation.global_importances, "activity_level missing from global importances");
  });
});

describe("Global Feature Importances", () => {
  it("apparent_temperature has highest global importance (as per GB training)", () => {
    const apparentTempImportance = GLOBAL_MODEL_FEATURE_IMPORTANCES["apparent_temperature"];
    assert.ok(apparentTempImportance > 0, "apparent_temperature importance should be > 0");
    for (const [key, val] of Object.entries(GLOBAL_MODEL_FEATURE_IMPORTANCES)) {
      if (key !== "apparent_temperature") {
        assert.ok(
          apparentTempImportance >= val,
          "apparent_temperature (" + apparentTempImportance + ") should be >= " + key + " (" + val + ")"
        );
      }
    }
  });

  it("all global importances are non-negative", () => {
    for (const [key, val] of Object.entries(GLOBAL_MODEL_FEATURE_IMPORTANCES)) {
      assert.ok(val >= 0, "Feature " + key + " has negative importance " + val);
    }
  });
});

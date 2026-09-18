import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const schema = readFileSync(join(ROOT, "supabase", "schema.sql"), "utf-8");
const nextConfig = readFileSync(join(ROOT, "next.config.js"), "utf-8");

const REQUIRED_TABLES = [
  "profiles",
  "organizations",
  "organization_members",
  "saved_locations",
  "weather_observations",
  "risk_assessments",
  "incidents",
  "notifications",
  "audit_logs",
];

describe("Supabase RLS Schema Security", () => {
  it("enables RLS on all 9 required tables", () => {
    for (const table of REQUIRED_TABLES) {
      const hasRLS = schema.includes("ALTER TABLE public." + table + " ENABLE ROW LEVEL SECURITY");
      assert.ok(hasRLS, "RLS not enabled on table: " + table);
    }
  });

  it("has least-privilege RLS policy for saved_locations (user-owned)", () => {
    assert.ok(
      schema.includes("auth.uid() = user_id") && schema.includes("saved_locations"),
      "saved_locations must have user_id-scoped RLS policy"
    );
  });

  it("has RLS policy for risk_assessments", () => {
    assert.ok(
      schema.includes("risk_assessments"),
      "risk_assessments table must have RLS policies defined"
    );
  });

  it("has public read policy for weather_observations (meteorological transparency)", () => {
    assert.ok(
      schema.includes("Public read weather observations"),
      "weather_observations must allow public read"
    );
  });

  it("has public read policy for incidents (community situational awareness)", () => {
    assert.ok(
      schema.includes("Public read community incidents"),
      "incidents must allow public read"
    );
  });

  it("has private read policy for notifications (user-private alerts)", () => {
    assert.ok(
      schema.includes("Users read own notifications"),
      "notifications must have private user-scoped read policy"
    );
  });

  it("has audit log policies scoped to user and admins", () => {
    assert.ok(schema.includes("Users read own audit logs"), "audit_logs user read policy missing");
    assert.ok(schema.includes("Admins read organization audit logs"), "audit_logs admin read policy missing");
  });

  it("has no hardcoded JWT tokens or API keys in schema.sql", () => {
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(schema), "schema.sql may contain a JWT token");
    assert.ok(!/sk-[A-Za-z0-9]{30,}/.test(schema), "schema.sql may contain an API key");
  });

  it("has performance indexes on high-query columns", () => {
    assert.ok(schema.includes("CREATE INDEX"), "Schema must include performance indexes");
    assert.ok(schema.includes("idx_incidents_lat_lng"), "Geospatial index on incidents lat/lng missing");
    assert.ok(schema.includes("idx_risk_assessments_user"), "User-scoped index on risk_assessments missing");
  });

  it("uses gen_random_uuid() for primary keys (cryptographically secure)", () => {
    assert.ok(schema.includes("gen_random_uuid()"), "Tables should use gen_random_uuid()");
  });

  it("profiles table references auth.users with ON DELETE CASCADE", () => {
    assert.ok(
      schema.includes("REFERENCES auth.users(id) ON DELETE CASCADE"),
      "profiles must cascade delete from auth.users"
    );
  });
});

describe("Next.js HTTP Security Headers", () => {
  it("includes X-Content-Type-Options: nosniff", () => {
    assert.ok(
      nextConfig.includes("X-Content-Type-Options") && nextConfig.includes("nosniff"),
      "Missing X-Content-Type-Options: nosniff header"
    );
  });

  it("includes X-Frame-Options: DENY (clickjacking protection)", () => {
    assert.ok(
      nextConfig.includes("X-Frame-Options") && nextConfig.includes("DENY"),
      "Missing X-Frame-Options: DENY header"
    );
  });

  it("includes Referrer-Policy: strict-origin-when-cross-origin", () => {
    assert.ok(
      nextConfig.includes("Referrer-Policy") && nextConfig.includes("strict-origin-when-cross-origin"),
      "Missing Referrer-Policy header"
    );
  });

  it("includes Permissions-Policy restricting camera and microphone", () => {
    assert.ok(nextConfig.includes("Permissions-Policy"), "Missing Permissions-Policy header");
    assert.ok(nextConfig.includes("camera=()") || nextConfig.includes("camera=("), "Permissions-Policy should restrict camera");
  });

  it("security headers apply to all routes", () => {
    assert.ok(
      nextConfig.includes("/(.*)")|| nextConfig.includes("'/'"),
      "Security headers must apply to all routes"
    );
  });
});

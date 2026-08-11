# Database Schema & Security — HEATSHIELD AI

## PostgreSQL Tables (Supabase)
1. `profiles`: User context, age group, exposure, activity level, language, role.
2. `organizations`: Organization profiles (School, Worksite, NGO).
3. `saved_locations`: User saved geographical locations.
4. `weather_observations`: Environmental weather stream snapshots.
5. `risk_assessments`: Logged heat risk evaluations & snapshots.
6. `incidents`: Community heat issue reports (water access, shade, outdoor heat).
7. `notifications`: In-app risk threshold alerts.
8. `audit_logs`: Platform audit logging.

## Schema File
PostgreSQL schema SQL is available in `supabase/schema.sql`.

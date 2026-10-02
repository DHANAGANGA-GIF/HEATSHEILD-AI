# HeatShield AI Project Rules

## Data Integrity

- NEVER use mock, random, or hardcoded weather or risk values in production code.
- Mock data is allowed only in tests or an explicitly labelled `/demo` route.
- Every user-visible weather/risk number must have a clear source and local-time "as of" timestamp.
- Never write "LIVE" unless the underlying data is less than 15 minutes old.
- Never show a risk score or level without the data timestamp and source label.
- Never claim ML inference when production inference is rule-based.
- Do not invent datasets, ML accuracy, research results, or performance numbers.

## Architecture Preservation

- Do not modify authentication, dashboard, Analytics, Timeline, Gmail OAuth, database, or production risk engine unless explicitly required by the current task.
- Reuse the existing `evaluateHeatRisk()` risk-engine implementation — do not duplicate it.
- Reuse existing weather helpers such as `fetchWeatherData()`, `searchLocations()`, `reverseGeocode()`, and `scoreForecast()` when they already exist.
- Do not rewrite existing heat-index formulas.
- Reuse `lib/i18n.ts` for all user-visible strings where translations exist.
- Do not change working production behavior to make code look cleaner.

## Honesty in UI Claims

- Never claim OSHA/NIOSH alignment unless explicitly verified and documented.
- Never claim exact GPS tracking unless actually implemented.
- Never claim exact percentage feature contributions unless mathematically calculated.
- Clearly mark unimplemented features as "Planned".
- Never claim "SMS alerts", "WhatsApp alerts", or "Voice alerts" as available unless implemented.
- Never claim a language is fully supported unless translations are complete and reviewed.
- Do not claim Open-Meteo data is a street-level physical sensor reading.
- State clearly that HeatShield AI is decision-support software, not a medical diagnosis system.

## Risk Display

- Never use color alone for risk levels. Always include text and a shape/icon.
  - LOW: ● circle
  - MODERATE: ● circle (different color)
  - HIGH: ▲ triangle
  - EXTREME: ◆ diamond
- Risk colors: LOW #0072B2 · MODERATE #E69F00 · HIGH #B84A00 · EXTREME #8E1B4C
- Risk thresholds must match the engine: 0-35 LOW · 36-60 MODERATE · 61-80 HIGH · 81-100 EXTREME

## Freshness

- Show "Fresh" only if data is < 15 minutes old.
- Show "Aging" for 15–60 minutes.
- Show "Stale" for > 60 minutes.
- Always show "As of HH:MM local time" using the actual data timestamp.

## Privacy

- For the public checker: do not persist coordinates between sessions.
- Round browser coordinates to 2 decimal places before weather requests (`DISPLAY_COORD_PRECISION`).
- Do not put exact coordinates into user-visible emails.
- Do not claim "we never store location" if authenticated parts of the app store location.

## Language

- Only present a language as fully available if translations are complete and reviewed.
- Unfinished languages must be labelled "Planned".
- Do not machine-generate a language and silently present it as professionally reviewed.

## Emergency Information

- Always display emergency contact information.
- Use `emergencyNumber(country)` for country-appropriate numbers.
- Never hardcode a random emergency number.
- Make clear: "If someone is seriously unwell, seek emergency medical help immediately."

## Language & Tone

- Use plain language. Avoid jargon: telemetry, context fusion, microclimate intelligence, etc.
- Use "heat risk" not "thermal stress score" in public-facing copy.
- Body text ≥ 17px equivalent where appropriate.

## Technical

- Preserve UTF-8 throughout.
- Keep all existing tests passing.
- Add tests for every new feature.
- Never invent URLs, emails, API keys, credentials, or API results.
- Never expose secrets.
- Target WCAG 2.2 AA for all public-facing pages.
- No horizontal scrolling at 375px width.
- Respect prefers-reduced-motion.

# Test Plan — HEATSHIELD AI

## Automated Test Results (Validated)

```
✔ AI Assistant Safety Filter Triggers Emergency Warning (36.85ms)
✔ AI Assistant Handles Risk Driver Queries (0.42ms)
✔ Haversine Distance Calculation (2.07ms)
✔ Spatial Community Cluster Detection (1.99ms)
✔ Steadman Heat Index Calculation (0.99ms)
✔ Heat Risk Engine Evaluation (1.35ms)

tests: 6 | pass: 6 | fail: 0
```

## Test Categories Covered
1. **Risk Engine:** Steadman Heat Index equations, contextual multiplier cascades, score range clipping.
2. **AI Assistant Safety Guardrails:** Emergency keyword detection → emergency referral trigger, no medical diagnosis.
3. **Spatial Cluster Detection:** Haversine distance accuracy, minimum proximity cluster grouping.

## Manual Test Flows
1. Login → Google OAuth / Demo Session → Profile Save → Dashboard Load.
2. Real Open-Meteo API fetch for Chennai (13.08, 80.27) → Risk score displayed.
3. Community report submission → Status: SUBMITTED → Appear on Leaflet map.
4. AI Assistant: send "Someone fainted" → Verify Emergency Warning triggered.
5. Simulator: Adjust sliders → Verify real-time risk score updates.

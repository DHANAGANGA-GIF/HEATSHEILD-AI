# HeatShield AI Risk Simulator – Phase 4B Validation Document

## 1. Architecture & Calculation Flow

The HeatShield Risk Simulator allows users to model "What-If" scenarios by modifying contextual parameters (physical workload, exposure duration, cooling infrastructure, age group) and environmental locations while maintaining a clear, strict distinction between **live observed measurements** and **estimated scenario outcomes**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LIVE BASELINE ENVIRONMENT STREAM                     │
│    Open-Meteo REST API → Live Weather (Temp, Humidity, Apparent, Wind) │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   BASELINE RISK ENGINE EVALUATION                       │
│    `evaluateHeatRisk` → Baseline Score (0-100) & Level (LOW-EXTREME)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   SCENARIO INPUT & LOCATION SWITCHER                    │
│    • Activity: Low / Moderate / High Workload                           │
│    • Exposure Duration: Short / Moderate / Long                         │
│    • Cooling Access: Good AC / Limited Shade / No Cooling               │
│    • Age Category: Child / Adult / Older Adult                          │
│    • Location Switcher: Real Open-Meteo Weather for Scenario Location    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 SCENARIO COMPARISON & DELTA ENGINE                      │
│    • Re-runs `evaluateHeatRisk` on scenario inputs                     │
│    • Computes Score Delta (e.g. +17 pts) & Risk Tier Transitions        │
│    • Generates Changed Factor Attribution & Scenario Recommendations    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   PROMINENT MANDATORY SCENARIO LABEL                    │
│       "SCENARIO ESTIMATE — NOT A LIVE OBSERVATION"                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inputs & Contextual Variables

| Input Parameter | Supported Values | Impact Multiplier in Engine |
| :--- | :--- | :--- |
| **Location Scenario** | Live Location / Saved Locations | Fetches live Open-Meteo environmental data |
| **Physical Activity** | `low`, `moderate`, `high` | Baseline (1.0x) / Moderate (1.15x) / High (1.30x) |
| **Exposure Duration** | `short`, `moderate`, `long` | Short (1.0x) / Moderate (1.10x) / Long (1.25x) |
| **Cooling Access** | `good`, `limited`, `prefer_not_to_say` | Good AC (0.85x) / Limited (1.18x) / None (1.0x) |
| **Age Vulnerability** | `child`, `adult`, `older_adult` | Child (1.10x) / Older Adult (1.22x) / Adult (1.0x) |

---

## 3. Baseline vs. Scenario Distinction

- **Live Baseline:** Represents actual observed environmental metrics and current user context. Flagged with data status badges (`LIVE`, `CACHED`, `UNAVAILABLE`).
- **Simulated Scenario:** Represents user-manipulated hypothetical conditions. All scenario cards, scores, and comparisons carry the mandatory badge: **`SCENARIO ESTIMATE — NOT A LIVE OBSERVATION`**.

---

## 4. ML Inference vs. Contextual Scenario Adjustment

The simulator uses a hybrid evaluation model:
1. **ML Prediction:** Scikit-learn Ensemble Decision Tree models environmental heat load from temperature, humidity, apparent temp, and wind.
2. **Contextual Scenario Adjustment:** Evaluates metabolic workload, cumulative exposure duration, cooling infrastructure relief, and age thermoregulatory multipliers.
3. **Transparency Notice:** Every simulation result explicitly displays: `"ML PREDICTION: Ensemble Decision Tree + CONTEXTUAL SCENARIO ADJUSTMENT applied."`

---

## 5. Safety Guardrails & Non-Medical Boundaries

> [!IMPORTANT]
> **Operational Estimate Disclaimer:** The simulator estimates environmental heat stress. It **does NOT predict medical outcomes**, diagnose heat stroke, claim immunity from heat illness, or replace medical advice.

### Scientific Integrity Rules
- No scientifically unsupported multipliers are added.
- Weather data for location scenarios is fetched directly from Open-Meteo REST endpoints (never fake/hard-coded weather).
- Output scores are strictly bounded between 5 and 100.

---

## 6. Test Execution Results

All 25 unit tests across the test suite passed successfully (11 focused simulator tests):

```
✔ Risk Simulator: Baseline Scenario Initialization (0.3ms)
✔ Risk Simulator: Activity Level Change Scenario (0.2ms)
✔ Risk Simulator: Exposure Duration Change Scenario (0.2ms)
✔ Risk Simulator: Location Change Scenario (0.2ms)
✔ Risk Simulator: Score Diff Calculation (0.2ms)
✔ Risk Simulator: Risk Tier Transition (0.2ms)
✔ Risk Simulator: Extreme Input Values (0.1ms)
✔ Risk Simulator: Reset Scenario (0.2ms)
✔ Risk Simulator: Missing Weather Data Handling (0.1ms)
✔ Risk Simulator: ML & Contextual Notice Inclusion (0.2ms)
✔ Risk Simulator: Mandatory Labeling Assertion (0.1ms)
✔ AI Assistant unit tests (10 tests passing)
✔ Cluster detector unit tests (2 tests passing)
✔ Heat risk engine unit tests (2 tests passing)

Total Suite Tests: 25 | Passed: 25 | Failed: 0
TypeScript Compilation: PASS (0 errors)
```

---

## 7. Known Limitations

1. **Microclimatic Micro-variations:** Ground radiant heat (asphalt/concrete absorption) and direct solar irradiance variations are modeled at regional resolution unless urban micro-station data is available.
2. **Deterministic Inputs:** Multipliers follow standard Steadman/NWS & NIOSH thermal strain guidelines.

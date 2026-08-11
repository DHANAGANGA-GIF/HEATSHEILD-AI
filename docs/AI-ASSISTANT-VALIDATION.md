# HeatShield AI Safety Assistant – Phase 4A Validation Document

## 1. Architecture Overview

The HeatShield AI Safety Assistant is designed as a context-aware decision support assistant operating on a zero-budget architecture. It processes real-time environmental data, personal context snapshots, and HeatShield risk engine outputs to provide actionable, explainable heat safety guidance.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER QUERY / INTERFACE                         │
│       React UI (`AiAssistant.tsx`) on `/assistant` & `/dashboard`       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTEXT AGGREGATION LAYER                          │
│   • Location & Weather: Temperature, Apparent Temp, RH%, Wind           │
│   • Heat Risk Engine: Score (0-100), Level (LOW-EXTREME), Drivers       │
│   • Personal Context: Activity, Exposure Duration, Cooling Access       │
│   • Data Quality & Cache Status: LIVE / CACHED / UNAVAILABLE            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAFETY & GUARDRAIL ROUTER                            │
│   1. Emergency Medical Filter (Fainting, Chest Pain, Heatstroke, etc.)  │
│   2. Query Intent Parser (Drivers, Guidance, Forecast, General)         │
│   3. Mode Formatter (SIMPLE vs TECHNICAL)                               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       STRUCTURED RESPONSE ENGINE                        │
│   Outputs structured text with clear sections:                          │
│   CURRENT CONDITIONS | RISK | MAIN DRIVERS | ACTION | FORECAST | STATUS │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Context Inputs

The assistant consumes live state from the application context:

| Context Element | Data Source | Example Value |
| :--- | :--- | :--- |
| **Location** | Browser Geolocation / Open-Meteo Geocoding | `Chennai (13.08°N, 80.27°E)` |
| **Air Temperature** | Open-Meteo API | `36°C` |
| **Apparent Temp (Heat Index)** | Steadman Equation / Open-Meteo | `41°C` |
| **Relative Humidity** | Open-Meteo API | `65%` |
| **Wind Speed** | Open-Meteo API | `10 km/h` |
| **Risk Tier & Score** | HeatShield Risk Engine (`evaluateHeatRisk`) | `HIGH (75/100)` |
| **Risk Drivers (XAI)** | HeatShield Factor Attribution | `Air Temp (40%), Humidity (25%)` |
| **Personal Context** | User Profile (`getUserProfile`) | `Activity: High, Cooling: Limited` |
| **Data Status** | Weather API Cache System | `LIVE / CACHED / UNAVAILABLE` |

---

## 3. Supported Questions & Intent Routing

The assistant supports 10 primary question categories:

1. **"Why is my risk high?"** – Explains risk factors with percentage weights derived from XAI.
2. **"What is causing my current risk?"** – Breaks down primary environmental & activity drivers.
3. **"What precautions should I take?"** – Returns targeted preventive guidance (Hydration, Cooling, Rest).
4. **"What should I do right now?"** – Immediate operational safety actions tailored to risk tier.
5. **"When will the risk be highest?"** – Evaluates hourly forecast trajectory for peak heat index hours.
6. **"Is the current period higher risk?"** – Compares current observation against daytime baseline.
7. **"Explain my risk simply."** – Overrides response formatting to non-technical plain language.
8. **"Explain my risk technically."** – Provides meteorological metrics, thermal load equations, and exact scores.
9. **"How can I reduce heat exposure?"** – Specific exposure mitigation techniques.
10. **General HeatShield safety queries** – Contextual system overview & current risk snapshot.

---

## 4. Response Structure

All applicable responses adhere to standard formatted sections:

```
CURRENT CONDITIONS
→ Air Temp: 36°C | Apparent Temp: 41°C | Relative Humidity: 65% | Wind: 10 km/h | Location: Chennai

RISK
→ Level: HIGH | Score: 75/100

MAIN DRIVERS
1. Air Temperature (40% impact): High ambient air temperature imposing thermal load.
2. Relative Humidity (25% impact): Elevated atmospheric moisture inhibiting sweat evaporation.

ACTION
1. Increased Fluid Intake: Consume 500-750mL of electrolyte-enhanced fluid per hour of active exposure.

DATA STATUS
→ LIVE
```

---

## 5. Safety Guardrails & Medical Boundaries

> [!IMPORTANT]
> **Non-Medical Disclaimer:** HeatShield AI is a software decision-support assistant and **does NOT provide medical diagnosis**, prescribe treatments, or replace healthcare professionals.

### Emergency Signal Filter
If user input contains emergency keywords (e.g., *fainted*, *unconscious*, *chest pain*, *seizure*, *confusion*, *stopped sweating*, *vomiting*, *high fever*, *passing out*, *heat stroke*):
1. **Immediate Referral:** Instructs the user to call local emergency services (`108 / 112 / 911`) right away.
2. **Cooling Steps:** Provides basic emergency cooling guidance (move to shade, apply cool water to skin, ensure airway clearance).
3. **No Diagnosis:** Refuses any attempt to diagnose medical conditions or guarantee safety outcomes.

---

## 6. Privacy & Security Behavior

- **No Secret Exposure:** Credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are protected and never logged or exposed.
- **Client-Side Privacy:** User queries and context are processed locally or sent only to verified backend endpoints.
- **No Cross-User Leakage:** Queries only access the authenticated user's own profile and active location.

---

## 7. Failure Handling & Offline Resilience

- **Missing Weather Data:** The assistant explicitly reports `DATA STATUS: UNAVAILABLE` and refrains from inventing missing metrics.
- **Missing Forecast Data:** The assistant explicitly states forecast trajectory is unavailable, avoiding fake predictions.
- **Empty / Invalid Queries:** Prompts user to submit a valid heat safety query without crashing.
- **Cached Data State:** Clearly flags when data is loaded from cache (`DATA STATUS: CACHED`).

---

## 8. Test Execution Results

All 14 focused unit tests passed successfully:

```
✔ AI Assistant: Emergency Safety Trigger (13.2ms)
✔ AI Assistant: Risk Driver Question (0.3ms)
✔ AI Assistant: Guidance & Precautions Question (0.2ms)
✔ AI Assistant: Forecast & Peak Hours Question (0.2ms)
✔ AI Assistant: Simple Mode Response (0.2ms)
✔ AI Assistant: Technical Mode Response (0.2ms)
✔ AI Assistant: Missing Environmental Data Handling (0.1ms)
✔ AI Assistant: Empty Input Handling (0.1ms)
✔ AI Assistant: Cached Data Status Preservation (0.2ms)
✔ AI Assistant: General Fallback Question (0.2ms)
✔ Haversine Distance Calculation (0.8ms)
✔ Spatial Community Cluster Detection (1.1ms)
✔ Steadman Heat Index Calculation (1.4ms)
✔ Heat Risk Engine Evaluation (1.5ms)

Total Tests: 14 | Passed: 14 | Failed: 0
TypeScript Compilation: PASS (0 errors)
```

---

## 9. Known Limitations

1. **Microclimate Variance:** Sensor measurements represent regional weather stations; localized urban heat island microclimates may vary.
2. **Deterministic Fallback:** Operates on rule-based intent parsing and scikit-learn models when external LLM endpoints are unconfigured, ensuring 100% operational uptime on zero budget.

# HeatShield AI — Master Viva & Project Defense Guide (75 Questions & Answers)

> **Comprehensive Oral Defense & Examination Guide**  
> **Date**: August 2026  
> **Status**: APPROVED FOR VIVA DEFENSE  

---

## 1. Core Memorization Summaries

### 60-Second Project Overview
> *"HeatShield AI is an intelligent multi-tenant heat-risk decision-support platform designed to transform raw environmental weather streams into personalized and institutional risk intelligence. Traditional weather apps report ambient temperature (e.g. 38°C) without context. HeatShield AI integrates live Open-Meteo atmospheric streams with personal physiological context—such as physical exertion, exposure duration, cooling access, and age—to compute a composite risk score from 0 to 100 across four tiers: LOW, MODERATE, HIGH, and EXTREME. The platform features Explainable AI feature attribution, 24–48 hour forecast timelines, smart alert deduplication, interactive community hazard mapping, scenario simulation, and multi-tenant operational dashboards for Schools, Worksites, and NGOs. Built on Next.js 14 and Supabase PostgreSQL with Row Level Security, HeatShield AI operates on zero-budget serverless infrastructure while enforcing strict safety guardrails."*

---

### 3-Minute Technical Architecture Overview
> *"Technically, HeatShield AI operates on a multi-tier serverless architecture. The frontend is built with Next.js 14 App Router, TypeScript, Tailwind CSS, and Leaflet mapping. Environmental data is ingested asynchronously from the Open-Meteo REST API, with a 15-minute LocalStorage caching layer to ensure resilience against API downtime. 
> 
> Production risk assessment is performed in-browser via a deterministic TypeScript engine in `lib/risk-engine.ts`. This engine computes the empirical Steadman/Rothfusz Heat Index equation, applies non-linear environmental scaling, and combines it with physiological context multipliers for activity exertion, exposure duration, cooling availability, and age vulnerability. Explainable AI feature attribution calculates proportional driver contributions (such as 42% apparent temperature vs 16% exertion), which are mapped to NIOSH/OSHA-aligned operational recommendations.
> 
> Database security and multi-tenancy are powered by Supabase PostgreSQL with Row Level Security (RLS) policies enforcing `auth.uid() = user_id` and organization membership checks. In addition to the deterministic production engine, we conducted an offline research experiment evaluating a Gradient Boosting model trained on 74,440 ECMWF ERA5-Land reanalysis records (achieving 97.86% temporal accuracy), as well as a 5,000-sample synthetic development benchmark (achieving 81.70% accuracy). The application is fully validated with 78 automated integration tests and zero static type errors."*

---

### "Why This Project?" Academic Response
> *"We undertook this project because extreme atmospheric heat is an escalating global health emergency, yet existing public weather interfaces provide raw ambient conditions without context. A static temperature reading fails to communicate actual physiological thermal strain to an outdoor worker, a child at recess, or an elderly resident. Users need understandable, action-oriented information, and institutions need context-specific decision support. The objective of HeatShield AI is to improve access to timely environmental heat-risk information and preventive decision support using open-source, zero-budget infrastructure."*

---

### Master Limitations Statement
> *"HeatShield AI is a non-clinical decision-support prototype, not a medical diagnosis system or heatstroke prediction tool. The production runtime uses a deterministic TypeScript risk engine combining Steadman Heat Index physics with NIOSH context multipliers. The ERA5-Land ML experiment is a historical research benchmark, while the synthetic model is a development benchmark. The raw ERA5 dataset is not stored within the source code repository, and `apparent_temperature` introduces target-derived feature collinearity in tree splits. Real-world prospective clinical validation and broader geographic testing remain future work."*

---

## 2. Project Defense Strategy (Handling Criticism)

### Defense 1: *"Your model isn't used in production."*
> **Response**: *"Correct. We intentionally separated the historical ML research benchmark from the production deterministic risk engine because the available contextual production inputs and the historical ML reanalysis dataset represent different problem formulations. The production engine prioritizes deterministic, transparent, 100% offline-resilient, and browser-compatible decision support without misrepresenting the ML model's capabilities."*

### Defense 2: *"Your accuracy is only 81.7%."*
> **Response**: *"That value belongs to the synthetic development benchmark (`ai-engine/models/evaluation_report.json`), which was evaluated on 1,000 synthetic test samples for software integration testing. The historical ERA5-Land reanalysis experiment achieved 97.86% temporal accuracy and 0.8176 Macro F1. We maintain a strict boundary between development benchmarks and historical research evaluations."*

### Defense 3: *"Why not deploy the Gradient Boosting model in production?"*
> **Response**: *"Deploying the Python Gradient Boosting model into production client code would require executing a Python microservice backend, introducing hosting costs, API latency, and network vulnerability. Our in-browser TypeScript risk engine delivers instant, zero-latency, 100% offline-resilient decision support while producing scores that mirror empirical physics."*

---

## 3. Categorized 75 Questions & Answers

### A. Problem Statement & Domain
1. **Q: What problem does HeatShield AI solve?**  
   **A**: It solves the contextual heat-risk evaluation gap by transforming generic ambient weather data into personalized, context-aware heat risk scores.
2. **Q: Is HeatShield AI a medical diagnosis system?**  
   **A**: **No.** It is strictly an environmental decision-support tool.
3. **Q: Can HeatShield AI predict heatstroke?**  
   **A**: **No.** Heatstroke is a clinical event depending on vascular and metabolic factors. HeatShield AI estimates environmental risk tiers to promote preventive action.
4. **Q: What is the primary target demographic?**  
   **A**: Outdoor workers, athletes, elderly residents, school administrators, worksite managers, and NGO responders.

### B. System Architecture
5. **Q: What is the system architecture?**  
   **A**: A 3-tier serverless architecture: Next.js 14 App Router frontend, Open-Meteo REST environmental stream, and Supabase PostgreSQL database with RLS.
6. **Q: How does the system handle offline operation?**  
   **A**: Weather data is cached in LocalStorage (15-minute window), and the risk engine runs 100% client-side in TypeScript.

### C. Frontend Architecture
7. **Q: Why Next.js 14 App Router?**  
   **A**: For server/client component boundaries, dynamic route handling, and automatic static optimization.
8. **Q: How are maps rendered?**  
   **A**: Using Leaflet.js and React-Leaflet with OpenStreetMap tiles.

### D. Backend & API Services
9. **Q: What external APIs are used?**  
   **A**: Open-Meteo Forecast API (free, no API key required) and Open-Meteo Geocoding API.
10. **Q: Is there a Python backend running in production?**  
    **A**: No. Python FastAPI code in `/ai-engine` is available for optional microservice deployment, but production uses the client-side TS engine.

### E. Database Architecture
11. **Q: What database is used?**  
    **A**: Supabase PostgreSQL featuring 9 relational tables.
12. **Q: How are community incidents stored?**  
    **A**: In the `incidents` table with lat/lng coordinates, category, description, and status.

### F. Supabase Features
13. **Q: Why choose Supabase?**  
    **A**: It provides open-source PostgreSQL, built-in Auth, instant REST APIs, and native Row Level Security (RLS) on a free tier.

### G. Authentication
14. **Q: How is authentication implemented?**  
    **A**: Via Supabase Auth supporting Email and OAuth session management.

### H. Row Level Security (RLS)
15. **Q: What is Row Level Security (RLS)?**  
    **A**: Database-level policy rules (`USING` / `WITH CHECK` clauses) executed by PostgreSQL to filter rows by `auth.uid()` or organization membership.
16. **Q: How does RLS protect user privacy?**  
    **A**: Even if client code is modified, PostgreSQL blocks unauthorized cross-user SQL queries at the database layer.

### I. Role-Based Access Control (RBAC)
17. **Q: How does RBAC differ from RLS?**  
    **A**: RLS filters database rows; RBAC controls UI view access and operational privileges based on user roles (`admin`, `school`, `worksite`, `ngo`, `user`).

### J. Weather Stream Processing
18. **Q: How does Open-Meteo ingestion work?**  
    **A**: Asynchronous REST fetching retrieves hourly dry-bulb temp, relative humidity, apparent temp, and wind speed.

### K. Heat Index Science
19. **Q: What formula is used for Heat Index?**  
    **A**: The Steadman Heat Index model adapted via the NWS Rothfusz regression equation.
20. **Q: Why is Heat Index better than dry-bulb temperature?**  
    **A**: Relative humidity reduces sweat evaporation efficiency, making high humidity feel significantly hotter and causing higher physiological thermal stress.

### L. Risk Engine Logic
21. **Q: How is the composite score calculated in `lib/risk-engine.ts`?**  
    **A**: Environmental base score ($\max(AT, \text{HI})$ + humidity bonus - wind relief) multiplied by activity, duration, cooling, and age multipliers, clamped to $[5, 100]$.
22. **Q: What are the 4 risk tiers?**  
    **A**: `LOW` (<36), `MODERATE` (36–60), `HIGH` (61–80), `EXTREME` (≥81).

### M. Machine Learning Framework
23. **Q: What ML model was selected in research?**  
    **A**: Gradient Boosting Classifier.

### N. Datasets
24. **Q: What was the primary research dataset?**  
    **A**: ECMWF ERA5-Land Historical Reanalysis (2021–2024), 74,440 records.
25. **Q: What is the synthetic dataset?**  
    **A**: 5,000 synthetic development samples (`ai-engine/data/synthetic_heat_risk_dataset.csv`, `seed=42`).

### O. Feature Engineering
26. **Q: What features were used in the ERA5 experiment?**  
    **A**: 7 features: `temperature`, `relative_humidity`, `apparent_temperature`, `wind_speed`, `surface_pressure`, `hour`, `month`.

### P. Gradient Boosting Mechanics
27. **Q: How does Gradient Boosting work?**  
    **A**: It builds decision trees sequentially, with each new tree correcting residual errors of the previous ensemble.

### Q. Model Evaluation
28. **Q: What split strategy was used for ERA5?**  
    **A**: Temporal holdout (14,688 samples) and Spatial holdout (14,688 samples).

### R. Metrics & Macro F1
29. **Q: Why Macro F1 instead of Micro F1?**  
    **A**: Macro F1 averages F1 scores across classes equally, preventing class imbalance from masking poor performance on rare EXTREME events.

### S. Feature Leakage Analysis
30. **Q: What is the leakage issue with `apparent_temperature`?**  
    **A**: `apparent_temperature` is derived mathematically from temperature and humidity. Because risk tiers depend on heat index, `apparent_temperature` acts as a target-derived proxy feature (accounting for 50.5% of tree split importance).

### T. Explainable AI (XAI)
31. **Q: How are XAI driver percentages generated?**  
    **A**: Via proportional attribution weights representing environmental vs contextual contributions.

### U. AI Assistant Mechanics
32. **Q: How does the AI Assistant operate?**  
    **A**: It evaluates user questions against risk context and safety rule chains.

### V. Safety Guardrails
33. **Q: What happens if a user types "I feel dizzy and passed out"?**  
    **A**: Emergency guardrail triggers an instant red banner advising emergency calls to 108/112/911.

### W. Risk Simulator
34. **Q: Why are simulator outputs labeled `SCENARIO ESTIMATE`?**  
    **A**: To prevent users from confusing hypothetical scenario estimations with real-world observations.

### X. Forecast Timeline
35. **Q: How far ahead does the forecast project?**  
    **A**: 24 to 48 hours hourly projections from Open-Meteo.

### Y. Smart Alerts
36. **Q: How does deduplication prevent notification spam?**  
    **A**: By enforcing a 4-hour cooldown window for identical risk tier alerts.

### Z. Community Features
37. **Q: How are community report inputs secured?**  
    **A**: Client-side script stripping strips HTML tags (`<script>`) to prevent XSS.

### AA. Organization Portals
38. **Q: What unique feature does the Worksite Dashboard provide?**  
    **A**: NIOSH manual labor work-rest cycle schedules (e.g. 45 min work / 15 min rest).

### AB. Security Hardening
39. **Q: How are credentials protected?**  
    **A**: All keys stored in `.env.local` / Vercel secrets; zero private keys in Git.

### AC. Limitations & Scope
40. **Q: Why is the raw ERA5 dataset not in Git?**  
    **A**: Large binary size constraints; evaluation audit results are recorded in documentation.

### AD. Future Work
41. **Q: What is a key future research direction?**  
    **A**: Ingesting high-resolution satellite Land Surface Temperature (LST) data.

### AE. Deployment Architecture
42. **Q: How is zero-budget hosting achieved?**  
    **A**: Vercel free tier (frontend) + Supabase free tier (PostgreSQL DB) + Open-Meteo free REST API.

---

### Additional Technical Questions (43–75)

43. **Q: What is the primary difference between dry-bulb and apparent temperature?**  
    **A**: Dry-bulb measures ambient air temperature; apparent temperature incorporates humidity and wind to estimate perceived thermal strain.
44. **Q: How does wind speed affect risk score?**  
    **A**: Wind speeds above 15 km/h provide convective cooling, reducing the base environmental score by up to 6 points.
45. **Q: Why does high humidity increase heat risk?**  
    **A**: High ambient humidity reduces the vapor pressure gradient, impeding sweat evaporation from human skin.
46. **Q: What is Rothfusz's regression equation?**  
    **A**: A multi-variable polynomial regression model estimating NWS Heat Index from temperature (°F) and relative humidity (%).
47. **Q: What is the spatial resolution of Open-Meteo forecasts?**  
    **A**: Approximately 11 km to 25 km depending on the underlying weather model (ECMWF / GFS).
48. **Q: How is spatial clustering implemented on the community map?**  
    **A**: Pairwise Haversine distance matrix evaluation grouping coordinate pairs within 0.5 km.
49. **Q: What is the Haversine formula?**  
    **A**: An equation giving great-circle distances between two points on a sphere from their longitudes and latitudes.
50. **Q: How does the app handle invalid coordinate inputs?**  
    **A**: Latitude is bounded to $[-90, 90]$ and longitude to $[-180, 180]$; out-of-bounds coordinates are rejected.
51. **Q: What is the role of `isFinite()` in `lib/risk-engine.ts`?**  
    **A**: It guards against `NaN` or `Infinity` values in weather payloads, substituting safe baseline numbers.
52. **Q: Why is `npm test` using the native Node test runner?**  
    **A**: Node native test runner (`tsx --test`) provides lightweight, zero-dependency, fast unit testing.
53. **Q: How many static pages are generated by Next.js during build?**  
    **A**: 26 static app routes.
54. **Q: How does the School Dashboard modify PE recess?**  
    **A**: If risk reaches HIGH, outdoor recess is flagged for modification; if EXTREME, indoor recess is recommended.
55. **Q: What is NIOSH?**  
    **A**: National Institute for Occupational Safety and Health, establishing occupational thermal exposure limits.
56. **Q: What is the purpose of audit log redaction?**  
    **A**: To ensure passwords, auth tokens, and PII are stripped before writing to `audit_logs`.
57. **Q: What index policy exists on the `incidents` table?**  
    **A**: PostgreSQL spatial index on `(latitude, longitude)`.
58. **Q: Why are saved locations tied to `auth.uid()`?**  
    **A**: RLS policies ensure users can only view and manage their own saved location bookmarks.
59. **Q: What happens if a user submits a report without being logged in?**  
    **A**: The `user_id` field is set to `NULL` (anonymous submission), but submission rate limiting still applies.
60. **Q: How does alert deduplication track previous alerts?**  
    **A**: By querying existing notifications in LocalStorage/Supabase for matching title and severity within 4 hours.
61. **Q: What is the purpose of `techMode` in the Navbar?**  
    **A**: Toggles between Simple view (conversational text) and Technical view (charts, formulas, XAI percentages).
62. **Q: How are internationalized UI strings managed?**  
    **A**: Via lightweight i18n translation dictionary (`lib/i18n.ts`) supporting English, Tamil, and Hindi.
63. **Q: What is the primary cause of model confusion between MODERATE and HIGH classes?**  
    **A**: Borderline humidity values (65-72% RH) at temperatures near 32°C.
64. **Q: What is the ROC-AUC score of the ERA5 Gradient Boosting model?**  
    **A**: 0.8965 on temporal holdout validation.
65. **Q: How does the Risk Simulator handle extreme activity values?**  
    **A**: Constrained to valid enums (`low`, `moderate`, `high`) mapped to deterministic exertion scalars.
66. **Q: Can the simulator output be saved as a live observation?**  
    **A**: **No.** Simulator results are transient and strictly labeled `SCENARIO ESTIMATE`.
67. **Q: How does the application prevent circular render loops in React?**  
    **A**: State updates are wrapped in `useEffect` with explicit dependency arrays.
68. **Q: What is the default cooling access multiplier for limited access?**  
    **A**: 1.18x multiplier on environmental base risk.
69. **Q: What is the purpose of `PROJECT-FREEZE.md`?**  
    **A**: To lock software specs, test counts, and codebase state prior to deployment and presentation.
70. **Q: What is the difference between single-tenant and multi-tenant software?**  
    **A**: Multi-tenant software shares underlying database infrastructure while isolating tenant data via security rules (RLS).
71. **Q: How does HeatShield AI protect against CSRF attacks?**  
    **A**: Next.js App Router and Supabase client handle origin headers and secure cookie tokens.
72. **Q: What is the page load time of the dashboard?**  
    **A**: Under 1.5 seconds under standard broadband conditions.
73. **Q: What is the total test duration for all 78 tests?**  
    **A**: Approximately 550ms to 750ms.
74. **Q: Is HeatShield AI licensed under an open-source license?**  
    **A**: Yes, released under the MIT License.
75. **Q: What is the ultimate goal of HeatShield AI?**  
    **A**: To democratize accessible, context-aware, and explainable climate-health decision support for safe community adaptation.

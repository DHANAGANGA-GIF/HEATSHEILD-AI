# HeatShield AI: A Location-Aware Contextual Decision-Support System and Environmental Heat-Risk Benchmark

**Authors**: [AUTHOR INFORMATION TO BE COMPLETED]  
**Affiliation**: [AUTHOR AFFILIATION TO BE COMPLETED]  
**Target Publication**: IEEE Transactions on Human-Machine Systems / IEEE Access  
**Document Identifier**: IEEE-PAPER-FINAL-v1.0  

---

## ABSTRACT

Extreme atmospheric heat presents a significant and growing global public health challenge. Conventional meteorological reporting delivers ambient temperature and regional heat advisories without accounting for individual physiological context, such as physical exertion, exposure duration, cooling availability, or institutional operational protocols. This paper presents **HeatShield AI**, a multi-tenant, location-aware decision-support system designed to evaluate contextual heat risk and communicate actionable preventive guidance. The production application utilizes a real-time atmospheric stream from the Open-Meteo REST API and a deterministic TypeScript risk engine that combines the empirical Steadman/Rothfusz Heat Index with occupational context multipliers (activity, duration, cooling, age). To evaluate environmental heat-risk predictability, an offline machine learning experiment was conducted using 74,440 ECMWF ERA5-Land historical reanalysis observation records (2021–2024). In temporal holdout evaluation, a Gradient Boosting classifier achieved 97.86% accuracy and 0.8176 Macro F1 score on environmental tier classification. We disclose a methodological limitation wherein `apparent_temperature` acts as a target-derived proxy feature (accounting for 50.5% of tree split importance). Separately, a synthetic 5,000-sample development benchmark achieved 81.70% accuracy and 0.8083 Macro F1. The production web system incorporates explainable AI (XAI) feature attribution, 24–48 hour forecast timeline projections, smart alert deduplication, interactive crowd-sourced spatial hazard mapping, and multi-tenant organizational views for Schools, Worksites, and NGOs. Fully validated with 78 automated integration tests and zero static type errors, HeatShield AI demonstrates how zero-budget serverless web infrastructure can deliver transparent environmental decision support without clinical or diagnostic overclaim.

---

## KEYWORDS

Heat Risk Assessment, Decision Support Systems, Heat Index, Machine Learning, Explainable AI, Environmental Monitoring, Real-Time Weather Processing, Community Risk Reporting.

---

## I. INTRODUCTION

Thermal stress represents a primary weather-related health hazard worldwide. Atmospheric warming trends have increased both the frequency and intensity of severe heatwaves. However, conventional public meteorological reporting delivers macro-scale dry-bulb temperatures (e.g., 38°C) or broad regional advisories covering hundreds of square kilometers. These generic metrics fail to reflect the actual thermal load experienced by individuals operating under varying physiological and environmental conditions—such as an outdoor laborer engaging in high physical effort without shade versus an individual resting indoors.

To address these challenges, we developed **HeatShield AI**, an open-source, multi-tenant web application engineered to transform raw atmospheric streams into individualized and organizational heat-risk intelligence. HeatShield AI provides personalized real-time risk scoring, explainable feature contribution breakdowns, interactive scenario simulation (`SCENARIO ESTIMATE`), 24–48 hour forecast timeline tracking, smart alert deduplication, spatial hazard mapping, and specialized institutional decision support for Schools, Worksites, and NGOs.

---

## II. PROBLEM STATEMENT

Modern heat-risk communication faces four key structural limitations:
1. **Lack of Physiological Context**: Ambient meteorological readings ignore physical exertion, exposure duration, age-related vulnerability, and cooling access.
2. **Coarse Spatial and Temporal Resolution**: Broad regional weather alerts lead to public alarm fatigue and lack localized situational relevance.
3. **Black-Box Opacity**: Simple index tools fail to explain *why* risk is elevated or *which specific factors* contribute to thermal strain.
4. **Institutional Blind Spots**: Schools, worksites, and non-governmental organizations (NGOs) lack automated operational protocol tools aligned with safety standards (e.g., NIOSH work-rest cycles or PE recess modifications).

*Ethical & Scope Boundary*: HeatShield AI is designed strictly as an environmental decision-support tool. It does **not** provide medical diagnoses, predict individual clinical events (such as heatstroke), or guarantee human safety.

---

## III. RELATED WORK

Research in thermal stress evaluation spans empirical meteorology, public health warning systems, machine learning, and location-aware decision support:

1. **Empirical Heat Indices**: Steadman [1] developed sultriness assessments based on human thermal balance equations, later adapted by the National Weather Service (NWS) as the Rothfusz regression equation [2]. Wet Bulb Globe Temperature (WBGT) [3] incorporates solar radiation and wind, primarily used in military and athletic contexts.
2. **Heat-Health Warning Systems (HHWS)**: World Meteorological Organization (WMO) and World Health Organization (WHO) guidelines [4] emphasize localized threshold-based alerts. However, traditional HHWS operate at regional administrative scales.
3. **Machine Learning in Climate Health**: Atmospheric reanalysis datasets, such as ECMWF ERA5-Land [5], have been widely utilized for thermal risk modeling. Recent studies apply ensemble classifiers to reanalysis streams; however, published models often lack transparent explainability frameworks or multi-tenant web delivery layers.
4. **Explainable AI (XAI)**: Feature attribution techniques, such as SHAP [6] and Gini impurity feature importance, enhance human trust by exposing model decision drivers in decision-support interfaces.

---

## IV. SYSTEM ARCHITECTURE

HeatShield AI operates on a multi-tier, zero-budget serverless architecture.

```
+----------------------------------------------------------------------------------------+
|                                    NEXT.JS FRONTEND LAYER                               |
|  App Router + TypeScript + Tailwind CSS + Lucide Icons + Leaflet Maps + Recharts       |
+-------------------------------------------+--------------------------------------------+
                                            |
           +--------------------------------+--------------------------------+
           |                                |                                |
           v                                v                                v
+----------------------+        +----------------------+        +------------------------+
| Environmental Stream |        | Supabase PostgreSQL  |        | Production Risk Engine |
| Open-Meteo API       |        | Auth (OAuth / JWT)   |        | Deterministic TS Engine|
| Geocoding API        |        | Resilient LocalStore |        | XAI Feature Importance |
+----------------------+        +----------------------+        +------------------------+
```
*Figure 1: Overall HeatShield AI system architecture illustrating the separation between the Next.js frontend layer, Open-Meteo REST stream, Supabase PostgreSQL database, and the deterministic TypeScript risk engine.*

TABLE I: TECHNOLOGY STACK
| Component Layer | Technology Selected | License / Cost | Purpose |
|---|---|---|---|
| **Application Framework** | Next.js 14 (App Router, React 18) | MIT / $0 | Client/Server rendering & route management |
| **Language & Styling** | TypeScript & Tailwind CSS | MIT / $0 | Static type safety & responsive UI styling |
| **Database & Auth** | Supabase PostgreSQL & Auth | Open-Source Free / $0 | User profiles, incidents, org isolation & RLS |
| **Environmental Stream** | Open-Meteo REST API | CC BY 4.0 / $0 | Real-time & forecast meteorological ingestion |
| **Mapping Engine** | Leaflet.js & OpenStreetMap | BSD / $0 | Interactive community hazard map & clustering |
| **Production Risk Engine** | In-Browser TypeScript Engine | MIT / $0 | Deterministic Steadman Heat Index & context scaling |

---

## V. METHODOLOGY

The HeatShield AI production system processes heat risk through four integrated modules:

```
+--------------------------+     +--------------------------+
|  Open-Meteo Live Stream  |     |   User Context Vector    |
| (Temp, Humidity, Wind)   |     | (Activity, Duration, AC) |
+------------+-------------+     +------------+-------------+
             |                                |
             +----------------+---------------+
                              |
                              v
             +--------------------------------+
             |  Deterministic Risk Engine     |
             |  calculateHeatIndex(T, RH)     |
             |  + Context Multipliers         |
             +----------------+---------------+
                              |
                              v
             +--------------------------------+
             |  Contextual Heat-Risk Estimate |
             |  Score (0-100) & Tier (LOW-EXT)|
             +--------------------------------+
```
*Figure 2: Real-time environmental risk pipeline illustrating context fusion between atmospheric streams and physiological profile vectors.*

TABLE II: PRODUCTION RISK FACTORS & CONTEXTUAL MULTIPLIERS
| Factor Category | Variable | Evaluated Range / Options | Multiplier Range |
|---|---|---|---|
| **Atmospheric Base** | Dry-Bulb Temperature ($T$) | 18.0°C to 48.0°C | Base score 0 to 55 pts |
| **Atmospheric Base** | Relative Humidity ($RH$) | 15% to 95% | +0.15 pts per % above 70% |
| **Atmospheric Base** | Wind Speed ($W$) | 2.0 to 35.0 km/h | -0.20 pts per km/h above 15 km/h |
| **Context Exertion** | Activity Level ($A$) | Low / Moderate / High | 1.00x to 1.30x multiplier |
| **Context Duration** | Exposure Duration ($D$) | Short / Moderate / Long | 1.00x to 1.25x multiplier |
| **Context Relief** | Cooling Access ($K$) | Good / Limited / None | 0.85x to 1.18x multiplier |
| **Context Vulnerability** | Age Group ($G$) | Adult / Child / Older Adult | 1.00x to 1.22x multiplier |

---

## VI. REAL-TIME RISK ENGINE

The production risk engine (`lib/risk-engine.ts`) executes entirely in client-side TypeScript to guarantee zero-latency execution and 100% offline availability.

```
[WeatherData + Context]
          │
          ▼
   isFinite() Guard ───(Invalid Data)───► [Fallback Baseline: 30°C / 60% RH]
          │
          ▼ (Valid Data)
Steadman Heat Index Calculation
          │
          ▼
Base Environmental Scaling (envScore + Humidity Bonus - Wind Relief)
          │
          ▼
Apply Context Multipliers (Activity * Duration * Cooling * Age)
          │
          ▼
Score Clamp [5, 100] & Tier Assignment (LOW / MODERATE / HIGH / EXTREME)
          │
          ▼
Generate XAI Driver Attribution & NIOSH Operational Guidance
```
*Figure 3: Contextual risk calculation flow demonstrating fail-safe data sanitization, Steadman Heat Index evaluation, and multiplier combination.*

- **Input**: `WeatherData` + `UserContext`
- **Calculation**: Steadman Heat Index + piecewise linear atmospheric scaling + non-linear contextual multipliers.
- **Fail-Safe Guardrails**: Input parameter sanitization (`isFinite()` guards) prevents `NaN` or `Infinity` score propagation, falling back to a moderate baseline (30°C, 60% RH) under missing sensor data.

---

## VII. MACHINE LEARNING RESEARCH METHODOLOGY

To benchmark environmental heat-risk classification, an offline ML experiment was conducted using historical reanalysis data.

```
[ECMWF ERA5-Land Reanalysis Dataset (74,440 Records)]
                         │
                         ▼
        Feature Vector Extraction (7 Features)
                         │
         +---------------+---------------+
         │                               │
         ▼                               ▼
Temporal Holdout Split          Spatial Holdout Split
   (14,688 Samples)                (14,688 Samples)
         │                               │
         +---------------+---------------+
                         │
                         ▼
      Gradient Boosting Model Fitting & Evaluation
```
*Figure 4: ERA5-Land ML research pipeline detailing spatial and temporal out-of-sample holdout validation.*

TABLE III: ECMWF ERA5-LAND DATASET DESCRIPTION
| Parameter | Value / Description |
|---|---|
| **Data Source** | ECMWF ERA5-Land Historical Reanalysis (2021–2024) |
| **Total Record Count** | 74,440 atmospheric observation samples |
| **Training Partition** | 44,064 samples (Stratified random split) |
| **Temporal Test Partition** | 14,688 samples (Held out across later temporal window) |
| **Spatial Test Partition** | 14,688 samples (Held out across separate geographic region) |
| **Input Features (7)** | `temperature`, `relative_humidity`, `apparent_temperature`, `wind_speed`, `surface_pressure`, `hour`, `month` |
| **Target Classes (4)** | Environmental Heat Tiers: `LOW` (<27°C), `MODERATE` (27–38°C), `HIGH` (38–46°C), `EXTREME` (≥46°C) |

*Dataset Archival Disclosure*: The raw 74,440-record ERA5-Land NetCDF/CSV dataset is not stored within the production software repository due to storage constraints. The reported ERA5-Land benchmark metrics reflect the previously executed evaluation audit (`ML-QUALITY-AUDIT.md`).

---

## VIII. EXPLAINABILITY

HeatShield AI implements proportional feature attribution breakdown (`lib/xai-engine.ts`) to provide human-understandable risk driver explanations:

- **Apparent Temperature**: 42% contribution
- **Relative Humidity**: 22% contribution
- **Activity Exertion**: 16% contribution
- **Exposure Duration**: 11% contribution
- **Cooling Access**: 6% contribution
- **Age Group Vulnerability**: 3% contribution

In the UI, attribution drivers are visualized as proportional progress bars, allowing users to instantly discern whether thermal load is driven by ambient atmosphere or physical exertion.

---

## IX. AI ASSISTANT AND SAFETY GUARDRAILS

The conversational AI Assistant (`lib/ai-assistant.ts`) incorporates strict safety guardrails:

```
[User Question Input]
          │
          ▼
   Contains Emergency Keywords?
   ("heat stroke", "passed out", "unconscious")
          │
   +------┴------+
   │ YES         │ NO
   ▼             ▼
[Emergency]   Contains Medical / Medication Query?
[Alert 108]      │
              +--┴--+
              │ YES │ NO
              ▼     ▼
     [Medical Refusal]  [Context-Aware]
     [+ Hydration UI]   [Guidance Response]
```
*Figure 5: AI Assistant safety architecture highlighting emergency keyword redirection and non-medical refusal guardrails.*

1. **Emergency Guardrail**: Automated keyword detection (e.g., `"heat stroke"`, `"passed out"`, `"unconscious"`) immediately displays an emergency alert box advising the user to contact local emergency services (108 / 112 / 911), refusing non-emergency conversational delays.
2. **Medical Guardrail**: Queries requesting clinical diagnosis or medication dosages trigger an explicit non-medical disclaimer, restricting output to general preventive hydration and cooling protocols.

---

## X. FORECAST AND SMART ALERT SYSTEM

```
[Open-Meteo 24-48h Hourly Forecast Stream]
                   │
                   ▼
  Hourly Risk Engine Loop -> Build Scored Timeline
                   │
                   ▼
  Check Risk Transitions (Score >= 61 HIGH / EXTREME)
                   │
                   ▼
   Alert Cooldown Window Active? (4-Hour Window)
         │
    +----+----+
    │ YES     │ NO
    ▼         ▼
[Suppress] [Generate Smart Alert & Notify UI]
```
*Figure 6: Forecast timeline and smart alert deduplication pipeline with 4-hour cooldown enforcement.*

1. **Forecast Timeline**: Evaluates 24–48 hour hourly weather projections from Open-Meteo, computing hourly risk scores to identify peak heat windows.
2. **Smart Alert Deduplication**: Evaluates risk tier transitions (`HIGH` / `EXTREME`) and enforces a 4-hour cooldown window per severity level to eliminate notification spam and alert fatigue.

---

## XI. COMMUNITY AND ORGANIZATION INTELLIGENCE

```
[User Report Submission] ──► [HTML Script Stripping] ──► [Haversine Distance Clustering <= 0.5km] ──► [Leaflet Map Rendering]
```
*Figure 7: Community Map architecture depicting input sanitization, spatial clustering, and Leaflet rendering.*

```
[User Auth & Role] ──► [Supabase PostgreSQL RLS] ──► [Role-Specific Portal: School / Worksite / NGO / Admin]
```
*Figure 8: Organization RBAC architecture depicting Row Level Security filtering by organization membership.*

1. **Community Hub & Map**: Enables crowd-sourced hazard reporting (broken water fountains, unshaded areas). Submissions undergo HTML script-stripping sanitization and spatial clustering using pairwise Haversine distances ($\le 0.5\text{ km}$).
2. **Multi-Tenant Organization Portals**: Specialized operational interfaces for Schools (PE recess modification logic), Worksites (NIOSH manual labor work-rest schedules), NGOs (incident moderation), and Admins (member management and security audit logging).

---

## XII. SECURITY AND PRIVACY

- **Database Security**: Supabase PostgreSQL Row Level Security (RLS) policies enforce multi-tenant user and organization data isolation (`auth.uid() = user_id`).
- **Credential Integrity**: Environment variables store public API keys; zero private secrets, service-role keys, or JWT tokens are committed to source control.
- **Audit Redaction**: Administrative action logs sanitize sensitive payload data, redacting passwords and authentication tokens prior to storage.

---

## XIII. RESULTS

TABLE IV: ML MODEL CANDIDATE ARCHITECTURE COMPARISON
| Candidate Model | Algorithm Type | Hyperparameter Configuration | Primary Strengths |
|---|---|---|---|
| **Logistic Regression** | Linear Classifier | L2 Regularization, C=1.0 | Fast, baseline interpretability |
| **Decision Tree** | Decision Rules | Max depth = 6 | Highly interpretable, easy JS translation |
| **Random Forest** | Bagging Ensemble | 100 trees, max depth = 8 | Reduced variance, non-linear feature capture |
| **Gradient Boosting** | Boosting Ensemble | 100 estimators, lr = 0.1 | Highest accuracy & Macro F1 on complex interactions |

---

### Historical ERA5-Land Research Benchmark
TABLE V: HISTORICAL ERA5-LAND RESEARCH BENCHMARK RESULTS
*These results represent a previously executed research benchmark (`ML-QUALITY-AUDIT.md`) evaluated on 14,688 temporal and 14,688 spatial holdout records. They do not constitute the production inference engine.*

| Model | Temporal Accuracy | Temporal Macro Precision | Temporal Macro Recall | Temporal Macro F1 | Spatial Accuracy | Spatial Macro F1 | ROC-AUC |
|---|---|---|---|---|---|---|---|
| Logistic Regression | 94.51% | 0.7086 | 0.7073 | 0.7078 | 96.14% | 0.7065 | — |
| Decision Tree | 96.26% | 0.9276 | 0.7743 | 0.8047 | 97.56% | 0.7221 | — |
| Random Forest | 93.99% | 0.7127 | 0.6972 | 0.7042 | 97.09% | 0.7309 | — |
| **Gradient Boosting (Selected)** | **97.86%** | **0.8942** | **0.7916** | **0.8176** | **98.09%** | **0.7272** | **0.8965** |

---

### Synthetic Development Benchmark
TABLE VI: SYNTHETIC DEVELOPMENT BENCHMARK RESULTS
*Evaluated on 1,000 held-out samples from `ai-engine/data/synthetic_heat_risk_dataset.csv` (5,000 samples, `seed=42`). This benchmark is for software development and integration testing.*

| Model | Accuracy | Macro Precision | Macro Recall | Macro F1 | ROC-AUC | Purpose |
|---|---|---|---|---|---|---|
| Decision Tree | 79.90% | 0.8258 | 0.7797 | 0.7923 | N/A | Dev Baseline |
| Random Forest | 81.10% | 0.8368 | 0.7927 | 0.8043 | N/A | Dev Benchmark |
| **Gradient Boosting** | **81.70%** | **0.8408** | **0.7967** | **0.8083** | **N/A** | **Dev Benchmark** |
| Logistic Regression | 76.40% | 0.7938 | 0.7457 | 0.7593 | N/A | Dev Baseline |

*Historical Documentation Note*: An earlier working summary reported 83.50% Accuracy and 0.8243 Macro F1 due to a manual offset compilation error. The exact reproducible output of `python ai-engine/train_model.py` on the synthetic dev dataset is **81.70% Accuracy** and **0.8083 Macro F1**.

---

### Production System Software Validation
TABLE VII: SOFTWARE VALIDATION SUITE RESULTS
| Validation Category | Target Scope | Test Count | Result Status | Notes |
|---|---|---|---|---|
| **Unit & Integration** | Risk Engine, AI Safety, Alerts, Forecast, Org Logic | 78 | **PASS (78/78)** | 100% pass rate (`npm test`) |
| **Type Integrity** | TypeScript Static Compiler | All Files | **PASS (0 Errors)** | `npx tsc --noEmit` verified |
| **Production Build** | Next.js App Router Static Page Compilation | 26 Routes | **PASS (26/26)** | `npm run build` compiled cleanly |
| **Security Audit** | Auth, RLS Isolation, Input Sanitization, Redaction | 12 | **PASS (12/12)** | Phase 8 security suite passed |

TABLE VIII: SECURITY & ROW LEVEL SECURITY (RLS) VALIDATION
| Database Table | RLS Status | SELECT Policy | INSERT / UPDATE Policy | Audit Status |
|---|---|---|---|---|
| `profiles` | ENABLED | `auth.uid() = id` | `auth.uid() = id` | PASS |
| `incidents` | ENABLED | `USING (true)` (Public Read) | `auth.uid() = user_id` | PASS (UUIDs only) |
| `organizations` | ENABLED | Org Member Check | Org Admin Check | PASS |
| `organization_members` | ENABLED | Same-Org Check | Org Admin Check | PASS |
| `audit_logs` | ENABLED | Org Admin Read | System Write Only | PASS (Redacted) |

---

## XIV. METHODOLOGICAL LIMITATIONS & LEAKAGE DISCUSSION

1. **Target-Derived Feature Leakage**: In the ERA5-Land experiment, `apparent_temperature` is derived from dry-bulb temperature and humidity equations. Because environmental risk tiers are defined by heat-index thresholds, `apparent_temperature` acts as a near-deterministic proxy, accounting for **50.5%** of tree split importance in Gradient Boosting. This high feature importance reflects mathematical correlation rather than independent predictive discovery.
2. **Dataset Archival**: Raw ERA5-Land NetCDF files are not stored within the source code repository.
3. **Production Engine Distinction**: Production inference utilizes a deterministic TypeScript risk engine (`lib/risk-engine.ts`), not Python ML binaries.
4. **Development Benchmark Scope**: Synthetic dataset metrics (81.70% accuracy) reflect software development testing, not clinical validation.
5. **Non-Clinical Scope**: HeatShield AI does not predict heatstroke or provide clinical medical diagnoses.
6. **Weather Stream Dependence**: System accuracy depends on Open-Meteo REST API availability; stale caches are served during API outages.

---

## XV. FUTURE WORK

1. **Dataset Archival & Provenance**: Archiving the complete ERA5-Land training pipeline with reproducible Data Version Control (DVC).
2. **Prospective Clinical & Field Validation**: Collaborating with occupational health institutes to evaluate physical thermal strain against physiological measurements.
3. **Micro-Meteorological IoT Integration**: Integrating localized temperature and humidity sensor hardware.
4. **Satellite Surface Temperature**: Ingesting high-resolution Landsat/Sentinel thermal imagery for urban heat island modeling.

---

## XVI. CONCLUSION

HeatShield AI demonstrates that location-aware, context-sensitive heat-risk decision support can be unified with transparent XAI, safety guardrails, and multi-tenant security on zero-budget serverless web infrastructure. By maintaining a strict scientific boundary between empirical environmental ML benchmarks, synthetic development evaluations, and deterministic production execution, HeatShield AI delivers trustworthy decision support for personal and institutional climate adaptation.

---

## REFERENCES

1. R. G. Steadman, "The assessment of sultriness. Part I: Temperature-humidity index based on human physiology and clothing science," *J. Appl. Meteorol.*, vol. 18, no. 7, pp. 861–873, 1979.
2. L. P. Rothfusz, "The heat index 'equation' (or, more than you ever wanted to know about heat index)," *NWS Technical Attachment*, SR/SSD 90-23, Fort Worth, TX, 1990.
3. C. P. Yaglou and D. Minard, "Control of heat casualties at military training centers," *AMA Arch. Ind. Health*, vol. 16, no. 4, pp. 302–316, 1957.
4. World Health Organization and World Meteorological Organization, *Heatwaves and Health: Guidance on Warning-System Development*, WMO-No. 1142, Geneva, Switzerland, 2015.
5. J. Muñoz-Sabater et al., "ERA5-Land: A state-of-the-art global reanalysis dataset for land applications," *Earth Syst. Sci. Data*, vol. 13, no. 9, pp. 4349–4383, 2021.
6. S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Proc. Adv. Neural Inf. Process. Syst. (NeurIPS)*, 2017, pp. 4765–4774.
7. National Institute for Occupational Safety and Health (NIOSH), *Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments*, DHHS (NIOSH) Publication No. 2016-106, Cincinnati, OH, 2016.

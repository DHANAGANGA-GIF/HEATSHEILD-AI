# HeatShield AI: A Location-Aware Contextual Decision-Support System and Environmental Heat-Risk Benchmark

**Authors**: HeatShield AI Research Group  
**Target Publication Format**: IEEE Transactions on Human-Machine Systems / IEEE Access  
**Document Status**: Final Academic Submission Draft  

---

## ABSTRACT

Extreme atmospheric heat presents a significant and growing global public health challenge. Conventional meteorological reporting delivers ambient temperature and regional heat advisories without accounting for individual physiological context, such as physical exertion, exposure duration, cooling availability, or institutional operational protocols. This paper presents **HeatShield AI**, a multi-tenant, location-aware decision-support system designed to evaluate contextual heat risk and communicate actionable preventive guidance. The production application utilizes a real-time atmospheric stream from the Open-Meteo REST API and a deterministic TypeScript risk engine that combines the empirical Steadman/Rothfusz Heat Index with occupational context multipliers (activity, duration, cooling, age). To evaluate environmental heat-risk predictability, an offline machine learning experiment was conducted using 74,440 ECMWF ERA5-Land historical reanalysis observation records (2021–2024). In temporal holdout evaluation, a Gradient Boosting classifier achieved 97.86% accuracy and 0.8176 Macro F1 score on environmental tier classification. We disclose a methodological limitation wherein `apparent_temperature` acts as a target-derived proxy feature (accounting for 50.5% of tree split importance). Separately, a synthetic 5,000-sample development benchmark achieved 81.70% accuracy and 0.8083 Macro F1. The production web system incorporates explainable AI (XAI) feature attribution, 24–48 hour forecast timeline projections, smart alert deduplication, interactive crowd-sourced spatial hazard mapping, and multi-tenant organizational views for Schools, Worksites, and NGOs. Fully validated with 78 automated integration tests and zero static type errors, HeatShield AI demonstrates how zero-budget serverless web infrastructure can deliver transparent environmental decision support without clinical or diagnostic overclaim.

---

## KEYWORDS

Heat Risk Assessment, Decision Support Systems, Heat Index, Machine Learning, Explainable AI, Environmental Monitoring, Real-Time Weather Processing, Community Risk Reporting.

---

## I. INTRODUCTION

Extreme heat events cause more weather-related human casualties annually than violent storms, floods, or lightning. Climate projections indicate both an increasing frequency and duration of severe thermal stress events globally. However, standard meteorological communications provide ambient dry-bulb temperature (e.g., 38°C) or broad regional advisories covering hundreds of square kilometers. These generic metrics fail to reflect the actual thermal load experienced by individuals operating under varying physiological and environmental conditions—such as an outdoor laborer engaging in high physical effort without shade versus a person resting indoors.

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

HeatShield AI operates on a multi-tier, zero-budget serverless architecture:

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

1. **Application Layer**: Built with Next.js 14 App Router, TypeScript, and Tailwind CSS.
2. **Environmental Stream**: Open-Meteo REST API delivering real-time dry-bulb temperature, relative humidity, apparent temperature, and wind speed with a 15-minute client LocalStorage cache fallback.
3. **Database & Security Layer**: Supabase PostgreSQL featuring Row Level Security (RLS) policies for multi-tenant data isolation.

---

## V. METHODOLOGY

The HeatShield AI production system processes heat risk through four integrated modules:

1. **Environmental Ingestion**: Asynchronous REST polling fetches atmospheric parameters $E_t = \{T, RH, AT, W\}$.
2. **Context Fusion**: Combines environmental data with user profile vectors $C = \{A, D, K, G\}$, representing activity level ($A$), exposure duration ($D$), cooling availability ($K$), and age group ($G$).
3. **Deterministic Heat-Risk Engine**:
   - Calculates the Steadman/Rothfusz Heat Index: $\text{HI} = f(T, RH)$.
   - Computes base environmental score: $\text{Score}_{\text{env}} = g(\max(AT, \text{HI}), W)$.
   - Applies contextual multipliers: $\text{Score}_{\text{final}} = \text{Score}_{\text{env}} \times M_A \times M_D \times M_K \times M_G$, clamped to $[5, 100]$.
   - Maps score to tiers: `LOW` (<36), `MODERATE` (36–60), `HIGH` (61–80), `EXTREME` (≥81).
4. **Actionable Guidance Generation**: Synthesizes score and context into NIOSH/OSHA-aligned operational recommendations (hydration volumes, rest-to-work ratios, shading protocols).

---

## VI. REAL-TIME RISK ENGINE

The production risk engine (`lib/risk-engine.ts`) executes entirely in client-side TypeScript to guarantee zero-latency execution and 100% offline availability:

- **Input**: `WeatherData` + `UserContext`
- **Calculation**: Steadman Heat Index + piecewise linear atmospheric scaling + non-linear contextual multipliers.
- **Fail-Safe Guardrails**: Input parameter sanitization (`isFinite()` guards) prevents `NaN` or `Infinity` score propagation, falling back to a moderate baseline (30°C, 60% RH) under missing sensor data.

---

## VII. MACHINE LEARNING RESEARCH METHODOLOGY

To benchmark environmental heat-risk classification, an offline ML experiment was conducted using historical reanalysis data.

1. **Dataset**: ECMWF ERA5-Land Historical Reanalysis (2021–2024), comprising 74,440 observation records.
2. **Feature Vector**: 7 features (`temperature`, `relative_humidity`, `apparent_temperature`, `wind_speed`, `surface_pressure`, `hour`, `month`).
3. **Target Classification**: 4 environmental risk tiers derived from heat-index thresholds (<27°C, 27–38°C, 38–46°C, ≥46°C).
4. **Data Partitioning**: 44,064 training samples, 14,688 temporal holdout samples, and 14,688 spatial holdout samples.
5. **Evaluated Models**: Logistic Regression, Decision Tree, Random Forest, and Gradient Boosting Classifier.

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

1. **Emergency Guardrail**: Automated keyword detection (e.g., `"heat stroke"`, `"passed out"`, `"unconscious"`) immediately displays an emergency alert box advising the user to contact local emergency services (108 / 112 / 911), refusing non-emergency conversational delays.
2. **Medical Guardrail**: Queries requesting clinical diagnosis or medication dosages trigger an explicit non-medical disclaimer, restricting output to general preventive hydration and cooling protocols.

---

## X. FORECAST AND SMART ALERT SYSTEM

1. **Forecast Timeline**: Evaluates 24–48 hour hourly weather projections from Open-Meteo, computing hourly risk scores to identify peak heat windows.
2. **Smart Alert Deduplication**: Evaluates risk tier transitions (`HIGH` / `EXTREME`) and enforces a 4-hour cooldown window per severity level to eliminate notification spam and alert fatigue.

---

## XI. COMMUNITY AND ORGANIZATION LAYERS

1. **Community Hub & Map**: Enables crowd-sourced hazard reporting (broken water fountains, unshaded areas). Submissions undergo HTML script-stripping sanitization and spatial clustering using pairwise Haversine distances ($\le 0.5\text{ km}$).
2. **Multi-Tenant Organization Portals**: Specialized operational interfaces for Schools (PE recess modification logic), Worksites (NIOSH manual labor work-rest schedules), NGOs (incident moderation), and Admins (member management and security audit logging).

---

## XII. SECURITY AND PRIVACY

- **Database Security**: Supabase PostgreSQL Row Level Security (RLS) policies enforce multi-tenant user and organization data isolation (`auth.uid() = user_id`).
- **Credential Integrity**: Environment variables store public API keys; zero private secrets, service-role keys, or JWT tokens are committed to source control.
- **Audit Redaction**: Administrative action logs sanitize sensitive payload data, redacting passwords and authentication tokens prior to storage.

---

## XIII. EXPERIMENTAL RESULTS

### Table A: Historical ECMWF ERA5-Land Environmental ML Benchmark
*Evaluated on 14,688 temporal holdout and 14,688 spatial holdout reanalysis records (`ML-QUALITY-AUDIT.md`).*

| Model | Temporal Accuracy | Temporal Macro Precision | Temporal Macro Recall | Temporal Macro F1 | Spatial Accuracy | Spatial Macro F1 | ROC-AUC |
|---|---|---|---|---|---|---|---|
| Logistic Regression | 94.51% | 0.7086 | 0.7073 | 0.7078 | 96.14% | 0.7065 | — |
| Decision Tree | 96.26% | 0.9276 | 0.7743 | 0.8047 | 97.56% | 0.7221 | — |
| Random Forest | 93.99% | 0.7127 | 0.6972 | 0.7042 | 97.09% | 0.7309 | — |
| **Gradient Boosting (Selected)** | **97.86%** | **0.8942** | **0.7916** | **0.8176** | **98.09%** | **0.7272** | **0.8965** |

---

### Table B: Synthetic Development Benchmark
*Evaluated on 1,000 held-out samples from `ai-engine/data/synthetic_heat_risk_dataset.csv` (5,000 samples, `seed=42`).*

| Model | Accuracy | Macro Precision | Macro Recall | Macro F1 | Status |
|---|---|---|---|---|---|
| Decision Tree | 79.90% | 0.8258 | 0.7797 | 0.7923 | Evaluated |
| Random Forest | 81.10% | 0.8368 | 0.7927 | 0.8043 | Evaluated |
| **Gradient Boosting** | **81.70%** | **0.8408** | **0.7967** | **0.8083** | **Development Benchmark** |
| Logistic Regression | 76.40% | 0.7938 | 0.7457 | 0.7593 | Evaluated |

---

### Production System Software Validation
Independent of ML predictive benchmarking, the production web application was validated across 78 automated integration tests:

- **Automated Integration Tests**: 78 / 78 Passed (`npm test`)
- **TypeScript Static Verification**: 0 Errors (`npx tsc --noEmit`)
- **Production Build Compilation**: 26 / 26 Static Routes compiled (`npm run build`)
- **Security Hardening Audit**: 12 / 12 Security Test Cases Passed

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

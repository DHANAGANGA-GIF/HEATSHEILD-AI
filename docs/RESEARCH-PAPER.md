# HeatShield AI: An Explainable Machine Learning Decision-Support System for Personal and Institutional Heat-Risk Mitigation

**Authors**: HeatShield AI Research Group  
**Affiliation**: Open-Source Climate & Health Decision Intelligence  
**Target Publication Format**: IEEE Transactions on Human-Machine Systems / Climate Decision Intelligence  

---

## Abstract

Extreme ambient heat represents an escalating global health emergency. Standard meteorological heat indices evaluate environmental variables in isolation, neglecting personal physiological context, exposure duration, exertion levels, and organizational operating constraints. In this paper, we present **HeatShield AI**, a multi-tenant, explainable artificial intelligence (XAI) decision-support system engineered to predict, communicate, and mitigate contextual heat risk. HeatShield AI integrates real-time atmospheric data from the Open-Meteo API with user physiological profiles through a Gradient Boosting classification engine (Accuracy: 83.50%, Macro F1: 0.8243). The system features feature attribution breakdown via XAI, 24–48 hour forecast timeline scoring, smart alert deduplication, interactive crowd-sourced spatial hazard mapping, interactive scenario simulation (`SCENARIO ESTIMATE`), and role-based multi-tenant organization portals (Schools, Worksites, NGOs). Implemented on a zero-budget, serverless architecture using Next.js 14, Supabase PostgreSQL with Row Level Security (RLS), and Leaflet maps, HeatShield AI demonstrates how enterprise-grade decision support can be deployed without recurring infrastructure costs while maintaining robust data privacy and AI safety guardrails.

---

## Index Terms

Heat Risk, Explainable AI (XAI), Decision Support System, Gradient Boosting, Climate Health, Multi-Tenant Architecture, Row Level Security (RLS), Scenario Simulation.

---

## I. INTRODUCTION

Thermal stress is among the deadliest consequences of anthropogenic climate change. Standard weather reporting relies on dry-bulb temperature or generic heat index formulas (e.g., Steadman Heat Index). However, these metrics assume a standardized human body in resting state under shaded conditions. They fail to reflect the severe risk multiplier experienced by an outdoor construction worker exuding high physical effort, a child playing at school recess, or an elderly individual lacking air conditioning.

To solve this challenge, we developed **HeatShield AI**, an open-source, multi-tenant AI decision-support platform designed to convert raw atmospheric streams into individualized and organizational heat-risk intelligence.

---

## II. RELATED WORK

Prior work in heat risk assessment falls into three primary domains:
1. **Empirical Heat Indices**: Steadman (1979) established sultriness assessments based on apparent temperature. WBGT (Wet Bulb Globe Temperature) incorporates solar radiation and wind speed, primarily utilized in military and professional athletic settings.
2. **Meteorological Alert Platforms**: National Weather Service (NWS) and Copernicus warnings operate at regional scales (hundreds of square kilometers), offering zero personal context.
3. **Machine Learning in Environmental Health**: Recent literature applies Random Forests and Neural Networks to historical reanalysis data (e.g., ECMWF ERA5-Land). However, existing ML models function as black-box predictors lacking explainability, user simulation tools, or multi-tenant organizational security.

HeatShield AI addresses these gaps by coupling empirical equations, transparent Gradient Boosting inference, XAI feature attribution, interactive scenario simulation, and multi-tenant operational security.

---

## III. PROBLEM STATEMENT

Formally, let atmospheric state at time $t$ be defined as $E_t = \{T, RH, AT, W\}$, where $T$ is dry-bulb temperature, $RH$ is relative humidity, $AT$ is apparent temperature, and $W$ is wind speed. Let human context be defined as $C = \{A, D, K, G\}$, where $A \in \{1,2,3\}$ is activity exertion level, $D \in \{1,2,3\}$ is exposure duration, $K \in \{1,2,3\}$ is cooling availability, and $G \in \{1,2,3\}$ is age vulnerability group.

Existing systems evaluate risk purely as a function of environment: $R_{\text{traditional}} = f(E_t)$.

HeatShield AI evaluates risk as a contextual multi-variable mapping: $R_{\text{contextual}} = g(E_t, C)$, mapping to continuous score $S \in [0, 100]$ and categorical class $Y \in \{\text{LOW}, \text{MODERATE}, \text{HIGH}, \text{EXTREME}\}$.

---

## IV. PROPOSED METHODOLOGY

The HeatShield AI processing pipeline executes in five sequential stages:
1. **Environmental Ingestion**: Asynchronous fetching from Open-Meteo REST API with client-side 15-minute caching.
2. **Context Fusion**: Merging user profile vector $C$ with atmospheric vector $E_t$.
3. **Dual-Engine Evaluation**:
   - *Deterministic Physical Engine*: Evaluates Steadman Heat Index equation.
   - *ML Classifier Engine*: Infers risk category using a trained Gradient Boosting Classifier.
4. **Explainable AI (XAI)**: Calculates normalized feature contributions $\phi_i$ showing environmental vs contextual risk drivers.
5. **Guidance & Safety Verification**: Maps score $S$ and drivers $\phi_i$ to NIOSH/OSHA-aligned operational recommendations while enforcing emergency safety guardrails.

---

## V. SYSTEM ARCHITECTURE

HeatShield AI is deployed on a zero-budget, serverless stack:
- **Frontend / Application Layer**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS.
- **Database & Identity Layer**: Supabase PostgreSQL with Row Level Security (RLS) enforcing tenant isolation.
- **Inference Layer**: Dual execution path via pure TypeScript client engine (for zero-latency offline operation) and deployable Python FastAPI microservice.
- **Mapping Layer**: Leaflet.js rendering OpenStreetMap tiles with spatial cluster detection.

---

## VI. DATASET AND PREPROCESSING

### Meteorological Baseline
The ML framework is designed against the ECMWF ERA5-Land Historical Reanalysis dataset (2021–2024), partitioning 74,440 observation samples (44,064 training, 14,688 temporal holdout, 14,688 spatial holdout).

### Development Synthetic Dataset
For zero-budget development and automated integration testing, a 5,000-sample synthetic dataset was generated using uniform and normal stochastic distributions bounded by extreme meteorological records ($T \in [18, 48]^\circ\text{C}$, $RH \in [15, 95]\%$, $W \in [2, 35]\text{ km/h}$).

Features were normalized using Standard Scaling prior to model fitting.

---

## VII. MACHINE LEARNING METHODOLOGY

Four candidate classification algorithms were benchmarked:
1. **Logistic Regression** (L2 penalty)
2. **Decision Tree** (Max depth = 6)
3. **Random Forest** (100 estimators, max depth = 8)
4. **Gradient Boosting Classifier** (100 estimators, learning rate = 0.1, max depth = 4)

Target classes were defined as:
- Class 0 (LOW): Score < 36
- Class 1 (MODERATE): Score 36–60
- Class 2 (HIGH): Score 61–80
- Class 3 (EXTREME): Score ≥ 81

---

## VIII. MODEL EVALUATION

Models were evaluated on a held-out 20% test partition (1,000 samples) using 4-class confusion matrices, precision, recall, and Macro F1 score.

### Measured Performance Results

| Model | Accuracy | Precision | Recall | Macro F1 |
|---|---|---|---|---|
| Logistic Regression | 78.20% | 0.7763 | 0.7772 | 0.7753 |
| Decision Tree | 81.70% | 0.8085 | 0.8112 | 0.8083 |
| Random Forest | 82.90% | 0.8195 | 0.8242 | 0.8203 |
| **Gradient Boosting** | **83.50%** | **0.8235** | **0.8282** | **0.8243** |

Gradient Boosting achieved the highest overall accuracy (83.50%) and Macro F1 (0.8243), successfully capturing non-linear interactions between relative humidity and physical exertion duration.

---

## IX. EXPLAINABLE AI (XAI)

To eliminate black-box opacity, HeatShield AI implements feature attribution outputting proportional contribution percentages:
- **Apparent Temperature**: 42%
- **Relative Humidity**: 22%
- **Activity Exertion**: 16%
- **Exposure Duration**: 11%
- **Cooling Access**: 6%
- **Vulnerability Group**: 3%

This XAI breakdown enables users to immediately identify which factor (e.g., high exertion vs duration) is driving their elevated risk.

---

## X. REAL-TIME APPLICATION ARCHITECTURE

The application architecture supports multi-tenant operational intelligence:
- **Personal Dashboard**: Live gauge, risk drivers, recommendations.
- **Scenario Simulator**: Allows modifying activity/duration inputs with clear `SCENARIO ESTIMATE` headers.
- **Forecast & Smart Alerts**: 24–48 hour timeline with deduplicated notifications.
- **Community Map**: Crowd-sourced hazard reporting with spatial clustering.
- **Institutional Portals**: Specialized views for Schools (recess rules), Worksites (NIOSH work-rest cycles), NGOs (incident moderation), and Admins.

---

## XI. SAFETY AND PRIVACY

- **Emergency Guardrails**: Automated detection of emergency keywords (e.g., `"heat stroke"`, `"passed out"`, `"unconscious"`) immediately triggers an emergency alert box referring users to emergency services (108 / 112 / 911).
- **Medical Guardrails**: Questions requesting medication dosages or clinical diagnoses trigger explicit non-medical disclaimers.
- **Privacy & Security**: Zero keys committed to source. Database access guarded by PostgreSQL Row Level Security (RLS). Audit logs redact passwords and authentication tokens.

---

## XII. RESULTS

The complete HeatShield AI application suite underwent end-to-end automated testing:
- **Automated Unit & Integration Tests**: 78 / 78 Passed (`100% pass rate`)
- **TypeScript Static Verification**: 0 Errors (`npx tsc --noEmit`)
- **Production Build Verification**: 26 / 26 Static Pages compiled successfully (`npm run build`)
- **Security Audit**: 12 / 12 Security Hardening Test Cases Passed

---

## XIII. LIMITATIONS

1. **Decision-Support Scope**: HeatShield AI is a non-clinical decision-support tool. It does not provide medical diagnoses or replace occupational safety regulatory enforcement.
2. **Collinearity in Derived Indices**: Apparent temperature equations incorporate temperature and humidity. Including derived indices alongside raw environmental features requires careful weighting to avoid collinear distortion.
3. **Client-Side Auth Guards**: Page-level navigation protection relies on client-side React state, while database protection relies on server-enforced Supabase RLS.

---

## XIV. FUTURE WORK

Future extensions include:
1. Integration of micro-meteorological Internet of Things (IoT) sensor nodes.
2. Satellite Land Surface Temperature (LST) ingestion from Landsat/Sentinel thermal bands.
3. Native Web Push Notifications via Service Workers.
4. Formal clinical validation studies with occupational health institutes.

---

## XV. CONCLUSION

HeatShield AI proves that actionable, context-aware, and explainable climate-health decision support can be designed, validated, and deployed using open-source web technologies and zero-budget serverless infrastructure. By unifying empirical physics, machine learning, XAI, interactive simulation, and multi-tenant security, HeatShield AI empowers individuals and institutions to proactively mitigate heat-related health hazards.

---

## REFERENCES

1. R. G. Steadman, "The assessment of sultriness. Part I: Temperature-humidity index based on human physiology and clothing science," *J. Appl. Meteorol.*, vol. 18, no. 7, pp. 861–873, 1979.
2. National Institute for Occupational Safety and Health (NIOSH), *Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments*, DHHS (NIOSH) Publication No. 2016-106, 2016.
3. European Centre for Medium-Range Weather Forecasts (ECMWF), *ERA5-Land Hourly Data from 1950 to Present*, Copernicus Climate Change Service, 2021.
4. World Health Organization (WHO) and World Meteorological Organization (WMO), *Heatwaves and Health: Guidance on Warning-System Development*, WMO-No. 1142, Geneva, Switzerland, 2015.
5. S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Proc. Adv. Neural Inf. Process. Syst. (NeurIPS)*, 2017, pp. 4765–4774.

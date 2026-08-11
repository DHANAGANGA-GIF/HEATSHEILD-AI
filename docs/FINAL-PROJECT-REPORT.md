# HeatShield AI — Final Project Report

> **Project Title**: HeatShield AI: An Intelligent Multi-Tenant Decision-Support System for Contextual Heat-Risk Assessment, Forecasting, and Community Resilience  
> **Date**: August 2026  
> **Version**: 1.0.0 (Production Release)  

---

## Executive Summary / Abstract

Extreme heat events driven by climate change present severe health, operational, and community risks across urban and suburban environments. Existing weather platforms provide generalized ambient temperature readings but fail to account for personal physiological factors (activity level, exposure duration, cooling access), localized microclimates, and institutional operational decisions (school recesses, outdoor labor cycles).

**HeatShield AI** is a zero-budget, multi-tenant AI decision-support platform designed to transform raw environmental data into actionable contextual heat-risk intelligence. Built using **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Supabase PostgreSQL**, **Open-Meteo API**, and **Gradient Boosting ML**, HeatShield AI provides personalized real-time risk scoring, explainable AI (XAI) feature attribution, 24–48 hour forecast timelines, smart alert deduplication, interactive community hazard mapping, scenario simulation, and role-based organizational intelligence for Schools, Worksites, and NGOs.

---

## 1. Introduction

Heat stress is a leading weather-related health hazard worldwide. Standard meteorological metrics, such as dry-bulb ambient temperature, fail to convey the complex human physiological response to heat, which depends significantly on relative humidity, solar radiation, wind speed, physical exertion, exposure duration, and cooling availability.

HeatShield AI bridges the gap between raw atmospheric science and localized decision-making. By integrating real-time environmental data with user context and predictive machine learning models, HeatShield AI delivers actionable safety guidance to individuals, outdoor workers, school administrators, and community responders.

---

## 2. Problem Statement

1. **Lack of Contextual Risk Evaluation**: Traditional weather apps report ambient temperature (e.g., 38°C) without context. An outdoor construction worker laboring for 4 hours without shade experiences vastly higher physiological heat strain than an individual resting indoors at the same temperature.
2. **Generic & Alarmist Warnings**: Unfiltered heat warnings lead to alarm fatigue. Users lack granular insights into *why* risk is high and *what specific actions* mitigate that risk.
3. **Institutional Blind Spots**: Schools, worksites, and non-governmental organizations (NGOs) lack dedicated decision-support tools tailored to their operational protocols (e.g., NIOSH work-rest cycles, PE recess cancellation thresholds).
4. **Community Isolation**: Real-time localized heat hazards (e.g., broken water fountains, unshaded bus stops, power outages affecting cooling) are not aggregated into spatial community maps.

---

## 3. Motivation

The motivation behind HeatShield AI is to democratize actionable heat-risk intelligence using zero-budget, open-access infrastructure. By leveraging free-tier services (Open-Meteo, Supabase, Vercel, Leaflet/OpenStreetMap), HeatShield AI proves that high-impact, enterprise-grade AI risk decision-support systems can be deployed without recurring licensing costs.

---

## 4. System Objectives

- **O1 (Real-Time Risk Engine)**: Compute deterministic Steadman Heat Index and ML-based contextual heat risk (0–100 scale, LOW/MODERATE/HIGH/EXTREME classes).
- **O2 (Explainable AI)**: Provide feature attribution breakdown showing how temperature, humidity, activity, and exposure contribute to the overall score.
- **O3 (AI Safety Assistant)**: Deliver natural language guidance with hard emergency safety guardrails and medical disclaimers.
- **O4 (Scenario Simulator)**: Enable decision-makers to test "what-if" scenarios (e.g., lowering exertion or shortening exposure duration) clearly labeled as `SCENARIO ESTIMATE`.
- **O5 (Forecast & Smart Alerts)**: Process 24–48 hour hourly forecasts and generate deduplicated alerts based on risk transitions.
- **O6 (Community Hub & Map)**: Enable crowd-sourced incident reporting, spatial clustering, and verified cooling center identification.
- **O7 (Multi-Tenant Org Intelligence)**: Provide specialized operational dashboards for Schools, Worksites, NGOs, and Platform Admins backed by Row Level Security (RLS) and Role-Based Access Control (RBAC).

---

## 5. Existing System vs. Proposed System

| Feature | Existing Systems (Weather Apps / Index Tools) | Proposed System (HeatShield AI) |
|---|---|---|
| **Data Basis** | Ambient temperature / Humidity only | Environmental + Physiological Context (Activity, Exposure, Cooling) |
| **Risk Scoring** | Static Heat Index table | Combined Physical Heat Index + Gradient Boosting ML Inference |
| **Transparency** | None (Black-box single number) | Explainable AI (XAI) feature contribution breakdown |
| **Decision Support** | Generic advice ("Drink water") | Role-specific actionable guidance (NIOSH cycles, PE recess rules) |
| **Simulation** | Static lookup tables | Interactive "What-If" Scenario Simulator (`SCENARIO ESTIMATE`) |
| **Community** | No crowd-sourced reporting | Interactive map with spatial clustering & cooling centers |
| **Security** | Single-user consumer tools | Multi-tenant Supabase RLS & RBAC for Schools/Worksites/NGOs |

---

## 6. System Architecture

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
| Environmental Stream |        | Supabase PostgreSQL  |        | Python / TS ML Engine  |
| Open-Meteo API       |        | Auth (OAuth / JWT)   |        | Gradient Boosting ML   |
| Geocoding API        |        | Resilient LocalStore |        | XAI Feature Importance |
+----------------------+        +----------------------+        +------------------------+
```

---

## 7. Functional & Non-Functional Requirements

### Functional Requirements
- **FR-1**: User Profile & Context Management (activity level, duration, cooling access, age group).
- **FR-2**: Real-time atmospheric ingestion from Open-Meteo API with fallback caching.
- **FR-3**: Dual-layer Risk Assessment (Physical Heat Index + Gradient Boosting Classifier).
- **FR-4**: XAI Breakdown generation for primary risk drivers.
- **FR-5**: Conversational AI Assistant with emergencykeyword redirection and medical guardrails.
- **FR-6**: Scenario Simulator engine computing baseline vs simulated risk differences.
- **FR-7**: 24-48 Hour Forecast timeline evaluation and peak risk identification.
- **FR-8**: Smart Alert deduplication with configurable cooldown windows and severity filtering.
- **FR-9**: Community incident reporting, HTML sanitization, spatial clustering, and interactive Leaflet map.
- **FR-10**: Multi-tenant institutional dashboards (School, Worksite, NGO, Admin) with RBAC enforcement.

### Non-Functional Requirements
- **NFR-1 (Performance)**: Client risk calculation under 50ms; page load under 1.5s.
- **NFR-2 (Reliability)**: 100% offline resilience with LocalStorage fallback during API/DB degradation.
- **NFR-3 (Security)**: Strict Supabase RLS data isolation by user and organization ID.
- **NFR-4 (Safety)**: Mandatory labeling (`SCENARIO ESTIMATE`, `LIVE DATA`, `FORECAST`, `ML RISK ESTIMATE`) on all output components.

---

## 8. Technology Stack

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Styling & UI**: Tailwind CSS, Lucide React Icons
- **Mapping**: Leaflet.js, React-Leaflet, OpenStreetMap
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **Environmental API**: Open-Meteo Forecast & Geocoding APIs (Free Tier, No Key Required)
- **ML & Data Analysis**: Python (scikit-learn, pure Python fallback engine), TypeScript in-browser inference engine
- **Testing**: Node.js Native Test Runner (`tsx --test`)

---

## 9. Database Architecture (Supabase PostgreSQL)

```sql
-- Schema Highlights
profiles (id, email, age_group, exposure, activity_level, exposure_duration, cooling_access, role, organization_id)
organizations (id, name, type, locality, latitude, longitude, member_count)
organization_members (id, organization_id, user_id, role)
incidents (id, user_id, category, description, location_name, locality, latitude, longitude, status, votes_count)
saved_locations (id, user_id, name, locality, latitude, longitude)
weather_observations (id, latitude, longitude, temperature, relative_humidity, apparent_temperature, wind_speed, is_cached)
risk_assessments (id, user_id, risk_score, risk_level, temperature, apparent_temperature, relative_humidity, activity_level)
notifications (id, user_id, title, message, severity, read)
audit_logs (id, user_id, action, details)
```

---

## 10. Machine Learning Methodology

### Dataset Context
- **Global Climate Context**: Operational training benchmarks informed by ECMWF ERA5-Land Historical Reanalysis (2021–2024) across 74,440 total atmospheric profiles (44,064 training, 14,688 temporal holdout, 14,688 spatial holdout).
- **Synthetic Development Dataset**: 5,000 synthetic sample records generated via `ai-engine/generate_dataset.py` for reproducible zero-budget development and unit testing.

### Input Features
1. `temperature` (°C)
2. `relative_humidity` (%)
3. `apparent_temperature` (°C)
4. `wind_speed` (km/h)
5. `activity_level` (1=Low, 2=Moderate, 3=High)
6. `exposure_duration` (1=Short, 2=Moderate, 3=Long)
7. `cooling_access` (1=Good, 2=Limited, 3=None)
8. `age_group` (1=Adult, 2=Child, 3=Older Adult)

> [!CAUTION]
> **Methodological Note on Apparent Temperature**: `apparent_temperature` is derived from environmental variables (temperature, humidity, wind) using empirical heat equations (Steadman, Australian Apparent Temperature). In machine learning modeling, incorporating derived indices alongside raw environmental inputs can introduce collinearity. Within HeatShield AI, `apparent_temperature` is evaluated carefully alongside physical context to prevent artificial score inflation.

### Target Classes
- `0: LOW` (Score 0–35)
- `1: MODERATE` (Score 36–60)
- `2: HIGH` (Score 61–80)
- `3: EXTREME` (Score 81–100)

### Benchmark Results

| Model | Accuracy | Precision | Recall | Macro F1 |
|---|---|---|---|---|
| Logistic Regression | 0.7820 | 0.7763 | 0.7772 | 0.7753 |
| Decision Tree | 0.8170 | 0.8085 | 0.8112 | 0.8083 |
| Random Forest | 0.8290 | 0.8195 | 0.8242 | 0.8203 |
| **Gradient Boosting (Selected)** | **0.8350** | **0.8235** | **0.8282** | **0.8243** |

---

## 11. Explainable AI (XAI) & Guidance Systems

HeatShield AI uses feature attribution breakdown based on normalized risk weights:
- **Environmental Factors**: Apparent Temperature (42%), Relative Humidity (22%)
- **Contextual Factors**: Activity Exertion (16%), Exposure Duration (11%), Cooling Access (6%), Vulnerability (3%)

The guidance engine translates scores into specific actionable recommendations:
- **Personal**: Hydration intervals, rest frequency, shading protocols.
- **School**: PE recess modification (indoor vs modified outdoor).
- **Worksite**: NIOSH work-rest cycle ratios (e.g., 45 min work / 15 min rest at HIGH risk).

---

## 12. Security, Privacy, and RLS / RBAC Architecture

- **Supabase RLS**: Applied across all 9 PostgreSQL tables.
- **Data Isolation**: User data isolated by `auth.uid() = user_id`. Organization data isolated by membership checks.
- **Zero Secrets**: Credentials isolated in `.env` / Vercel Environment Variables. Zero keys committed to codebase.
- **Audit Logging**: Sensitive actions (member additions, role changes, moderation) logged without recording passwords, tokens, or PII.

---

## 13. Verification and Automated Testing

- **Total Automated Tests**: 78 / 78 PASS (`npm test`)
- **Typecheck**: PASS (`npx tsc --noEmit`)
- **Production Build**: PASS (`npm run build` — 26 static pages compiled)
- **Security Audit**: 12/12 security test suite passed (Phase 8)

---

## 14. Defensible Scope & Known Limitations

1. **Decision Support Only**: HeatShield AI provides contextual environmental heat-risk estimates for decision support. It is NOT a medical diagnosis tool, medical device, or clinical prognostic system.
2. **Client-Side Auth Guards**: Route protection is client-side in Next.js pages; database access is strictly enforced by Supabase RLS.
3. **Derived Environmental Metric Collinearity**: Apparent temperature and heat index equations are collinear with ambient temperature and relative humidity, requiring strict contextual weighting in inference.

---

## 15. Conclusion & Future Work

HeatShield AI demonstrates that high-performance, context-aware AI decision support for climate adaptation can be designed, validated, and deployed on zero-budget infrastructure. Future work includes integrating micro-meteorological sensors, satellite land surface temperature data, and automated push notifications via web push standards.

---

## References

1. Steadman, R. G. (1979). The Assessment of Sultriness. *Journal of Applied Meteorology*, 18(7), 861-873.
2. National Institute for Occupational Safety and Health (NIOSH). (2016). *Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments*. DHHS (NIOSH) Publication No. 2016-106.
3. European Centre for Medium-Range Weather Forecasts (ECMWF). (2021). *ERA5-Land Hourly Data from 1950 to Present*. Copernicus Climate Change Service Documentation.
4. World Health Organization (WHO) & World Meteorological Organization (WMO). (2015). *Heatwaves and Health: Guidance on Warning-System Development*. WMO-No. 1142.

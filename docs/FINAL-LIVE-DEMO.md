# HeatShield AI — Final Live Demonstration Script

> **Duration**: 7 to 10 Minutes  
> **Target Audience**: Project Reviewers, External Examiners, Evaluation Committee  
> **Objective**: Execute a smooth, structured, timestamped live demonstration of HeatShield AI's core capabilities while adhering to strict UI data labeling rules.

---

## UI Labeling & Data Rules (Mandatory)

During the live demonstration, draw explicit attention to the UI data labels:

- `LIVE DATA`: Applied to active live Open-Meteo REST stream data.
- `CACHED DATA`: Applied when serving offline weather cache during network disruption.
- `FORECAST`: Applied to 24–48 hour projected weather timeline.
- `ML RISK ESTIMATE`: Applied to Gradient Boosting model benchmarks.
- `SCENARIO ESTIMATE`: Applied to interactive Risk Simulator output.
- `COMMUNITY REPORT`: Applied to crowd-sourced incident submissions.
- `DEMO CAPTURE`: Applied if displaying pre-recorded backup screenshots due to API outages.

---

## 10-Minute Live Demo Timeline

### 00:00 – 00:45 | Problem & Motivation
- **Screen**: Landing Page (`/`) hero section.
- **Presenter Action**: Point to header and brand logo.
- **Script**:
  > *"Welcome members of the committee. Today I am presenting HeatShield AI. Standard weather apps report ambient temperature like 38°C, but they fail to account for personal physiological exertion, exposure duration, cooling availability, or institutional safety rules. HeatShield AI bridges this gap by combining live atmospheric streams with personal context to deliver transparent, actionable risk intelligence."*

---

### 00:45 – 01:30 | Landing Page & System Overview
- **Screen**: Scroll through Landing Page (`/`). Point to feature sections.
- **Script**:
  > *"Our landing page outlines the system core: personalized heat risk scoring, explainable AI attribution, scenario simulation, 24-48 hour forecasts, smart alerts, spatial hazard mapping, and multi-tenant organizational views for Schools, Worksites, and NGOs."*

---

### 01:30 – 02:15 | Authentication & Onboarding
- **Screen**: Click "Check Heat Risk", navigate to `/onboarding`.
- **Presenter Action**: Select profile options: High Activity, Moderate Duration, Limited Cooling, Adult. Click Save.
- **Script**:
  > *"Let's configure a user profile. I will set my exertion to High Physical Activity, with Moderate Duration, and Limited Cooling Access. HeatShield AI saves these parameters to personalize all subsequent risk computations."*

---

### 02:15 – 03:15 | Location & Live Environmental Stream
- **Screen**: Dashboard (`/dashboard`). Point to location card and `LIVE DATA` status badge.
- **Presenter Action**: Highlight temperature, humidity, apparent temp, and wind speed.
- **Script**:
  > *"On the Dashboard, HeatShield AI ingests live atmospheric data from the Open-Meteo API for our location. Notice the badge clearly labeled LIVE DATA. If the network degrades, the engine automatically serves stale cached data with a CACHED DATA badge."*

---

### 03:15 – 04:15 | Risk Score, XAI Drivers & Guidance
- **Screen**: Heat Gauge and Risk Drivers section on `/dashboard`.
- **Presenter Action**: Point out composite score, XAI progress bars, and NIOSH hydration advice.
- **Script**:
  > *"Here is our composite heat-risk score. Rather than giving a black-box number, our Explainable AI driver breakdown shows exact feature contributions: 42% from apparent temperature, 22% from humidity, and 16% from physical exertion. Below, the guidance engine generates personalized hydration schedules and rest protocols aligned with NIOSH safety standards."*

---

### 04:15 – 05:00 | AI Safety Assistant & Guardrails
- **Screen**: AI Assistant (`/assistant`).
- **Presenter Action**: Type query: *"I feel dizzy and my co-worker passed out"*. Click Send.
- **Script**:
  > *"Let's test our AI Safety Assistant. When I type an emergency phrase like 'passed out', our safety guardrail instantly displays a prominent emergency alert banner directing the user to emergency services (108/112/911). It explicitly refuses to provide false medical reassurance."*

---

### 05:00 – 05:45 | Risk Simulator ("What-If" Modeling)
- **Screen**: Risk Simulator (`/simulator`).
- **Presenter Action**: Drag activity slider from High to Low. Click Run Simulation.
- **Script**:
  > *"The Risk Simulator allows decision-makers to evaluate 'what-if' scenarios. By simulating a reduction in activity level from High to Low, we see our risk score drop from HIGH (72) to MODERATE (48). Notice that all output is strictly labeled SCENARIO ESTIMATE — never presented as live observations."*

---

### 05:45 – 06:30 | Forecast Timeline & Smart Alerts
- **Screen**: Timeline (`/timeline`) and Alerts (`/alerts`).
- **Presenter Action**: Point out peak heat risk window and alert deduplication settings.
- **Script**:
  > *"The Forecast Timeline analyzes upcoming 24-48 hour hourly projections from Open-Meteo to identify peak heat risk windows. Based on this forecast, our Smart Alert engine automatically generates deduplicated alerts with a 4-hour cooldown window to prevent notification fatigue."*

---

### 06:30 – 07:15 | Community Hub & Interactive Hazard Map
- **Screen**: Community Map (`/community/map`).
- **Presenter Action**: Point out clustered incident pins and verified cooling center icons.
- **Script**:
  > *"In the Community Hub, citizens submit localized hazard reports like broken water fountains. On the interactive map, reports undergo script sanitization and are automatically clustered using pairwise Haversine distance calculations alongside verified cooling centers."*

---

### 07:15 – 08:00 | Multi-Tenant Organization Dashboards
- **Screen**: Worksite Portal (`/worksite`) and Admin Panel (`/admin`).
- **Presenter Action**: Point out NIOSH work-rest calculator and admin audit log list.
- **Script**:
  > *"HeatShield AI provides multi-tenant organizational intelligence. On the Worksite Dashboard, site managers get automated NIOSH work-rest schedules (e.g. 45 min work / 15 min rest). Switching to the Admin Panel, administrators manage organization memberships and view audit logs with strict password redaction."*

---

### 08:00 – 09:00 | Security, ML Research Benchmark & Integrity
- **Screen**: Project Documentation / Architecture summary.
- **Script**:
  > *"HeatShield AI is backed by 78 automated integration tests with a 100% pass rate, zero type errors, and a 26-route production build. Our production runtime uses a deterministic TypeScript engine, while our offline ERA5-Land research benchmark achieved 97.86% temporal accuracy. The system runs on a $0 budget using Supabase RLS for multi-tenant data isolation."*

---

### 09:00 – 10:00 | Conclusion & Q&A Transition
- **Script**:
  > *"To conclude: HeatShield AI demonstrates that location-aware, context-sensitive heat risk decision support can be unified with transparent XAI, safety guardrails, and multi-tenant security on zero-budget infrastructure. Thank you, and I welcome your questions."*

---

*End of Demonstration Script (10:00 Total)*

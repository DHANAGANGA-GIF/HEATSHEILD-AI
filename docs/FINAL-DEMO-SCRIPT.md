# HeatShield AI — Final Live Demonstration Script

> **Duration**: 7 to 10 Minutes  
> **Target Audience**: Evaluation Committee, Academic Examiners, Project Reviewers  
> **Objective**: Showcase end-to-end functionality of HeatShield AI across personal risk assessment, AI guidance, scenario simulation, forecasting, community reporting, and organizational intelligence.

---

## Pre-Demo Checklist

- [x] Local dev server running (`npm run dev` at `http://localhost:3000`)
- [x] Clear browser cache / start in clean session window
- [x] Ensure internet connectivity (for Open-Meteo REST & Supabase requests)
- [x] Verify microphone and screen sharing resolution (1920x1080)

---

## Timestamped Demo Walkthrough

### 00:00 – 01:00 | Introduction & Problem Overview
- **Action**: Display Landing Page (`/`).
- **Speaker Script**:
  > *"Good morning/afternoon. Today I am presenting HeatShield AI, an intelligent multi-tenant decision-support platform for contextual heat-risk mitigation. Standard weather apps tell you it is 38°C outside, but they cannot tell you how that temperature impacts a construction worker exuding heavy physical effort versus a child at school recess. HeatShield AI bridges this gap by combining real-time environmental streams with personal physiological context using Gradient Boosting machine learning and Explainable AI."*

---

### 01:00 – 02:00 | Authentication & Onboarding
- **Action**: Click "Check Heat Risk" or "Log In", navigate to `/onboarding`.
- **Speaker Script**:
  > *"Let's begin by setting up a user profile. I'll configure my profile as an adult exuding high physical activity, with moderate exposure duration, and limited cooling access. HeatShield AI immediately captures these physiological parameters to personalize all risk evaluations."*

---

### 02:00 – 03:00 | Live Location & Environmental Ingestion
- **Action**: Navigate to Dashboard (`/dashboard`). Point out location card and data status badge (`LIVE DATA`).
- **Speaker Script**:
  > *"Here on the Dashboard, HeatShield AI automatically ingests live atmospheric data from the Open-Meteo API for our current location. Notice the data status badge clearly labeled LIVE DATA. If the API is unreachable, the system gracefully degrades to a cached payload without interrupting operation."*

---

### 03:00 – 04:00 | Risk Score Gauge & Explainable AI (XAI)
- **Action**: Highlight the Heat Gauge and XAI Risk Drivers section (`/dashboard`).
- **Speaker Script**:
  > *"The Heat Gauge displays our composite risk score. Rather than giving a black-box prediction, our Explainable AI breakdown shows exactly what factors contribute to this score: 42% from apparent temperature, 22% from humidity, and 16% from physical exertion. Below, the guidance engine generates customized hydration and rest protocols aligned with NIOSH safety standards."*

---

### 04:00 – 05:00 | AI Safety Assistant & Guardrails
- **Action**: Open AI Assistant (`/assistant`). Type question: *"I feel dizzy and my co-worker passed out"*.
- **Speaker Script**:
  > *"Let's test our AI Safety Assistant. When I enter an emergency phrase like 'passed out', our safety guardrails instantly trigger an emergency alert banner directing the user to emergency services (108/112/911). It explicitly refuses to provide false medical reassurance."*

---

### 05:00 – 06:00 | Interactive Risk Simulator
- **Action**: Navigate to Risk Simulator (`/simulator`). Adjust activity slider from High to Low.
- **Speaker Script**:
  > *"Next, the Risk Simulator allows decision-makers to evaluate 'what-if' scenarios. By simulating a reduction in activity level from High to Low, we see our risk score drop from HIGH (72) to MODERATE (48). Notice that all outputs are strictly and prominently labeled SCENARIO ESTIMATE — never presented as live observations."*

---

### 06:00 – 07:00 | Forecast Timeline & Smart Alerts
- **Action**: Navigate to Timeline (`/timeline`) and Alerts (`/alerts`).
- **Speaker Script**:
  > *"The Forecast Timeline analyzes the upcoming 24-48 hours from Open-Meteo, identifying peak risk windows. Based on this forecast, our Smart Alert engine automatically generates deduplicated alerts with a 4-hour cooldown window to prevent alert fatigue."*

---

### 07:00 – 08:00 | Community Hub & Interactive Map
- **Action**: Navigate to Community Hub (`/community`) and Map (`/community/map`).
- **Speaker Script**:
  > *"In the Community Hub, users can view and submit localized heat hazard reports, such as unshaded areas or broken water fountains. On the interactive map, reports are automatically clustered spatially using Haversine distance calculations, alongside verified cooling center locations."*

---

### 08:00 – 09:00 | Multi-Tenant Organization Dashboards
- **Action**: Navigate to Worksite Portal (`/worksite`) and Admin Panel (`/admin`).
- **Speaker Script**:
  > *"HeatShield AI provides multi-tenant organizational intelligence. On the Worksite Dashboard, site managers get automated NIOSH work-rest cycle schedules (e.g. 45 min work / 15 min rest). Switching to the Admin Panel, administrators can manage organization memberships and view audit logs with strict password redaction."*

---

### 09:00 – 10:00 | Security, ML Benchmarks & Conclusion
- **Action**: Navigate to Project Documentation or highlight summary slide.
- **Speaker Script**:
  > *"To summarize: HeatShield AI is backed by 78 automated tests with a 100% pass rate, zero static type errors, and a successful 26-route production build. Our Gradient Boosting ML model achieved 83.50% accuracy on benchmark tests. The entire platform runs on a $0 budget using Supabase RLS for complete multi-tenant security. Thank you, and I welcome your questions."*

---

*End of Demonstration Script (10:00 Total)*

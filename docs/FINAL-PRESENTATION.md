# HeatShield AI — Final Project Defense Presentation Deck

> **15-Slide Master Deck for Final Examination & Defense**  
> **Date**: August 2026  
> **Status**: APPROVED FOR PRESENTATION  

---

### SLIDE 1: Title Slide
- **Title**: HEATSHIELD AI — Intelligent Multi-Tenant Heat-Risk Decision-Support System
- **Subtitle**: Location-Aware Contextual Risk Assessment, Explainable AI, and Community Resilience
- **Presenter**: HeatShield AI Development Team
- **Key Takeaway**: A zero-budget, serverless decision-support platform bridging meteorological observations and human physiological thermal strain.

---

### SLIDE 2: Problem Statement
- **Headline**: Ambient Temperature Does Not Equal Human Thermal Strain
- **Key Points**:
  - 38°C in a shaded room $\neq$ 38°C on an outdoor construction site.
  - Standard weather apps ignore physical exertion, exposure duration, cooling availability, and age vulnerability.
  - Generic regional advisories (100 km² scale) cause public alarm fatigue and lack actionable localized advice.
- **Visual**: Side-by-side comparison box: Generic Weather App (38°C) vs Outdoor Worker (Extreme Thermal Strain).

---

### SLIDE 3: Motivation & Social Impact
- **Headline**: Extreme Heat is the Leading Weather-Related Health Emergency
- **Key Points**:
  - Global temperature extremes are expanding urban heat islands.
  - High-risk cohorts: Outdoor laborers, schoolchildren, elderly residents without air conditioning.
  - Need for an accessible, zero-budget climate adaptation tool for individuals and institutions.
- **Visual**: Vulnerability cohort icons (Worker, Child, Elderly) + Global Heat Map Graphic.

---

### SLIDE 4: Limitations of Existing Systems
- **Headline**: Current Tools Fail Personal and Institutional Needs
- **Key Points**:
  - *Consumer Weather Apps*: Provide ambient temperature only; zero context awareness.
  - *NWS Regional Alerts*: Coarse spatial scale; zero localized microclimate insight.
  - *Institutional Gap*: Schools and worksites lack automated tools for NIOSH work-rest cycles or recess modification.
- **Visual**: Matrix of existing limitations vs HeatShield AI capabilities.

---

### SLIDE 5: Proposed Solution — HeatShield AI
- **Headline**: Context-Aware Environmental Decision Support
- **Key Points**:
  - *Real-Time Context Fusion*: Integrates live weather streams with personal exertion/exposure vectors.
  - *Explainable AI (XAI)*: Transparent driver attribution showing exact risk factor percentages.
  - *Multi-Tenant Security*: Dedicated operational views for Schools, Worksites, NGOs, and Admins via Supabase RLS.
- **Visual**: 4-module architecture badge: Weather -> Context Engine -> XAI -> Operational Guidance.

---

### SLIDE 6: System Architecture & Zero-Budget Stack
- **Headline**: Serverless & Resilient Web Infrastructure
- **Key Points**:
  - *Frontend*: Next.js 14 App Router, TypeScript, Tailwind CSS, Leaflet Maps.
  - *Database & Auth*: Supabase PostgreSQL with Row Level Security (RLS).
  - *Data Stream*: Open-Meteo REST API (Free tier, 15-minute LocalStorage cache fallback).
  - *Zero Cost*: Deployed on $0/month serverless infrastructure.
- **Visual**: 3-tier system diagram (Next.js Client -> Open-Meteo REST / Supabase RLS DB -> Local Cache).

---

### SLIDE 7: Real-Time Processing Pipeline
- **Headline**: From Atmospheric Stream to Actionable Score
- **Key Points**:
  - *Step 1 (Ingress)*: Fetch live Open-Meteo data ($T, RH, AT, W$) or load stale cache.
  - *Step 2 (Physics & Context)*: Compute Steadman Heat Index + apply non-linear context multipliers.
  - *Step 3 (Classification)*: Score (0–100) mapped to `LOW`, `MODERATE`, `HIGH`, `EXTREME`.
  - *Step 4 (Guidance)*: Generate NIOSH-aligned hydration schedules and work-rest ratios.
- **Visual**: Data pipeline flowchart from REST API to UI Heat Gauge.

---

### SLIDE 8: Production Risk Engine vs. Research Benchmark
- **Headline**: Clear Separation of Production System & ML Experiments
- **Key Points**:
  - **Production Runtime**: Executed via a deterministic TypeScript engine (`lib/risk-engine.ts`) combining Steadman Heat Index equations with NIOSH context multipliers.
  - **Historical ERA5 Research ML Benchmark**: Off-line experiment on 74,440 ECMWF reanalysis profiles (Gradient Boosting: 97.86% Temporal Acc, 0.8176 Macro F1).
  - **Synthetic Development Benchmark**: 5,000-sample integration test dataset (81.70% Acc, 0.8083 Macro F1).
- **Visual**: Architectural separation table highlighting Production TS Engine vs Offline ML Benchmarks.

---

### SLIDE 9: Explainable AI (XAI) & Guidance System
- **Headline**: Transparency Over Black-Box Models
- **Key Points**:
  - *Proportional Drivers*: Apparent Temp (42%), Humidity (22%), Exertion (16%), Exposure (11%).
  - *Operational Guidance*: Converts risk drivers into actionable recommendations.
  - *Safety Guardrails*: Emergency phrase detection redirects to 108/112/911; medical queries trigger disclaimers.
- **Visual**: Mockup screenshot of XAI progress bar breakdown and emergency banner.

---

### SLIDE 10: Interactive Scenario Simulator & Forecast Timeline
- **Headline**: Decision-Support Scenario Modeling & Trend Analysis
- **Key Points**:
  - *Risk Simulator*: Model "what-if" exertion or duration changes; strictly labeled `SCENARIO ESTIMATE`.
  - *Forecast Timeline*: 24–48 hour hourly risk trend projection from Open-Meteo forecast stream.
  - *Smart Heat Alerts*: Cooldown-deduplicated notification engine (4-hour window per tier) preventing alert fatigue.
- **Visual**: Simulator UI layout showing baseline vs scenario comparison.

---

### SLIDE 11: Community Hub & Interactive Hazard Map
- **Headline**: Crowd-Sourced Spatial Awareness
- **Key Points**:
  - *Hazard Reporting*: Citizens submit reports (broken water fountains, unshaded bus stops).
  - *Security Sanitization*: Client-side script stripping prevents XSS attacks.
  - *Spatial Clustering*: Pairwise Haversine distance calculations group incidents ($\le 0.5\text{ km}$).
  - *Cooling Center Layer*: Verified cooling shelter markers on Leaflet maps.
- **Visual**: Map interface layout showing clustered hazard pins and cooling centers.

---

### SLIDE 12: Multi-Tenant Organization Intelligence
- **Headline**: Dedicated Operational Dashboards
- **Key Points**:
  - *School*: Automated PE recess modification decisions based on thermal load.
  - *Worksite*: NIOSH manual labor work-rest cycle schedules (e.g. 45 min work / 15 min rest).
  - *NGO*: Hazard report moderation and resource distribution.
  - *Admin*: User role management and security audit log monitoring.
- **Visual**: Role-based access control matrix (School vs Worksite vs NGO vs Admin).

---

### SLIDE 13: Security, Hardening & Automated Validation
- **Headline**: Rigorous Quality & Security Audit
- **Key Points**:
  - **78 / 78 Automated Tests Passed** (`100% test pass rate`).
  - **0 Static Type Errors** (`npx tsc --noEmit`).
  - **26 / 26 Static Routes Compiled** (`npm run build`).
  - **Supabase RLS**: Multi-tenant database isolation enforced (`auth.uid() = user_id`).
  - **Zero Key Leakage**: No passwords, service-role keys, or JWT tokens in source or logs.
- **Visual**: Validation scorecard badge card (Green Checkmarks: Tests 78/78, Build PASS, Security PASS).

---

### SLIDE 14: Methodological Limitations
- **Headline**: Honest & Defensible Academic Boundaries
- **Key Points**:
  - *Non-Clinical Tool*: Decision-support prototype; does not diagnose medical conditions or predict heatstroke.
  - *Deterministic Production Runtime*: Production uses deterministic TS risk calculations.
  - *Target-Derived Feature Risk*: `apparent_temperature` acts as a proxy feature in tree splits (50.5% importance).
  - *Raw ERA5 Dataset Archival*: Raw reanalysis data not archived in repository; benchmark metrics reported from evaluation audit.
- **Visual**: Bulleted limitations checklist.

---

### SLIDE 15: Conclusion & Future Scope
- **Headline**: Empowering Climate Resilience Through AI
- **Key Points**:
  - HeatShield AI proves context-aware heat risk intelligence can be delivered on zero-budget infrastructure.
  - Unifies empirical physics, XAI transparency, smart alerts, community mapping, and multi-tenant security.
  - *Future Directions*: Micro-meteorological IoT sensors, Satellite Land Surface Temperature, prospective clinical field studies.
- **Visual**: HeatShield AI logo with tag "Empowering Safe & Resilient Communities".

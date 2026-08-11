# HEATSHIELD AI — PHASE 6: COMMUNITY HUB & INTERACTIVE MAP VALIDATION DOCUMENTATION

## 1. Overview & Data Disclaimer

> **EXPLICIT MANDATORY DISCLAIMER:**
> **Community reports are user-generated observations and are not automatically scientific measurements or verified facts.**

HeatShield AI integrates crowdsourced community safety reporting with real-time meteorological observations and machine learning heat risk estimations. This document details the architectural design, database security policies, data classification hierarchy, moderation guardrails, failure handling procedures, and test validation results for Phase 6.

---

## 2. Data Classification & Hierarchy Architecture

HeatShield AI categorizes spatial and environmental information into four distinct data streams:

| Data Stream Class | Icon / Badge Label | Source Engine | Verification Level | Scientific Weight |
|---|---|---|---|---|
| **LIVE ENVIRONMENTAL DATA** | `[LIVE ENVIRONMENTAL]` | Open-Meteo API / WMO Weather Stream | Sensor Observed | Ground Truth Observation |
| **ML RISK ESTIMATE** | `[ML RISK ESTIMATE]` | Gradient Boosting Model (HeatShield-XAI v1.2) | Algorithmically Inferred | Decision-Support Model Estimate |
| **COMMUNITY REPORT** | `[COMMUNITY REPORT]` | Crowdsourced User Submissions | Unverified / Crowdsourced | User Observation |
| **VERIFIED LOCATION** | `[VERIFIED LOCATION]` | Official Municipal / Public Cooling Registry | Public / Municipal Verified | Officially Verified Infrastructure |

---

## 3. Database Schema & Row Level Security (RLS) Policies

### PostgreSQL Schema Definition (`public.incidents`)

```sql
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT CHECK (category IN (
        'water_access', 'shade_cooling', 'outdoor_heat', 'cooling_facility',
        'unsafe_condition', 'infrastructure', 'public_space', 'other'
    )) NOT NULL,
    description TEXT NOT NULL,
    location_name TEXT NOT NULL,
    locality TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK (status IN ('NEW', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWED', 'VERIFIED', 'RESOLVED', 'REJECTED')) DEFAULT 'SUBMITTED',
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
    votes_count INT DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng ON public.incidents (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_incidents_user ON public.incidents (user_id);
```

### Row Level Security Policies

```sql
-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access: Anyone can view public community reports
CREATE POLICY "Public read community incidents"
  ON public.incidents FOR SELECT USING (true);

-- 2. Authenticated Insert: Authenticated users insert their own reports
CREATE POLICY "Users insert own incidents"
  ON public.incidents FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. User Update Isolation: Users can modify only their own reports
CREATE POLICY "Users update own incidents"
  ON public.incidents FOR UPDATE USING (auth.uid() = user_id);

-- 4. User Delete Isolation: Users can delete only their own reports
CREATE POLICY "Users delete own incidents"
  ON public.incidents FOR DELETE USING (auth.uid() = user_id);
```

---

## 4. Report Lifecycle & Moderation Rules

### State Transitions

```
[SUBMITTED / NEW] ──► [UNDER_REVIEW / REVIEWED] ──► [VERIFIED] ──► [RESOLVED]
                                                 └─► [REJECTED]
```

1. **SUBMITTED / NEW**: Initial crowdsourced entry upon user submission.
2. **UNDER_REVIEW / REVIEWED**: Highlighted in spatial clusters or flagged for evaluation.
3. **VERIFIED / RESOLVED**: Confirmed by community consensus or municipal resolution.
4. **REJECTED**: Removed due to duplicate or invalid submission.

### Input Moderation & Abuse Prevention

- **Description Validation**: Required non-empty string, minimum 5 characters, maximum 1000 characters.
- **XSS & HTML Sanitization**: Automatic stripping of `<script>`, `<iframe>`, and HTML markup using `sanitizeHtml()`.
- **Coordinate Range Checks**: Validates latitude $\in [-90, 90]$ and longitude $\in [-180, 180]$, rejecting $(0,0)$ null coordinates.
- **Rapid Submission Protection**: Enforces a 30-second cooldown per user ID to prevent spam attacks (`checkDuplicateSubmission()`).
- **Duplicate Content Filtering**: Blocks identical description submissions within a 5-minute window.

---

## 5. Map Behavior & Spatial Cluster Detection

- **Leaflet & OpenStreetMap Integration**: Dynamically renders client-side interactive map with custom markers.
- **Marker Classification**:
  - `COMMUNITY REPORT`: Blue/amber markers displaying description, status, submitted timestamp, votes, and crowdsourced disclaimer.
  - `VERIFIED / PUBLIC LOCATION`: Emerald markers for official cooling centers and public water points with operating hours and contact details.
  - `SPATIAL CLUSTER HIGHLIGHT`: Red circles generated via Haversine spatial clustering ($R \le 3.0\text{ km}$, $\text{count} \ge 2$) warning of potential localized heat issues.
- **Filters**:
  - **Category**: Filter by 8 practical heat hazard categories.
  - **Status**: Filter by submission state.
  - **Severity**: Filter by Info, Warning, Critical.
  - **Timeframe**: All time, Past 24 hours, Past 7 days.
  - **Nearby Radius**: Spatial radius filtering ($5\text{ km}, 10\text{ km}, 25\text{ km}$) relative to user center.

---

## 6. Privacy & Security Audit

- **Identity Shielding**: Email addresses, phone numbers, and authentication tokens are NEVER exposed in map popups or public APIs.
- **Location Protection**: Coordinates can be rounded to 3–4 decimal places (~11–100m) to prevent revealing precise residential addresses.
- **Zero Credential Exposure**: Client code strictly uses anonymous publishable keys; service-role keys are prohibited in frontend bundles.

---

## 7. Failure Handling Matrix

| Scenario | System Behavior | Recovery / Fallback |
|---|---|---|
| **Map Script Failure** | Map container displays graceful error fallback banner | Reports remain fully accessible in structured list view |
| **Location Permission Denied** | Defaults to saved user location or city center | User can manually select coordinates |
| **Supabase Unavailability** | Database calls fail gracefully without crashing app | LocalStorage cache serves and persists user reports |
| **Invalid Coordinates** | Input form rejects invalid lat/lng values with alert | Prompts user to input valid geographical coordinates |
| **Duplicate / Rapid Submissions** | Submission rate limiter blocks repeat request | Displays countdown timer for user cooldown |

---

## 8. Test Execution Summary

### Summary: 53 / 53 PASSING (100% Success)

```
✔ AI Assistant: Emergency Safety Trigger
✔ AI Assistant: Risk Driver Question
✔ AI Assistant: Guidance & Precautions Question
✔ AI Assistant: Forecast & Peak Hours Question
✔ AI Assistant: Simple Mode Response
✔ AI Assistant: Technical Mode Response
✔ AI Assistant: Missing Environmental Data Handling
✔ AI Assistant: Empty Input Handling
✔ AI Assistant: Cached Data Status Preservation
✔ AI Assistant: General Fallback Question
✔ Haversine Distance Calculation
✔ Spatial Community Cluster Detection
✔ 1. Report Validation: Description length & HTML script stripping
✔ 2. Coordinate Validation: Latitude/Longitude boundary checks
✔ 3. Report Creation: Object instantiation & timestamping
✔ 4. Report Retrieval: Fetching list with correct format
✔ 5. Category Filtering: Subsetting reports by category
✔ 6. Nearby Filtering: Haversine distance threshold filtering
✔ 7. Status Lifecycle Handling: SUBMITTED -> UNDER_REVIEW -> RESOLVED
✔ 8. Duplicate Submission Protection: Cooldown rate limiting
✔ 9. Unauthorized Access Protection: Missing user context safeguards
✔ 10. RLS / User Isolation: User can modify/delete only own report
✔ 11. Map Failure & Fallback: Graceful degradation for invalid locations
✔ 12. Supabase Failure & Local Store Fallback: Seamless offline operation
✔ 13. Invalid Input Parameter Handling: Unsupported categories & invalid inputs
✔ Forecast Engine: Valid forecast array parsed correctly
✔ Forecast Engine: Risk scores calculated via risk engine
✔ Forecast Engine: Increasing risk periods detected
✔ Forecast Engine: Decreasing risk periods detected
✔ Forecast Engine: Peak risk period correctly identified
✔ Alert Engine: HIGH tier alert generated when forecast reaches HIGH
✔ Alert Engine: EXTREME alert generated when forecast score >= 81
✔ Alert Engine: Alert deduplication prevents repeat within cooldown
✔ Alert Engine: Dismissed alerts are marked dismissed, not deleted
✔ Alert Engine: Min severity filter respected
✔ Forecast Engine: Empty forecast array returns empty scored array
✔ Alert Engine: No alerts generated when source is UNAVAILABLE
✔ Forecast Engine: Cached data marked as CACHED FORECAST in data_label
✔ Alert Engine: Alerts generated without requesting browser notification permission
✔ Forecast Engine: Invalid forecast entries handled gracefully
✔ Steadman Heat Index Calculation
✔ Heat Risk Engine Evaluation
✔ Risk Simulator: Baseline Scenario Initialization
✔ Risk Simulator: Activity Level Change Scenario
✔ Risk Simulator: Exposure Duration Change Scenario
✔ Risk Simulator: Location Change Scenario
✔ Risk Simulator: Score Diff Calculation
✔ Risk Simulator: Risk Tier Transition
✔ Risk Simulator: Extreme Input Values
✔ Risk Simulator: Reset Scenario
✔ Risk Simulator: Missing Weather Data Handling
✔ Risk Simulator: ML & Contextual Notice Inclusion
✔ Risk Simulator: Mandatory Labeling Assertion

ℹ tests 53
ℹ suites 0
ℹ pass 53
ℹ fail 0
ℹ duration_ms 473.66ms
```

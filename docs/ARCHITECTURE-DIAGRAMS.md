# HeatShield AI — System Architecture Diagrams

> Documentation-Ready Technical Diagrams representing the validated HeatShield AI application implementation.

---

## 1. Overall System Architecture

```mermaid
graph TD
    Client[Next.js 14 Frontend Layer] -->|REST / HTTPS| WeatherAPI[Open-Meteo Weather API]
    Client -->|Client ML Engine| MLInference[TS / Python Gradient Boosting ML]
    Client -->|HTTPS / WSS| Supabase[Supabase PostgreSQL Cloud]
    
    subgraph Frontend Services
        Client --> DashboardView[Personal Dashboard]
        Client --> SimView[Risk Simulator]
        Client --> AssistantView[AI Safety Assistant]
        Client --> MapView[Community Map & Reports]
        Client --> OrgViews[School / Worksite / NGO / Admin]
    end
    
    subgraph Database Layer (Supabase)
        Supabase --> Profiles[profiles Table]
        Supabase --> Incidents[incidents Table]
        Supabase --> Orgs[organizations & members]
        Supabase --> RLS[PostgreSQL Row Level Security]
    end
```

---

## 2. Data Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as Next.js Page Component
    participant WAPI as Open-Meteo Weather API
    participant Cache as Client Weather Cache
    participant Engine as Risk Engine (TS/ML)
    participant DB as Supabase PostgreSQL

    User->>Page: Open Dashboard / App
    Page->>Cache: Check Cached Weather (15m window)
    alt Cache Hit
        Cache-->>Page: Return Cached Payload (CACHED)
    else Cache Miss
        Page->>WAPI: Fetch Live Lat/Lng Weather
        WAPI-->>Page: Return Atmospheric Stream (LIVE)
        Page->>Cache: Store Payload
    end
    Page->>Engine: Pass Weather + User Profile Vector
    Engine->>Engine: Compute Steadman Index & ML Risk Score
    Engine-->>Page: Return RiskAssessment (Score, Level, XAI)
    Page->>DB: Log Risk Assessment (Optional Sync)
    Page-->>User: Render Gauge, XAI Breakdown & Guidance
```

---

## 3. Machine Learning Pipeline Architecture

```mermaid
flowchart LR
    subgraph Data Preparation
        Dataset[ERA5-Land / 5000 Synthetic Samples] --> Preproc[StandardScaler & Categorical Encoding]
    end
    
    subgraph Training & Model Selection
        Preproc --> Models[Benchmark Models]
        Models --> LR[Logistic Regression: 78.2%]
        Models --> DT[Decision Tree: 81.7%]
        Models --> RF[Random Forest: 82.9%]
        Models --> GB[Gradient Boosting: 83.5%]
        GB --> Best[Selected: Gradient Boosting Classifier]
    end

    subgraph Runtime Inference
        Best --> ModelReport[models/evaluation_report.json]
        ModelReport --> TSEngine[In-Browser Pure TS ML Inference Engine]
        TSEngine --> Output[Risk Score + Level + Drivers]
    end
```

---

## 4. Database Entity-Relationship (ER) Structure

```mermaid
erDiagram
    PROFILES ||--o{ INCIDENTS : "submits"
    PROFILES ||--o{ SAVED_LOCATIONS : "saves"
    PROFILES ||--o{ RISK_ASSESSMENTS : "evaluates"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    PROFILES ||--o{ AUDIT_LOGS : "triggers"
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : "contains"
    PROFILES ||--o{ ORGANIZATION_MEMBERS : "belongs to"

    PROFILES {
        uuid id PK
        string email
        string full_name
        string role
        uuid organization_id FK
    }

    ORGANIZATIONS {
        uuid id PK
        string name
        string type
        string locality
        double latitude
        double longitude
    }

    ORGANIZATION_MEMBERS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string role
    }

    INCIDENTS {
        uuid id PK
        uuid user_id FK
        string category
        string description
        string status
        double latitude
        double longitude
    }
```

---

## 5. Authentication & Role-Based Access Control (RBAC) Flow

```mermaid
flowchart TD
    UserRequest[User Access Request] --> AuthCheck{Supabase Authenticated?}
    AuthCheck -- No --> PublicPages[Access Public Landing / Login]
    AuthCheck -- Yes --> ProfileFetch[Fetch User Profile & Role]
    
    ProfileFetch --> RoleSwitch{Check User Role}
    RoleSwitch -- user / member --> UserRoutes[Access Dashboard, Simulator, Forecast, Community]
    RoleSwitch -- school --> SchoolPortal[Access School Dashboard]
    RoleSwitch -- worksite --> WorksitePortal[Access Worksite Dashboard]
    RoleSwitch -- ngo --> NGOPortal[Access NGO Portal & Moderation]
    RoleSwitch -- admin / org_admin --> AdminPanel[Access Platform Admin Panel]
    
    SchoolPortal -- Attempt Admin Access --> Denied[ACCESS DENIED]
    WorksitePortal -- Attempt Admin Access --> Denied
```

---

## 6. Real-Time Heat-Risk Pipeline

```mermaid
flowchart TD
    Env[Ambient Temp, Humidity, Wind] --> Physical[Steadman Heat Index Calculation]
    Context[Activity, Duration, Cooling, Age] --> MLInput[Feature Vector Construction]
    
    Physical --> ScoreCombine[Weight Combined Risk Score 0-100]
    MLInput --> MLEngine[Gradient Boosting ML Inference]
    MLEngine --> ScoreCombine
    
    ScoreCombine --> Classify{Score Thresholds}
    Classify -- "< 36" --> LOW[LOW RISK]
    Classify -- "36 - 60" --> MODERATE[MODERATE RISK]
    Classify -- "61 - 80" --> HIGH[HIGH RISK]
    Classify -- ">= 81" --> EXTREME[EXTREME RISK]
    
    ScoreCombine --> XAI[XAI Feature Attribution Generator]
    XAI --> UI[Render Dashboard & Guidance]
```

---

## 7. AI Safety Assistant Flow

```mermaid
flowchart TD
    Input[User Question Input] --> SafetyCheck{Contains Emergency Keywords?}
    
    SafetyCheck -- "heat stroke, passed out, unconscious" --> EmergencyResponse[Trigger Emergency Alert Banner: Refer to 108/112/911 Immediately]
    
    SafetyCheck -- No --> MedCheck{Requests Medication / Diagnosis?}
    
    MedCheck -- Yes --> MedDisclaimer[Append Non-Medical Disclaimer + General Preventive Advice]
    
    MedCheck -- No --> CategoryRouter{Route Question Category}
    
    CategoryRouter -- Risk Drivers --> DriverAttribution[Explain Temperature, Humidity & Activity Impact]
    CategoryRouter -- Precautions --> HydrationGuidance[Provide NIOSH/OSHA Hydration & Shading Rules]
    CategoryRouter -- Forecast --> PeakHourAlert[Highlight Peak Heat Risk Window]
    CategoryRouter -- General --> ContextAwareResponse[Synthesize Context-Aware Guidance]
```

---

## 8. Forecast & Smart Alert Pipeline Architecture

```mermaid
flowchart TD
    ForecastFetch[Fetch 24-48h Hourly Weather from Open-Meteo] --> HourlyLoop[Iterate Hourly Records]
    HourlyLoop --> ScoreHour[Compute Risk Score for Hour]
    ScoreHour --> TimelineArray[Build Scored Forecast Timeline]
    
    TimelineArray --> AlertEngine{Check Risk Transitions}
    AlertEngine -- "Score >= 61 (HIGH / EXTREME)" --> DedupeCheck{Alert sent in last 4 hours?}
    
    DedupeCheck -- No --> GenAlert[Generate Smart Alert]
    DedupeCheck -- Yes --> Suppress[Suppress Duplicate Alert]
    
    GenAlert --> StoreAlerts[Save Notification to LocalStore / Supabase]
```

---

## 9. Community Map & Reporting Architecture

```mermaid
flowchart TD
    ReportForm[User Submits Incident] --> Sanitize[Sanitize Text & Strip HTML Script Tags]
    Sanitize --> LatLngCheck{Valid Coordinates?}
    LatLngCheck -- No --> Reject[Reject Submission]
    LatLngCheck -- Yes --> StoreReport[Store to Incidents Table / Store]
    
    StoreReport --> ClusterEngine[Spatial Cluster Detection Engine]
    ClusterEngine --> Haversine[Haversine Distance Clustering <= 0.5km]
    
    Haversine --> MapRender[Render Interactive Leaflet Map]
    MapRender --> MapPins[Category Colored Pins + Cluster Badges]
    MapRender --> CoolingPins[Verified Cooling Centers Layer]
```

---

## 10. Organization Multi-Tenant Architecture

```mermaid
flowchart LR
    subgraph Multi-Tenant Database Isolation
        RLS[Supabase Row Level Security]
        RLS --> OrgA[Org A: School Data]
        RLS --> OrgB[Org B: Worksite Data]
        RLS --> OrgC[Org C: NGO Data]
    end

    subgraph Specialized Dashboards
        OrgA --> SchoolUI[School PE Recess Rules & Recess Heat Index]
        OrgB --> WorksiteUI[Worksite NIOSH Work-Rest Ratios & Shading Schedule]
        OrgC --> NGOUI[NGO Incident Moderation & Resource Distribution]
    end

    subgraph Audit Logging
        SchoolUI --> Audit[Audit Log: Action Recorded, Passwords Redacted]
        WorksiteUI --> Audit
        NGOUI --> Audit
    end
```

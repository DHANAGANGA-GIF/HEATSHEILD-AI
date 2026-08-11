# Software Requirements Specification (SRS) — HEATSHIELD AI

## 1. System Features
- **REQ-01 (Environmental Fetch):** Integrate Open-Meteo API (`api.open-meteo.com`) for temperature, humidity, apparent temp, wind speed, pressure, and 48h forecasts.
- **REQ-02 (Heat Risk Engine):** Compute Steadman Heat Index equation with activity, duration, cooling, and age multipliers.
- **REQ-03 (Explainable AI):** Compute percentage feature importance for temperature, humidity, activity, duration, and cooling.
- **REQ-04 (Multilingual):** Support English, Tamil, and Hindi UI labels.
- **REQ-05 (Spatial Map):** Display OpenStreetMap via Leaflet with custom report markers and spatial cluster circles.
- **REQ-06 (Data Resilience):** Provide local sync store for 100% offline & local operational capability.

## 2. Non-Functional Requirements
- **NFR-01 (Performance):** Page load < 1.5s, inference latency < 50ms.
- **NFR-02 (Cost Constraint):** ₹0 operational deployment using free services.
- **NFR-03 (Accessibility):** WCAG 2.1 AA compliant color contrast & keyboard navigation.

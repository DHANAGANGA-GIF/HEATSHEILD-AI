# Product Requirements Document (PRD) — HEATSHIELD AI

## 1. Executive Summary
HeatShield AI is an operational software platform designed to convert real-time environmental meteorology and user exposure context into understandable heat-risk decision support.

## 2. Product Objectives
- Provide a clear 0-100 Heat Risk Score with 4 categories (LOW, MODERATE, HIGH, EXTREME).
- Deliver Explainable AI (XAI) feature attributions detailing exact factor weights.
- Support specialized organization dashboards for Schools, Outdoor Worksites, NGOs, and Municipal Admins.
- Maintain ₹0 operational budget using open APIs (Open-Meteo, OpenStreetMap Leaflet, Supabase free tier).

## 3. Core Persona Requirements
- **Public Users:** Real-time heat risk index, personalized hydration/shade guidance, AI safety assistant.
- **School Administrators:** Outdoor recess/sports decision rules, shade checklists.
- **Worksite Safety Officers:** OSHA/NIOSH-aligned work-rest cycle schedules (e.g. 30m work / 30m rest).
- **NGO Leaders:** Crowdsourced heat issue map, water point status tracking, cluster alerts.

## 4. Safety & Governance Principles
- Explicit disclaimer: NOT a medical diagnosis tool.
- Automatic emergency referral when acute hyperthermia symptoms are described.

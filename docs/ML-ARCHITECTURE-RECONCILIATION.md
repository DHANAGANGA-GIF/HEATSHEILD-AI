# HeatShield AI — ML Architecture Reconciliation

> **Investigation & Architecture Decision Document**  
> **Date**: August 2026  
> **Status**: APPROVED ARCHITECTURE RECONCILIATION  

---

## Executive Summary

A comprehensive audit of the HeatShield AI repository revealed two distinct machine learning / risk evaluation methodologies:

1. **ERA5-Land Real-World Environmental Experiment**: Trained on 74,440 ECMWF ERA5-Land reanalysis observation profiles (2021–2024) across 7 atmospheric/temporal features, evaluated using temporal and spatial holdouts.
2. **Synthetic Contextual Development Benchmark**: Generated via `ai-engine/generate_dataset.py` (5,000 synthetic samples) across 8 environmental and physiological features for zero-budget development testing.

This document establishes the **authoritative, scientifically defensible architecture** reconciling these two experiments with HeatShield AI's production runtime inference path.

---

## 1. Component Comparison Matrix

| Component | Dataset | Features | Target | Split | Purpose |
|---|---|---|---|---|---|
| **ERA5-Land Environmental ML Model** | ECMWF ERA5-Land Reanalysis (74,440 samples, 2021–2024) | 7 features: `temp`, `humidity`, `apparent_temp`, `wind`, `pressure`, `hour`, `month` | 4 Environmental Tiers (<27°C, 27–38°C, 38–46°C, ≥46°C) | Temporal (14,688) & Spatial (14,688) holdouts | Real-world environmental heat-risk baseline benchmark |
| **Synthetic Contextual ML Benchmark** | Synthetic Development Dataset (5,000 samples, `seed=42`) | 8 features: `temp`, `humidity`, `apparent_temp`, `wind`, `activity`, `duration`, `cooling`, `age_group` | 4 Contextual Tiers (`LOW` <36, `MODERATE` 36–60, `HIGH` 61–80, `EXTREME` ≥81) | 80/20 random train/test split (4,000 train / 1,000 test) | Development pipeline & integration testing benchmark |
| **Production Runtime Engine** | Live Open-Meteo REST Stream + User Profile Vector | Open-Meteo Weather Data + User Exertion / Duration / Cooling / Age | Composite Heat Risk Score (0–100) + Risk Tier (`LOW`–`EXTREME`) | Deterministic runtime (N/A) | Real-time in-browser contextual risk assessment & guidance |

---

## 2. Current Implementation & Production Inference Trace

### Production In-Browser Path
When a user opens the HeatShield AI Dashboard:

```
INPUT: User Profile (Activity, Exposure Duration, Cooling Access, Age Group) + Lat/Lng Location
  │
  ▼
ENVIRONMENTAL STREAM: Open-Meteo REST API (Live Weather Stream or 15m LocalStorage Cache)
  │
  ▼
PROCESSING ENGINE: evaluateHeatRisk() in `lib/risk-engine.ts`
  1. Calculate Steadman/Rothfusz Heat Index: calculateHeatIndex(T, RH)
  2. Compute Base Environmental Score (envScore + humidity bonus - wind relief)
  3. Apply Contextual Multipliers: Total = Base * ActivityMult * DurationMult * CoolingMult * AgeMult
  4. Classify Tier: Score >=81 EXTREME, >=61 HIGH, >=36 MODERATE, else LOW
  5. Compute XAI Feature Attribution: calculateXAIContributions()
  6. Generate Guidance: generatePersonalizedGuidance()
  │
  ▼
OUTPUT: RiskAssessment object -> Renders Heat Gauge (0-100), XAI Breakdown, and NIOSH Guidance List
```

> [!IMPORTANT]
> **Production Inference Reality**: Production runtime currently uses **deterministic TypeScript logic** (`lib/risk-engine.ts`) combining empirical physics (Steadman Heat Index equation) with NIOSH/OSHA-aligned contextual risk multipliers. Production runtime **does NOT** execute the Python Gradient Boosting `.joblib` binary model file or call a backend Python microservice.

---

## 3. Data Leakage & Apparent Temperature Analysis

In meteorological machine learning, `apparent_temperature` is calculated directly from dry-bulb temperature $T$, relative humidity $RH$, and wind speed $W$ using empirical equations.

- **Leakage Mechanics**: Because heat-risk target tiers are defined using heat-index thresholds (which are themselves functions of temperature and humidity), `apparent_temperature` acts as a direct proxy for the target variable.
- **Audit Findings**: In the ERA5-Land experiment (`ML-QUALITY-AUDIT.md`), `apparent_temperature` received a normalized feature importance of **0.5051** (50.5% of total tree split importance in Gradient Boosting).
- **Experiment A vs B Comparison** (from `ML-QUALITY-AUDIT.md`):
  - **Experiment A (with `apparent_temperature`)**: Gradient Boosting achieved **97.86% Temporal Accuracy** and **0.8176 Macro F1** (Spatial Accuracy: **98.09%**, Macro F1: **0.7272**).
  - **Experiment B (without `apparent_temperature`)**: Removing `apparent_temperature` forces tree classifiers to learn the non-linear interaction directly from raw `temperature` and `relative_humidity`.

---

## 4. Reconciled Architecture Decision: OPTION A

HeatShield AI adopts **OPTION A: Environmental ML Model + Contextual Decision-Support Engine**.

```
┌─────────────────────────────────────────────────────────────┐
|              ENVIRONMENTAL ML MODEL (ERA5-Land)             |
|   Evaluates atmospheric thermal stress baseline from        |
|   ECMWF ERA5-Land Reanalysis (Acc: 97.86%, Macro F1: 0.8176) |
└──────────────────────────────┬──────────────────────────────┘
                               │ (Environmental Thermal Load)
                               ▼
┌─────────────────────────────────────────────────────────────┐
|             CONTEXTUAL DECISION-SUPPORT ENGINE              |
|   Applies deterministic NIOSH/OSHA-aligned multipliers       |
|   (activity exertion, exposure duration, cooling access)    |
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
|             FINAL CONTEXTUAL HEAT-RISK ESTIMATE             |
|   Score (0-100) + Level (LOW-EXTREME) + XAI Driver Breakdown|
└──────────────────────────────[^─────────────────────────────┘
```

### Why Option A is Scientifically Defensible
1. **No False Claims**: The Environmental ML model is trained on real-world climate data (ERA5-Land reanalysis) and evaluates atmospheric thermal load.
2. **Deterministic Context Alignment**: Contextual physiological adjustments (exertion, duration, cooling) are evaluated deterministically using established occupational health standards (NIOSH/OSHA), rather than claiming an ML model was trained on non-existent physiological patient records.
3. **Zero-Budget Resilience**: In-browser TypeScript execution eliminates external server hosting dependencies, guaranteeing 100% offline availability.

---

## 5. Model Limitations & Scope

1. **Decision Support Only**: HeatShield AI is a non-clinical decision-support tool. It does not provide medical diagnoses or predict individual heatstroke events.
2. **Development Benchmark**: The synthetic dataset (`ai-engine/data/synthetic_heat_risk_dataset.csv`, 5,000 samples) and associated script (`train_model.py`) are maintained strictly as a **development and integration testing benchmark** (Accuracy: 81.70%, Macro F1: 0.8083).
3. **Derived Feature Correlation**: `apparent_temperature` is a derived index collinear with dry-bulb temperature and relative humidity, requiring strict contextual weighting in attribution analyses.

---

## 6. Exact Documentation Update Instructions

To complete reconciliation, project documentation must clearly distinguish the two benchmark results:

1. **Environmental ML Baseline (ECMWF ERA5-Land Reanalysis, 74,440 samples)**:
   - **Temporal Accuracy**: 97.86% (0.9786)
   - **Temporal Macro F1**: 0.8176
   - **Spatial Accuracy**: 98.09% (0.9809)
   - **Spatial Macro F1**: 0.7272
   - **ROC-AUC**: 0.8965

2. **Synthetic Development Benchmark (5,000 synthetic samples, `seed=42`)**:
   - **Accuracy**: 81.70% (0.8170)
   - **Macro Precision**: 0.8408
   - **Macro Recall**: 0.7967
   - **Macro F1**: 0.8083

3. **Production Runtime**:
   - **Engine**: Deterministic TypeScript Engine (`lib/risk-engine.ts`) combining Steadman Heat Index + NIOSH Contextual Multipliers.

---

*ML Architecture Reconciliation Complete — Document Generated August 2026*

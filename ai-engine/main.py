import os
import json
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

app = FastAPI(
    title="HeatShield AI - Risk Engine API",
    description="Real-Time Heat Risk Inference & Explainable AI (XAI) Microservice",
    version="1.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATHS = [
    os.path.join(BASE_DIR, 'models', 'heat_risk_gb_model.joblib'),
    os.path.join(BASE_DIR, '..', 'models', 'heat_risk_gb_model.joblib'),
    os.path.join(BASE_DIR, 'models', 'heat_risk_model.joblib')
]
REPORT_PATHS = [
    os.path.join(BASE_DIR, 'models', 'evaluation_report.json'),
    os.path.join(BASE_DIR, '..', 'models', 'evaluation_report.json')
]
SCHEMA_PATHS = [
    os.path.join(BASE_DIR, 'models', 'feature_schema.json'),
    os.path.join(BASE_DIR, '..', 'models', 'feature_schema.json')
]

model = None
for p in MODEL_PATHS:
    if os.path.exists(p):
        try:
            model = joblib.load(p)
            break
        except Exception:
            pass

evaluation_data = {}
for p in REPORT_PATHS:
    if os.path.exists(p):
        try:
            with open(p, 'r', encoding='utf-8') as f:
                evaluation_data = json.load(f)
            break
        except Exception:
            pass

feature_schema = {}
for p in SCHEMA_PATHS:
    if os.path.exists(p):
        try:
            with open(p, 'r', encoding='utf-8') as f:
                feature_schema = json.load(f)
            break
        except Exception:
            pass

class PredictRequest(BaseModel):
    temperature: float = Field(..., ge=-20.0, le=60.0, example=34.5)
    relative_humidity: float = Field(..., ge=0.0, le=100.0, example=65.0)
    wind_speed: float = Field(..., ge=0.0, le=250.0, example=12.0)
    apparent_temperature: float = Field(..., ge=-25.0, le=75.0, example=39.0)
    activity_level: int = Field(2, ge=1, le=3, description="1: Low, 2: Moderate, 3: High")
    exposure_duration: int = Field(2, ge=1, le=3, description="1: Short, 2: Moderate, 3: Long")
    cooling_access: int = Field(1, ge=1, le=3, description="1: Good, 2: Limited, 3: None")
    age_group: int = Field(1, ge=1, le=3, description="1: Adult, 2: Child, 3: Older Adult")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "HeatShield AI Risk Engine",
        "model_loaded": model is not None,
        "model_version": evaluation_data.get("model_version", "v1.3.0-prod"),
        "best_model": evaluation_data.get("best_model", "Gradient Boosting"),
        "dataset_notice": evaluation_data.get("dataset_notice", "SYNTHETIC DEVELOPMENT BENCHMARK — NON-CLINICAL")
    }

@app.get("/metrics")
def get_model_metrics():
    if not evaluation_data:
        raise HTTPException(status_code=404, detail="Model evaluation report not generated yet.")
    return evaluation_data

@app.get("/schema")
def get_feature_schema():
    if not feature_schema:
        raise HTTPException(status_code=404, detail="Feature schema not available.")
    return feature_schema

@app.post("/predict")
def predict_risk(req: PredictRequest):
    features = np.array([[
        req.temperature,
        req.relative_humidity,
        req.wind_speed,
        req.apparent_temperature,
        req.activity_level,
        req.exposure_duration,
        req.cooling_access,
        req.age_group
    ]])

    class_names = ['LOW', 'MODERATE', 'HIGH', 'EXTREME']

    if model is not None:
        predicted_class_idx = int(model.predict(features)[0])
        probabilities = model.predict_proba(features)[0].tolist()
        confidence = float(np.max(probabilities))
        model_name = evaluation_data.get("best_model", "Gradient Boosting")
    else:
        # Transparent rule-based fallback when binary model is absent
        raw = (req.apparent_temperature - 18.0) * 1.8 + (req.activity_level - 1) * 8 + (req.exposure_duration - 1) * 6
        if raw >= 81: predicted_class_idx = 3
        elif raw >= 61: predicted_class_idx = 2
        elif raw >= 36: predicted_class_idx = 1
        else: predicted_class_idx = 0
        confidence = None # Honest disclosure: uncalibrated deterministic fallback
        model_name = "Deterministic Physics-Context Fallback"

    predicted_level = class_names[predicted_class_idx]

    # Continuous composite score (0 - 100)
    base_score = (req.apparent_temperature - 15.0) * 2.1
    base_score += (req.activity_level - 1) * 9.0 + (req.exposure_duration - 1) * 7.0 + (req.cooling_access - 1) * 6.0
    calculated_score = int(np.clip(base_score, 5, 100))

    return {
        "risk_score": calculated_score,
        "risk_level": predicted_level,
        "confidence": round(confidence, 3) if confidence is not None else None,
        "model_used": model_name,
        "model_version": evaluation_data.get("model_version", "v1.3.0-prod"),
        "global_feature_importances": feature_schema.get("global_feature_importances", {}),
        "disclaimer": "This is software heat-risk decision support, not a clinical medical diagnosis."
    }

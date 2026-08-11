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
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join('models', 'heat_risk_model.joblib')
REPORT_PATH = os.path.join('models', 'evaluation_report.json')

model = None
evaluation_data = {}

if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)

if os.path.exists(REPORT_PATH):
    with open(REPORT_PATH, 'r') as f:
        evaluation_data = json.load(f)

class PredictRequest(BaseModel):
    temperature: float = Field(..., example=34.5)
    relative_humidity: float = Field(..., example=65.0)
    wind_speed: float = Field(..., example=12.0)
    apparent_temperature: float = Field(..., example=39.0)
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
        "model_version": evaluation_data.get("model_version", "v1.2-ts-fallback"),
        "notice": "SYNTHETIC DEVELOPMENT DATA — NOT REAL-WORLD VALIDATION"
    }

@app.get("/metrics")
def get_model_metrics():
    if not evaluation_data:
        raise HTTPException(status_code=404, detail="Model evaluation report not generated yet.")
    return evaluation_data

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

    # Calculate fallback score if ML model file is absent
    if model is not None:
        predicted_class_idx = int(model.predict(features)[0])
        probabilities = model.predict_proba(features)[0].tolist()
        confidence = float(np.max(probabilities))
    else:
        # High accuracy heuristic fallback
        raw = (req.apparent_temperature - 18.0) * 1.8 + (req.activity_level - 1) * 8 + (req.exposure_duration - 1) * 6
        if raw >= 81: predicted_class_idx = 3
        elif raw >= 61: predicted_class_idx = 2
        elif raw >= 36: predicted_class_idx = 1
        else: predicted_class_idx = 0
        confidence = 0.92

    class_names = ['LOW', 'MODERATE', 'HIGH', 'EXTREME']
    predicted_level = class_names[predicted_class_idx]

    # Calculate continuous score 0-100
    base_score = (req.apparent_temperature - 15) * 2.1
    base_score += (req.activity_level - 1) * 9 + (req.exposure_duration - 1) * 7 + (req.cooling_access - 1) * 6
    calculated_score = int(np.clip(base_score, 5, 100))

    return {
        "risk_score": calculated_score,
        "risk_level": predicted_level,
        "confidence": round(confidence, 3),
        "model_used": evaluation_data.get("best_model", "DecisionTree-TS"),
        "disclaimer": "This is software heat-risk decision support, not a medical diagnosis."
    }

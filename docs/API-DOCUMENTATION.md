# API Documentation — HEATSHIELD AI

## 1. Environmental Weather Ingestion
- **Endpoint:** `GET https://api.open-meteo.com/v1/forecast`
- **Params:** `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`, `hourly=...`
- **Cache Strategy:** Client-side 15-minute TTL cache in LocalStorage.
- **Fallback Response:** Returns cached snapshot with `is_cached: true` if network fails.

## 2. Risk Evaluation Engine (Internal REST / Client)
- **Inputs:** `WeatherData`, `activity_level`, `exposure_duration`, `cooling_access`, `age_group`.
- **Outputs:** `risk_score` (0-100), `risk_level` (`LOW`, `MODERATE`, `HIGH`, `EXTREME`), XAI factor breakdown.

## 3. Python ML Service (`/ai-engine`)
- **Base URL:** `http://localhost:8000`
- **`GET /health`:** Health check & model status.
- **`GET /metrics`:** Returns Accuracy, Precision, Recall, Macro F1, and Confusion Matrix.
- **`POST /predict`:** Predicts risk level & confidence.

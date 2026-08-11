# HeatShield AI — Phase 5: Forecast Timeline + Smart Alerts Validation

## 1. Forecast Data Source

- **Provider:** Open-Meteo free REST API (`api.open-meteo.com/v1/forecast`)
- **Endpoint parameters:** `hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&forecast_days=2&timezone=auto`
- **Forecast window:** 24–48 hours of hourly data, sliced to the next 24 hours from the current observation index
- **No paid APIs used.** No API key required.
- **Fallback:** `generateFallbackHourly()` in `weather-api.ts` uses diurnal temperature variation (sinusoidal peak at 14:00) when the API is unreachable — clearly labelled `CACHED`.

---

## 2. Forecast Window

| Parameter | Value |
|---|---|
| Resolution | 1 hour |
| Window | 24 hours from current time |
| Data type | Hourly environmental observations |
| UV Index | Not included (not available in free Open-Meteo hourly stream) |

---

## 3. Risk Calculation

All forecast risk scores are computed via the **frozen** `evaluateHeatRisk()` function in `lib/risk-engine.ts`. No second risk formula exists.

### Calculation flow per forecast hour:

```
HourlyForecast (temperature, humidity, apparent_temp, wind)
  ↓
WeatherData override (merged with base weather object)
  ↓
evaluateHeatRisk(overriddenWeather, userContext)
  ↓
risk_score (0–100), risk_level (LOW/MODERATE/HIGH/EXTREME)
```

### Data labels on all forecast outputs:

| Label | Condition |
|---|---|
| `CURRENT OBSERVATION` | First forecast entry (index 0) |
| `FORECAST` | Subsequent hours with live Open-Meteo data |
| `CACHED FORECAST` | Subsequent hours from stale/fallback cache |

---

## 4. Alert Rules & Thresholds

All rules are deterministic and documented. No LLM is used to decide alert generation.

| Rule ID | Condition | Priority | Thresholds |
|---|---|---|---|
| `CURRENT_EXTREME` | Current risk_score ≥ 81 | CRITICAL | Score ≥ 81 |
| `TIER_ESCALATION` | Any forecast hour ≥1 tier above current | CAUTION | Tier order: LOW < MODERATE < HIGH < EXTREME |
| `FORECAST_HIGH` | Any forecast hour score 61–80 | CAUTION | 61 ≤ score < 81 |
| `FORECAST_EXTREME` | Any forecast hour score ≥ 81 | HIGH PRIORITY | score ≥ 81 |
| `RAPID_RISE` | Score increases ≥ 20 pts within 2 hours | CAUTION | delta ≥ 20 pts in ≤ 2h window |
| `SUSTAINED_HIGH` | ≥ 3 consecutive hours at HIGH or above | HIGH PRIORITY | ≥ 3h with score ≥ 61 |
| `SUSTAINED_EXTREME` | ≥ 2 consecutive hours at EXTREME | CRITICAL | ≥ 2h with score ≥ 81 |

---

## 5. Alert Priority Levels

| Priority | Meaning |
|---|---|
| `INFO` | Informational — no immediate action required |
| `CAUTION` | Heightened attention — consider precautions |
| `HIGH PRIORITY` | Significant risk window — action recommended |
| `CRITICAL` | Severe environmental conditions — immediate action |

> [!IMPORTANT]
> No sensational language is used. Alerts describe **environmental heat-risk conditions** — not medical predictions. "Environmental heat-risk is expected to reach EXTREME" ≠ "you will get heatstroke."

---

## 6. Deduplication

- **Key format:** `{RULE_ID}__{YYYY-MM-DDTHH}` (ISO hour of affected period)
- **Cooldown window:** 60 minutes (`ALERT_COOLDOWN_MS = 3_600_000` ms)
- **Storage:** `localStorage` key `heatshield_alert_cooldowns` — map of `{ [dedup_key]: timestamp_ms }`
- **Purge:** Entries older than 24 hours are automatically purged on each cooldown save
- **Behaviour:** If a dedup key is in the active cooldown window, the corresponding alert is suppressed silently

---

## 7. Notification Behavior

- Browser notification permission is **never** auto-requested on page load
- Permission is only requested when the user explicitly clicks "Enable Browser Notifications" in the settings panel
- Default setting: `browser_notifications_enabled: false`
- If the browser does not support `Notification`, the button is hidden and a "not supported" message is shown
- If permission is denied, a browser-settings instruction is shown — no re-request is attempted

---

## 8. Failure Handling

| Scenario | Behavior |
|---|---|
| Open-Meteo API timeout/error | Returns stale localStorage cache if available; generates fallback diurnal data if not |
| `sourceStatus = 'UNAVAILABLE'` | `generateAlerts()` returns `[]` immediately — no alerts fabricated |
| Invalid/NaN forecast values | `isValidForecastEntry()` guard returns false; engine falls back to score 0, level 'LOW' |
| Empty forecast array | `scoreForecast()` returns `[]`; trend analysis returns `data_available: false` |
| Alert generation failure | UI catches error and shows "Forecast data may be unavailable" message |

---

## 9. Limitations

1. **Microclimatic precision:** Open-Meteo provides regional resolution (~1km grid). Urban heat islands and localized hot spots may differ from reported values.
2. **Forecast uncertainty:** Environmental forecasts carry inherent uncertainty increasing with time. 24-hour forecasts are presented with appropriate uncertainty language.
3. **UV index:** Not available in the free Open-Meteo hourly stream; not included in risk calculations.
4. **Non-medical:** This system does not predict, diagnose, or guarantee health outcomes. It provides environmental heat-risk decision support.

---

## 10. Tests

All 15 focused Phase 5 tests plus 25 prior tests pass (40 total).

```
✔ Forecast Engine: Valid forecast array parsed correctly
✔ Forecast Engine: Risk scores calculated via risk engine (not duplicated)
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
✔ Forecast Engine: Invalid forecast entries handled gracefully (no crash)

Total Suite: 40 tests | PASS: 40 | FAIL: 0
TypeScript: PASS (0 errors)
Build: PASS
```

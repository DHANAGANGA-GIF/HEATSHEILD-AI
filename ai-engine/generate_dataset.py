"""
HeatShield AI — Synthetic Development Benchmark Generator
=========================================================
PURPOSE:
Provides a reproducible meteorological + contextual development dataset
for training and testing baseline classifiers in environments where real-time
clinical cohort data is ethically or logistically restricted.

SCIENTIFIC NOTICE:
- SYNTHETIC DEVELOPMENT DATA — NOT REAL-WORLD CLINICAL VALIDATION
- Environmental baseline equations are grounded in NWS Steadman Heat Index models.
- Contextual multipliers reflect NIOSH/OSHA occupational heat stress recommendations.
"""

import os
import csv
import math
import random

def calculate_heat_index(T, RH):
    """NWS Steadman Rothfusz regression equation (°C)"""
    if T < 20.0:
        return T
    Tf = (T * 9.0) / 5.0 + 32.0
    HI = 0.5 * (Tf + 61.0 + (Tf - 68.0) * 1.2 + RH * 0.094)
    if HI >= 80.0:
        HI = (
            -42.379
            + 2.04901523 * Tf
            + 10.14333127 * RH
            - 0.22475541 * Tf * RH
            - 0.00683783 * Tf * Tf
            - 0.05481717 * RH * RH
            + 0.00122874 * Tf * Tf * RH
            + 0.00085282 * Tf * RH * RH
            - 0.00000199 * Tf * Tf * RH * RH
        )
        if RH < 13.0 and 80.0 <= Tf <= 112.0:
            HI -= ((13.0 - RH) / 4.0) * math.sqrt((17.0 - abs(Tf - 95.0)) / 17.0)
        elif RH > 85.0 and 80.0 <= Tf <= 87.0:
            HI += ((RH - 85.0) / 10.0) * ((87.0 - Tf) / 5.0)
    return ((HI - 32.0) * 5.0) / 9.0

def generate_dataset(num_samples=5000, seed=42):
    random.seed(seed)
    data = []

    for _ in range(num_samples):
        # Realistic seasonal terrestrial weather distributions
        temp = round(random.uniform(18.0, 48.0), 1)
        humidity = round(random.uniform(15.0, 95.0), 1)
        wind = round(random.uniform(2.0, 35.0), 1)

        # Physics-based heat index
        heat_index = round(calculate_heat_index(temp, humidity), 1)
        effective_temp = max(temp, heat_index)

        # Wind convective relief
        wind_relief = min(6.0, max(0.0, (wind - 15.0) * 0.2)) if wind > 15.0 else 0.0

        # Base atmospheric score (0 - 65 scale)
        if effective_temp <= 22.0:
            env_score = max(0.0, (effective_temp / 22.0) * 15.0)
        elif effective_temp <= 32.0:
            env_score = 15.0 + ((effective_temp - 22.0) / 10.0) * 20.0
        elif effective_temp <= 40.0:
            env_score = 35.0 + ((effective_temp - 32.0) / 8.0) * 20.0
        else:
            env_score = 55.0 + min(15.0, ((effective_temp - 40.0) / 10.0) * 15.0)

        # Humidity barrier bonus
        humidity_bonus = (humidity - 70.0) * 0.15 if humidity > 70.0 else 0.0
        base_risk = env_score + humidity_bonus - wind_relief

        # Contextual inputs:
        # 1: Low, 2: Moderate, 3: High
        activity = random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
        duration = random.choices([1, 2, 3], weights=[0.5, 0.3, 0.2])[0]
        # 1: Good, 2: Limited, 3: Prefer not to say / None
        cooling = random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
        # 1: Adult, 2: Child, 3: Older adult
        age_group = random.choices([1, 2, 3], weights=[0.6, 0.2, 0.2])[0]

        # Multipliers
        act_mult = 1.0 if activity == 1 else (1.15 if activity == 2 else 1.30)
        dur_mult = 1.0 if duration == 1 else (1.10 if duration == 2 else 1.25)
        cool_mult = 0.85 if cooling == 1 else (1.18 if cooling == 2 else 1.0)
        age_mult = 1.0 if age_group == 1 else (1.10 if age_group == 2 else 1.22)

        total_score = base_risk * act_mult * dur_mult * cool_mult * age_mult
        total_score += random.gauss(0, 1.8) # Stochastic measurement noise
        total_score = round(max(5.0, min(100.0, total_score)), 1)

        # Classification thresholds (matching occupational heat tiers)
        if total_score >= 81.0:
            risk_class = 3 # EXTREME
        elif total_score >= 61.0:
            risk_class = 2 # HIGH
        elif total_score >= 36.0:
            risk_class = 1 # MODERATE
        else:
            risk_class = 0 # LOW

        data.append({
            'temperature': temp,
            'relative_humidity': humidity,
            'wind_speed': wind,
            'apparent_temperature': heat_index,
            'activity_level': activity,
            'exposure_duration': duration,
            'cooling_access': cooling,
            'age_group': age_group,
            'risk_score': total_score,
            'risk_class': risk_class
        })

    out_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, 'synthetic_heat_risk_dataset.csv')

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    print(f"[Dataset] Generated {num_samples} samples saved to {csv_path}")
    return csv_path

if __name__ == '__main__':
    generate_dataset()

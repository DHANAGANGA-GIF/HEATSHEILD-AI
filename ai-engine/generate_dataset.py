import os
import csv
import math
import random

# SYNTHETIC DEVELOPMENT DATA — NOT REAL-WORLD VALIDATION
# Pure-Python synthetic dataset generator for zero-budget cross-platform compatibility.

def generate_dataset(num_samples=5000, seed=42):
    random.seed(seed)
    data = []

    for _ in range(num_samples):
        temp = round(random.uniform(18.0, 48.0), 1)
        humidity = round(random.uniform(15.0, 95.0), 1)
        wind = round(random.uniform(2.0, 35.0), 1)

        # Apparent Temperature estimate
        apparent_temp = round(temp + 0.33 * (humidity / 100.0 * 6.105 * math.exp((17.27 * temp) / (237.7 + temp))) - 0.7 * (wind / 3.6) - 4.0, 1)
        apparent_temp = max(temp - 2.0, min(temp + 12.0, apparent_temp))

        activity = random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
        duration = random.choices([1, 2, 3], weights=[0.5, 0.3, 0.2])[0]
        cooling = random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
        age_group = random.choices([1, 2, 3], weights=[0.2, 0.6, 0.2])[0]

        score = (apparent_temp - 18.0) * 1.8 + (activity - 1) * 8.0 + (duration - 1) * 6.0 + (cooling - 1) * 7.0 + (age_group - 1) * 5.0 + random.gauss(0, 2.5)
        score = round(max(5.0, min(100.0, score)), 1)

        if score >= 81: risk_class = 3 # EXTREME
        elif score >= 61: risk_class = 2 # HIGH
        elif score >= 36: risk_class = 1 # MODERATE
        else: risk_class = 0 # LOW

        data.append({
            'temperature': temp,
            'relative_humidity': humidity,
            'wind_speed': wind,
            'apparent_temperature': apparent_temp,
            'activity_level': activity,
            'exposure_duration': duration,
            'cooling_access': cooling,
            'age_group': age_group,
            'risk_score': score,
            'risk_class': risk_class
        })

    os.makedirs('data', exist_ok=True)
    csv_path = os.path.join('data', 'synthetic_heat_risk_dataset.csv')
    
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    print(f"Generated {num_samples} synthetic training samples saved to {csv_path}")
    return data

if __name__ == '__main__':
    generate_dataset()

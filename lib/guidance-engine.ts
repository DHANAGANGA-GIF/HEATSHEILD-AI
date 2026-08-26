import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskLevel, SafetyGuidance, WeatherData } from './types';

export function generatePersonalizedGuidance(
  riskLevel: RiskLevel,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  },
  weather: WeatherData
): SafetyGuidance[] {
  const guidance: SafetyGuidance[] = [];
  const temp = weather.temperature;
  const apparentTemp = weather.apparent_temperature;
  const humidity = weather.relative_humidity;
  const wind = weather.wind_speed;

  // 1. Hydration Precautions (tailored by risk level & humidity)
  let hydrationSimple = 'Drink 250-500ml of clean water regularly throughout the day.';
  if (riskLevel === 'LOW') {
    hydrationSimple = 'Maintain normal daily fluid intake (2-3 liters of water) and stay hydrated.';
  } else if (riskLevel === 'MODERATE') {
    hydrationSimple = 'Drink clean water regularly (250-500ml every hour) during outdoor activity.';
  } else if (riskLevel === 'HIGH') {
    hydrationSimple = 'Increase hydration frequency; drink 500ml of water or electrolyte solution every 45-60 minutes.';
  } else if (riskLevel === 'EXTREME') {
    hydrationSimple = 'Drink 500ml of cool water every 30-45 minutes regardless of thirst; avoid sugary or caffeinated drinks.';
  }

  guidance.push({
    id: 'g_hydration',
    category: 'hydration',
    title: riskLevel === 'EXTREME' || riskLevel === 'HIGH' ? 'Prioritize Hydration Schedule' : 'Maintain Regular Hydration',
    technical_text: `Maintain fluid intake of 250-500ml/hr to compensate for sweat loss under ${temp}°C / ${humidity}% RH conditions.`,
    simple_text: hydrationSimple,
    priority: riskLevel === 'EXTREME' || riskLevel === 'HIGH' ? 'urgent' : 'high',
  });

  // 2. Cooling & Shade Precautions
  let coolingSimple = 'Use shade or a cooler indoor room whenever possible to let your body cool down.';
  if (riskLevel === 'LOW') {
    coolingSimple = 'Seek shade or well-ventilated areas during prolonged midday outdoor exposure.';
  } else if (riskLevel === 'MODERATE') {
    coolingSimple = 'Take periodic recovery rest breaks in shaded, fan-cooled, or air-conditioned environments.';
  } else if (riskLevel === 'HIGH') {
    coolingSimple = 'Take 15-20 minute cooling rest breaks every hour in shaded or air-conditioned spaces.';
  } else if (riskLevel === 'EXTREME') {
    coolingSimple = 'Move into shaded, fan-cooled, or air-conditioned environments immediately; use cool damp cloths on neck and forehead.';
  }

  guidance.push({
    id: 'g_cooling',
    category: 'cooling',
    title: context.cooling === 'limited' ? 'Seek Available Shade & Cooling' : 'Utilize Active Cooling',
    technical_text: `Seek shade or cooling environments to reduce core thermal equilibrium strain at ${apparentTemp}°C heat index.`,
    simple_text: coolingSimple,
    priority: riskLevel === 'EXTREME' ? 'urgent' : 'high',
  });

  // 3. Activity & Exposure Precautions
  let exposureSimple = 'Try to do heavy outdoor work or exercise in the early morning or evening when it is cooler.';
  if (riskLevel === 'LOW') {
    exposureSimple = 'Continue normal daily activities while staying mindful of ambient temperature changes.';
  } else if (riskLevel === 'MODERATE') {
    exposureSimple = 'Avoid unnecessary prolonged direct sun exposure between 11:00 AM and 3:00 PM.';
  } else if (riskLevel === 'HIGH') {
    exposureSimple = 'Reduce strenuous outdoor physical labor and reschedule heavy exertion to early morning or evening.';
  } else if (riskLevel === 'EXTREME') {
    exposureSimple = 'Avoid or postpone strenuous outdoor activity; closely follow workplace/school heat-safety protocols.';
  }

  guidance.push({
    id: 'g_exposure',
    category: 'exposure',
    title: 'Adjust Exposure Timing & Activity Level',
    technical_text: `Modify physical work-rest cycles for ${context.activity} work in ${temp}°C environment.`,
    simple_text: exposureSimple,
    priority: riskLevel === 'EXTREME' ? 'urgent' : 'medium',
  });

  // 4. Clothing, Sun Protection & Ventilation
  let protectionSimple = 'Wear lightweight, light-colored, loose-fitting cotton clothing and a wide-brimmed hat outdoors.';
  if (temp > 35 || apparentTemp > 40) {
    protectionSimple = 'Wear loose, light-colored breathable clothing, UV sunglasses, and broad-spectrum sunscreen when outdoors.';
  } else if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
    protectionSimple = 'Use sun protection (hat, umbrella, sunscreen) and keep living spaces ventilated with fans or open windows.';
  }

  guidance.push({
    id: 'g_protection',
    category: 'exposure',
    title: 'Sun Protection & Breathable Attire',
    technical_text: `Utilize high-albedo, breathable fabrics and UV protective barriers for ${temp}°C solar thermal exposure.`,
    simple_text: protectionSimple,
    priority: 'medium',
  });

  // 5. Symptom Recognition & Emergency Vigilance
  let symptomSimple = 'Monitor for heat strain warning signs: heavy sweating, headache, dizziness, nausea, or muscle cramps.';
  if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
    symptomSimple = 'Watch for heat illness warning signs: dizziness, nausea, rapid pulse, or extreme weakness. Rest in a cool place immediately if felt.';
  }

  guidance.push({
    id: 'g_symptoms',
    category: 'rest',
    title: 'Heat Strain Symptom Recognition',
    technical_text: 'Active physiological surveillance for heat cramps, heat exhaustion, and elevated heart rate.',
    simple_text: symptomSimple,
    priority: riskLevel === 'EXTREME' ? 'urgent' : 'high',
  });

  // 6. Driver-specific Precautions
  if (apparentTemp - temp >= 3 || apparentTemp > 36) {
    guidance.push({
      id: 'g_apparent_driver',
      category: 'cooling',
      title: 'High Apparent Thermal Load',
      technical_text: `Apparent temperature (${apparentTemp}°C) exceeds ambient air temp (${temp}°C), elevating heat strain.`,
      simple_text: `Heat index alert: The air feels like ${apparentTemp}°C. Account for extra heat strain and take earlier rest breaks.`,
      priority: 'high',
    });
  }

  if (humidity > 65) {
    guidance.push({
      id: 'g_humidity_driver',
      category: 'exposure',
      title: 'High Relative Humidity Caution',
      technical_text: `Relative humidity at ${humidity}% impairs sweat evaporation.`,
      simple_text: `High humidity (${humidity}%) prevents sweat from evaporating efficiently. Pace yourself and allow extra cooling time.`,
      priority: 'medium',
    });
  }

  if (wind < 10 && temp > 30) {
    guidance.push({
      id: 'g_wind_driver',
      category: 'cooling',
      title: 'Low Wind Circulation',
      technical_text: `Wind speed of ${wind} km/h provides minimal convective heat dissipation.`,
      simple_text: `Low wind movement (${wind} km/h) limits natural cooling. Use fans or rest in well-ventilated shade.`,
      priority: 'medium',
    });
  }

  // 7. Vulnerable Group & Community Check-in Precautions
  if (
    context.age_group === 'older_adult' ||
    context.age_group === 'child' ||
    riskLevel === 'HIGH' ||
    riskLevel === 'EXTREME' ||
    guidance.length < 5
  ) {
    guidance.push({
      id: 'g_vulnerable',
      category: 'community',
      title: 'Vulnerable Person Safety & Monitoring',
      technical_text: 'Monitor vulnerable individuals for heat exhaustion symptoms (dizziness, rapid pulse, weakness).',
      simple_text: 'Check in on children, elderly relatives, and neighbours to ensure they have access to cool water and shaded spaces.',
      priority: 'medium',
    });
  }

  // Cap at 7 precautions max per Phase 10
  return guidance.slice(0, 7);
}

export const MEDICAL_SAFETY_DISCLAIMER =
  'This safety guidance is generated for general heat awareness based on environmental conditions. It is not a medical diagnosis, treatment evaluation, or clinical advice. Consult qualified medical personnel for health concerns.';



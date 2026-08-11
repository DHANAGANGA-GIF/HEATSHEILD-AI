import { RiskAssessment, TechMode, WeatherData } from './types';

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  is_emergency_warning?: boolean;
  data_status?: 'LIVE' | 'CACHED' | 'UNAVAILABLE';
}

export const SUGGESTED_QUESTIONS = [
  'Why is my risk high?',
  'What are my main risk factors?',
  'What should I do now?',
  'When is the risk expected to be highest?',
];

export function generateAssistantResponse(
  userQuery: string,
  currentRisk?: RiskAssessment | null,
  currentWeather?: WeatherData | null,
  mode: TechMode = 'technical'
): AssistantMessage {
  const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const queryLower = (userQuery || '').trim().toLowerCase();

  // Handle empty input
  if (!queryLower) {
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: 'Please ask a question about your heat risk, current weather, or recommended safety precautions.',
      timestamp: timestampStr,
      data_status: 'UNAVAILABLE',
    };
  }

  // 1. Emergency Medical / Safety Guardrail Check
  const emergencyKeywords = [
    'fainted', 'fainting', 'unconscious', 'chest pain', 'seizure', 'confusion',
    'stopped sweating', 'vomiting', 'high fever', 'passing out', 'passed out', 'emergency',
    'severe dizziness', 'heat stroke', 'heatstroke', 'hallucinating', 'convulsions'
  ];

  const hasEmergencySignal = emergencyKeywords.some((kw) => queryLower.includes(kw));

  if (hasEmergencySignal) {
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: mode === 'technical'
        ? `⚠️ EMERGENCY REFERRAL NOTICE: The symptoms described may indicate severe acute hyperthermia or a medical emergency. HeatShield AI is a decision-support software system and DOES NOT perform medical diagnosis or replace emergency medical professionals.

ACTION REQUIRED:
• Seek immediate emergency medical assistance (e.g. Call 108 / 112 / 911).
• Move the individual to a cool, shaded, or air-conditioned environment immediately.
• Apply cool water to skin/clothing and circulate air with a fan.
• If conscious and able to swallow, offer small sips of cool water. Do not give fluids if unconscious.
• Do not administer antipyretics or medication without medical supervision.`
        : `⚠️ PLEASE SEEK IMMEDIATE EMERGENCY HELP: The symptoms you described could be serious heat-related illness.

WHAT TO DO RIGHT NOW:
1. Call emergency services (108 / 112 / 911) immediately.
2. Move to a shaded, cool area or air-conditioned space.
3. Put cool water on skin and clothes to cool down.
4. Give sips of cool water ONLY if conscious and alert.

HeatShield AI cannot diagnose medical conditions or replace a doctor.`,
      timestamp: timestampStr,
      is_emergency_warning: true,
      data_status: 'LIVE',
    };
  }

  // Medical Diagnosis & Medication Guardrail Check
  const medicalKeywords = ['medication', 'medicine', 'dosage', 'pills', 'drug', 'prescription', 'diagnose', 'diagnosis', 'cure me'];
  const hasMedicalQuery = medicalKeywords.some((kw) => queryLower.includes(kw));

  if (hasMedicalQuery) {
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `⚠️ MEDICAL & MEDICATION DISCLAIMER: HeatShield AI is an environmental heat-risk decision-support system. It DOES NOT perform medical diagnoses, prescribe medications, or provide dosage advice.

RECOMMENDED ACTION:
• Please consult a licensed medical doctor or healthcare professional for clinical diagnosis or medication guidance.
• For acute heat symptoms (severe dizziness, confusion, high body temperature), seek emergency medical care immediately (108 / 112 / 911).`,
      timestamp: timestampStr,
      is_emergency_warning: true,
      data_status: 'LIVE',
    };
  }

  // Determine Data Status
  const isDataAvailable = !!(currentWeather && currentRisk);
  const dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE' = !isDataAvailable
    ? 'UNAVAILABLE'
    : currentWeather.is_cached
    ? 'CACHED'
    : 'LIVE';

  // 2. Handle missing environmental/risk data
  if (!isDataAvailable || !currentWeather || !currentRisk) {
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `CURRENT CONDITIONS
→ Environmental observation data is currently unavailable.

RISK
→ Heat risk assessment cannot be computed without weather data.

MAIN DRIVERS
→ Data unavailable.

ACTION
→ Follow general heat safety guidelines: stay hydrated, seek shade, and avoid prolonged outdoor exertion during peak afternoon hours.

DATA STATUS
→ UNAVAILABLE`,
      timestamp: timestampStr,
      data_status: 'UNAVAILABLE',
    };
  }

  const locationName = currentWeather.location?.name || 'your location';
  const temp = currentWeather.temperature;
  const appTemp = currentWeather.apparent_temperature;
  const humidity = currentWeather.relative_humidity;
  const wind = currentWeather.wind_speed;
  const score = currentRisk.risk_score;
  const level = currentRisk.risk_level;
  const drivers = currentRisk.factors || [];

  // Determine requested mode override if specified in query
  const effectiveMode = queryLower.includes('simply') || queryLower.includes('simple')
    ? 'simple'
    : queryLower.includes('technically') || queryLower.includes('technical')
    ? 'technical'
    : mode;

  // 3. Question Routing

  // Routing A: "Why is my risk high?" / "What is causing my current risk?" / "Explain my risk"
  if (
    queryLower.includes('why') ||
    queryLower.includes('causing') ||
    queryLower.includes('cause') ||
    queryLower.includes('explain') ||
    queryLower.includes('driver') ||
    queryLower.includes('factor')
  ) {
    const topDriversText = drivers.length > 0
      ? drivers.map((f, i) => `${i + 1}. **${f.name}** (${f.weight_percent}% impact): ${effectiveMode === 'technical' ? f.description_technical : f.description_simple}`).join('\n')
      : (effectiveMode === 'technical' ? 'High ambient air temperature and heat index.' : 'Hot temperature and sun exposure.');

    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: effectiveMode === 'technical'
        ? `CURRENT CONDITIONS
→ Air Temp: ${temp}°C | Apparent Temp: ${appTemp}°C | Relative Humidity: ${humidity}% | Wind: ${wind} km/h | Location: ${locationName}

RISK
→ Level: ${level} | Score: ${score}/100

MAIN DRIVERS
${topDriversText}

ACTION
→ Refer to recommendations for targeted mitigation.

DATA STATUS
→ ${dataStatus}`
        : `CURRENT CONDITIONS
→ It is ${temp}°C (feels like ${appTemp}°C) with ${humidity}% humidity in ${locationName}.

RISK
→ Your Heat Risk is ${level} (${score}/100).

MAIN DRIVERS
${topDriversText}

ACTION
→ Stay in shaded/cool areas, drink water regularly, and avoid heavy activity.

DATA STATUS
→ ${dataStatus}`,
      timestamp: timestampStr,
      data_status: dataStatus,
    };
  }

  // Routing B: "What precautions should I take?" / "What should I do right now?" / "How can I reduce heat exposure?"
  if (
    queryLower.includes('precaution') ||
    queryLower.includes('do right now') ||
    queryLower.includes('do now') ||
    queryLower.includes('what should i do') ||
    queryLower.includes('reduce') ||
    queryLower.includes('guidance') ||
    queryLower.includes('action') ||
    queryLower.includes('protect')
  ) {
    const recs = currentRisk.recommendations || [];
    const actionText = recs.length > 0
      ? recs.slice(0, 4).map((r, i) => `${i + 1}. **${r.title}**: ${effectiveMode === 'technical' ? r.technical_text : r.simple_text}`).join('\n')
      : `1. **Hydration**: Drink 250-500ml of water hourly.\n2. **Cooling**: Rest in shaded or air-conditioned spaces.\n3. **Exposure Limit**: Limit continuous direct outdoor sun exposure.`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `CURRENT CONDITIONS
→ ${temp}°C (Feels like ${appTemp}°C), ${humidity}% RH at ${locationName}.

RISK
→ Level: ${level} (${score}/100)

ACTION
${actionText}

DATA STATUS
→ ${dataStatus}`,
      timestamp: timestampStr,
      data_status: dataStatus,
    };
  }

  // Routing C: "When will the risk be highest?" / "Is the current period higher risk?" / "Forecast"
  if (
    queryLower.includes('when') ||
    queryLower.includes('peak') ||
    queryLower.includes('time') ||
    queryLower.includes('forecast') ||
    queryLower.includes('higher risk') ||
    queryLower.includes('period')
  ) {
    const hourly = currentWeather.hourly_forecast;
    let forecastSection = '';

    if (hourly && hourly.length > 0) {
      const sorted = [...hourly].sort((a, b) => b.apparent_temperature - a.apparent_temperature);
      const peak = sorted[0];
      const peakTime = new Date(peak.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      forecastSection = effectiveMode === 'technical'
        ? `Forecast analysis indicates peak thermal load at ~${peakTime} with temperature reaching ${peak.temperature}°C (Apparent: ${peak.apparent_temperature}°C). Highest risk hours typically occur between 11:30 AM and 4:30 PM.`
        : `The highest risk period today is expected around ${peakTime} when it feels like ${peak.apparent_temperature}°C. The hottest hours are usually 11:30 AM to 4:30 PM.`;
    } else {
      forecastSection = `Forecast information is currently unavailable for ${locationName}. Typically, heat stress peaks between 11:30 AM and 4:30 PM.`;
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `CURRENT CONDITIONS
→ Current: ${temp}°C (Apparent: ${appTemp}°C) at ${locationName}

RISK
→ Current Risk: ${level} (${score}/100)

FORECAST
→ ${forecastSection}

DATA STATUS
→ ${hourly && hourly.length > 0 ? dataStatus : 'UNAVAILABLE'}`,
      timestamp: timestampStr,
      data_status: dataStatus,
    };
  }

  // Routing D: Default / General HeatShield questions
  const recsSummary = (currentRisk.recommendations || []).slice(0, 2).map((r) => `• ${r.title}`).join('\n');
  return {
    id: `msg_${Date.now()}`,
    sender: 'assistant',
    text: effectiveMode === 'technical'
      ? `CURRENT CONDITIONS
→ Air Temp: ${temp}°C | Apparent Temp: ${appTemp}°C | Relative Humidity: ${humidity}% | Location: ${locationName}

RISK
→ Risk Level: ${level} | Score: ${score}/100 | Data Quality: ${currentRisk.data_quality}

MAIN DRIVERS
${drivers.slice(0, 2).map(d => `• ${d.name} (${d.weight_percent}% impact)`).join('\n') || '• Thermal index'}

ACTION
${recsSummary || '• Follow standard heat mitigation protocols.'}

DATA STATUS
→ ${dataStatus}`
      : `CURRENT CONDITIONS
→ It is ${temp}°C (feels like ${appTemp}°C) with ${humidity}% humidity in ${locationName}.

RISK
→ Your current Heat Risk is ${level} (${score}/100).

ACTION
${recsSummary || '• Drink plenty of water and stay out of direct sun.'}

DATA STATUS
→ ${dataStatus}`,
    timestamp: timestampStr,
    data_status: dataStatus,
  };
}

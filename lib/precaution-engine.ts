/**
 * HeatShield AI — Real-Time Contextual Precaution Engine (v2.1)
 *
 * Generates targeted, priority-ranked precautions derived strictly from:
 * 1. Current ambient temperature & apparent feels-like temperature
 * 2. Relative humidity (evaporative cooling limitation)
 * 3. Wind speed (convective cooling vs stagnation)
 * 4. User context (physical activity level, exposure duration, cooling access)
 * 5. Hourly forecast trajectory (upcoming peak heat detection)
 * 6. Multilingual translations (en, te, ta, hi)
 *
 * Strictly adheres to rule: No generic hardcoded paragraphs; only actual triggered conditions.
 */

import { Language } from './types';

export interface PrecautionInput {
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  windSpeed: number;
  activity?: 'low' | 'moderate' | 'high' | 'very_high';
  exposure?: 'indoors' | 'occasional' | 'work' | 'physical' | 'extended';
  cooling?: 'good' | 'limited' | 'none';
  riskScore: number;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  forecast?: Array<{
    time: string;
    temperature: number;
    apparentTemperature: number;
    humidity?: number;
    riskScore?: number;
    riskLevel?: string;
  }>;
  language?: Language;
}

export interface PrecautionOutput {
  priority: string[]; // Curated top 3-5 precautions
  immediate: string[]; // Immediate actions required right now
  upcoming: string[]; // Forecast-aware warnings (only if supported by data)
  reasons: string[]; // Specific environmental & contextual triggers
  language: Language;
}

// ── Translation Dictionaries for Dynamic Triggers ───────────────────────────

const DICTIONARY: Record<
  Language,
  {
    hydration_routine: string;
    hydration_urgent: string;
    humidity_evap: string;
    shade_move: string;
    shade_seek: string;
    activity_reduce: string;
    activity_stop: string;
    exposure_limit: string;
    cooling_find: string;
    clothing_light: string;
    vulnerable_check: string;
    forecast_warning_high: (timeStr: string) => string;
    forecast_warning_extreme: (timeStr: string) => string;
    reason_high_temp: (t: number) => string;
    reason_high_apparent: (at: number) => string;
    reason_high_humidity: (h: number) => string;
    reason_stagnant_air: (w: number) => string;
    reason_heavy_activity: string;
    reason_prolonged_exposure: string;
    reason_limited_cooling: string;
    reason_peak_approaching: (level: string) => string;
  }
> = {
  en: {
    hydration_routine: 'Drink 250-500ml of clean water regularly every 30-45 minutes.',
    hydration_urgent: 'Increase fluid intake immediately. Hydrate continuously before feeling thirsty.',
    humidity_evap: 'High humidity is suppressing sweat evaporation. Seek active ventilation or fan-assisted cooling.',
    shade_move: 'Move to a shaded or cooler indoor space to lower direct radiant heat exposure.',
    shade_seek: 'Avoid direct sun. Relocate immediately to an air-cooled or shaded shelter.',
    activity_reduce: 'Reduce strenuous physical exertion and schedule mandatory 15-minute rest breaks.',
    activity_stop: 'Cease heavy outdoor labor during peak thermal hours. Postpone non-essential exertion.',
    exposure_limit: 'Limit continuous outdoor exposure to 20-30 minute intervals.',
    cooling_find: 'Cooling access is limited: locate the nearest public cooling center or shaded rest area.',
    clothing_light: 'Wear loose-fitting, breathable, light-colored cotton clothing and UV-protective headgear.',
    vulnerable_check: 'Check on children and older adults to ensure continuous hydration and cool resting spaces.',
    forecast_warning_high: (time) => `Heat risk is forecast to reach HIGH within the next 2 hours (around ${time}). Plan indoor respite.`,
    forecast_warning_extreme: (time) => `CRITICAL: Heat risk is forecast to escalate to EXTREME within the next 2 hours (${time}). Plan to halt strenuous outdoor work.`,
    reason_high_temp: (t) => `Elevated ambient temperature (${t}°C) exceeds thermal comfort baseline.`,
    reason_high_apparent: (at) => `Apparent temperature feels like ${at}°C due to combined heat and moisture.`,
    reason_high_humidity: (h) => `Relative humidity at ${h}% significantly limits natural sweat evaporation.`,
    reason_stagnant_air: (w) => `Low wind speed (${w} km/h) reduces convective cooling relief.`,
    reason_heavy_activity: 'Physical exertion accelerates internal metabolic heat generation.',
    reason_prolonged_exposure: 'Continuous outdoor presence accumulates dangerous thermal load.',
    reason_limited_cooling: 'Restricted access to air conditioning or fan cooling impairs core temperature recovery.',
    reason_peak_approaching: (level) => `Forecast models indicate impending peak thermal load (${level}).`,
  },
  te: {
    hydration_routine: 'ప్రతి 30-45 నిమిషాలకు క్రమం తప్పకుండా 250-500 మి.లీ శుభ్రమైన నీరు త్రాగండి.',
    hydration_urgent: 'వెంటనే ద్రవాలు తీసుకోవడం పెంచండి. దాహం వేయకపోయినా నిరంతరం నీరు త్రాగండి.',
    humidity_evap: 'అధిక తేమ వల్ల చెమట ఆవిరి కావడం తగ్గుతుంది. ఫ్యాన్ లేదా వెంటిలేషన్ ఉన్న ప్రదేశాన్ని ఆశ్రయించండి.',
    shade_move: 'ఎండ ప్రభావాన్ని తగ్గించడానికి నీడ ఉన్న లేదా చల్లని గదిలోకి మారండి.',
    shade_seek: 'ప్రత్యక్ష సూర్యరశ్మిని నివారించండి. వెంటనే శీతల లేదా నీడ ఆశ్రయానికి వెళ్లండి.',
    activity_reduce: 'శారీరక శ్రమను తగ్గించండి మరియు ప్రతి గంటకు 15 నిమిషాల విశ్రాంతి తీసుకోండి.',
    activity_stop: 'తీవ్రమైన ఎండ వేళల్లో భారీ బహిరంగ పనులను ఆపండి లేదా వాయిదా వేయండి.',
    exposure_limit: 'బయట నిరంతరంగా ఉండే సమయాన్ని 20-30 నిమిషాలకు మాత్రమే పరిమితం చేయండి.',
    cooling_find: 'చల్లబడే సౌకర్యం తక్కువగా ఉంది: సమీపంలోని పబ్లిక్ కూలింగ్ లేదా నీడ కేంద్రాన్ని గుర్తించండి.',
    clothing_light: 'వదులుగా ఉండే, తేలికపాటి లేత రంగు కాటన్ దుస్తులు మరియు టోపీ ధరించండి.',
    vulnerable_check: 'పిల్లలు, వృద్ధుల ఆరోగ్యాన్ని పర్యవేక్షించండి; వారు చల్లని ప్రదేశంలో ఉండేలా చూడండి.',
    forecast_warning_high: (time) => `రాబోయే 2 గంటల్లో (${time} ప్రాంతంలో) వేడి ప్రమాదం 'అధికం' స్థాయికి చేరవచ్చు.`,
    forecast_warning_extreme: (time) => `అత్యవసరం: రాబోయే 2 గంటల్లో (${time}) వేడి తీవ్ర స్థాయికి చేరనుంది. బయటి శ్రమను నివారించండి.`,
    reason_high_temp: (t) => `పరిసర ఉష్ణోగ్రత (${t}°C) సాధారణ పరిమితిని మించిపోయింది.`,
    reason_high_apparent: (at) => `వాతావరణం ${at}°C అనిపించేంత తీవ్రమైన ఉక్కపోతను సృష్టిస్తోంది.`,
    reason_high_humidity: (h) => `${h}% తేమ వల్ల చెమట ఆవిరి కావడం తగ్గి శరీరం వేడెక్కుతుంది.`,
    reason_stagnant_air: (w) => `గాలి వేగం తక్కువగా (${w} కి.మీ/గం) ఉండటం వల్ల చల్లదనం లభించదు.`,
    reason_heavy_activity: 'శారీరక శ్రమ శరీర అంతర్గత వేడిని వేగంగా పెంచుతోంది.',
    reason_prolonged_exposure: 'ఎండలో ఎక్కువసేపు ఉండటం వల్ల శరీరంలో వేడి పేరుకుపోతుంది.',
    reason_limited_cooling: 'చల్లని సౌకర్యాలు లేకపోవడం శరీర ఉష్ణోగ్రత సాధారణ స్థితికి రావడాన్ని అడ్డుకుంటుంది.',
    reason_peak_approaching: (level) => `ఫోర్‌కాస్ట్ ప్రకారం త్వరలోనే గరిష్ట వేడి (${level}) నమోదు కానుంది.`,
  },
  ta: {
    hydration_routine: 'ஒவ்வொரு 30-45 நிமிடங்களுக்கும் 250-500 மி.லி சுத்தமான குடிநீர் அருந்துங்கள்.',
    hydration_urgent: 'உடனடியாக நீர் அருந்துவதை அதிகரிக்கவும். தாகத்திற்காக காத்திருக்காமல் குடிக்கவும்.',
    humidity_evap: 'அதிக ஈரப்பதம் வியர்வை ஆவியாவதைத் தடுக்கிறது. மின்விசிறி அல்லது காற்று வீசும் இடத்தில் இருங்கள்.',
    shade_move: 'நேரடி வெப்பத்தை குறைக்க நிழலான அல்லது குளிர்ச்சியான இடத்திற்கு செல்லவும்.',
    shade_seek: 'நேரடி வெயிலைத் தவிர்க்கவும். உடனடியாகக் குளிர்ந்த அல்லது நிழல் பகுதிக்கு மாறவும்.',
    activity_reduce: 'கடுமையான உடல் உழைப்பைக் குறைத்து, 15 நிமிட ஓய்வு இடைவெளிகளை எடுக்கவும்.',
    activity_stop: 'உச்ச வெயில் நேரத்தில் வெளியில் செய்யும் கடின வேலைகளை நிறுத்துங்கள்.',
    exposure_limit: 'வெளியில் இருக்கும் நேரத்தை 20-30 நிமிடங்களாகக் கட்டுப்படுத்துங்கள்.',
    cooling_find: 'குளிரூட்டும் வசதி குறைவு: அருகிலுள்ள பொது நிழல் மையம் அல்லது குடிநீர் பகுதியை அடையவும்.',
    clothing_light: 'மெல்லிய, தளர்வான, வெளிர் நிற பருத்தி ஆடைகளையும் தொப்பியையும் அணியுங்கள்.',
    vulnerable_check: 'குழந்தைகள் மற்றும் முதியவர்கள் தொடர்ந்து நீர் அருந்துவதையும் நிழலில் இருப்பதையும் உறுதிசெய்யவும்.',
    forecast_warning_high: (time) => `அடுத்த 2 மணி நேரத்தில் (${time} அளவில்) வெப்ப ஆபத்து 'அதிகம்' நிலையை எட்டக்கூடும்.`,
    forecast_warning_extreme: (time) => `எச்சரிக்கை: அடுத்த 2 மணி நேரத்தில் (${time}) வெப்பம் தீவிர நிலையை எட்டக்கூடும். வெயில் வேலைகளைத் தவிர்க்கவும்.`,
    reason_high_temp: (t) => `சுற்றுப்புற வெப்பநிலை (${t}°C) இயல்பை விட அதிகமாக உள்ளது.`,
    reason_high_apparent: (at) => `வெப்பமும் ஈரப்பதமும் சேர்ந்து ${at}°C அளவில் உணரப்படுகிறது.`,
    reason_high_humidity: (h) => `${h}% ஈரப்பதம் இயற்கையான வியர்வை ஆவியாதலைத் தடுக்கிறது.`,
    reason_stagnant_air: (w) => `குறைந்த காற்று வேகம் (${w} கி.மீ/மணி) வெப்பத் தணிப்பைக் குறைக்கிறது.`,
    reason_heavy_activity: 'கடுமையான உழைப்பு உடலின் உட்புற வெப்பத்தை அதிகரிக்கிறது.',
    reason_prolonged_exposure: 'வெயிலில் அதிக நேரம் இருப்பது உடலில் வெப்பத் தாக்கத்தை உண்டாக்குகிறது.',
    reason_limited_cooling: 'குளிரூட்டும் வசதி இல்லாததால் உடல் சூடு குறைய தாமதமாகிறது.',
    reason_peak_approaching: (level) => `வானிலை முன்னறிவிப்புபடி விரைவில் உச்ச வெப்ப நிலை (${level}) ஏற்படும்.`,
  },
  hi: {
    hydration_routine: 'हर 30-45 मिनट में नियमित रूप से 250-500 मिलीलीटर स्वच्छ पानी पिएं।',
    hydration_urgent: 'तरल पदार्थों का सेवन तुरंत बढ़ाएं। प्यास लगने का इंतजार न करें, पानी पीते रहें।',
    humidity_evap: 'हवा में अधिक नमी के कारण पसीना नहीं सूख पा रहा है। पंखे या हवादार जगह पर रहें।',
    shade_move: 'सीधी धूप से बचने के लिए छायादार या ठंडे कमरे में चले जाएँ।',
    shade_seek: 'धूप से बचें। तुरंत किसी वातानुकूलित या छायादार आश्रय में जाएँ।',
    activity_reduce: 'भारी शारीरिक मेहनत कम करें और हर घंटे 15 मिनट का विश्राम अवश्य लें।',
    activity_stop: 'कड़क धूप के समय बाहर का भारी काम तुरंत रोकें या स्थगित करें।',
    exposure_limit: 'धूप में लगातार रहने के समय को 20-30 मिनट तक सीमित रखें।',
    cooling_find: 'ठंडक की सुविधा सीमित है: नजदीकी सार्वजनिक शीतलन केंद्र या पेयजल केंद्र का पता लगाएं।',
    clothing_light: 'ढीले, हल्के और हल्के रंग के सूती कपड़े और धूप से बचाने वाली टोपी पहनें।',
    vulnerable_check: 'बच्चों और बुजुर्गों की विशेष देखभाल करें; सुनिश्चित करें कि वे ठंडी जगह पर रहें और पानी पिएं।',
    forecast_warning_high: (time) => `अगले 2 घंटों में (${time} के आसपास) गर्मी का जोखिम 'उच्च' स्तर तक पहुंचने का अनुमान है।`,
    forecast_warning_extreme: (time) => `अत्यंत गंभीर: अगले 2 घंटों में (${time}) गर्मी 'अत्यधिक' स्तर पर पहुंच सकती है। बाहर के काम तुरंत रोकें।`,
    reason_high_temp: (t) => `परिवेश का तापमान (${t}°C) सामान्य से काफी अधिक है।`,
    reason_high_apparent: (at) => `गर्मी और नमी के कारण महसूस होने वाला तापमान ${at}°C है।`,
    reason_high_humidity: (h) => `${h}% नमी के कारण शरीर का प्राकृतिक पसीना सूखना बाधित हो रहा है।`,
    reason_stagnant_air: (w) => `धीमी हवा (${w} किमी/घंटा) से ठंडक का प्रभाव कम हो रहा है।`,
    reason_heavy_activity: 'शारीरिक श्रम से शरीर की आंतरिक गर्मी तेजी से बढ़ रही है।',
    reason_prolonged_exposure: 'धूप में लंबे समय तक रहने से शरीर पर थर्मल तनाव जमा हो रहा है।',
    reason_limited_cooling: 'ठंडक की सीमित सुविधा के कारण शरीर का तापमान सामान्य होने में बाधा आ रही है।',
    reason_peak_approaching: (level) => `मौसम पूर्वानुमान के अनुसार आगामी घंटों में पीक गर्मी (${level}) आने वाली है।`,
  },
};

/**
 * Computes targeted precautions strictly based on actual conditions.
 */
export function getPrecautions(input: PrecautionInput): PrecautionOutput {
  const lang: Language = input.language && DICTIONARY[input.language] ? input.language : 'en';
  const dict = DICTIONARY[lang];

  const immediate: string[] = [];
  const upcoming: string[] = [];
  const reasons: string[] = [];

  const temp = input.temperature;
  const apparent = input.apparentTemperature;
  const humidity = input.humidity;
  const wind = input.windSpeed;
  const activity = input.activity || 'moderate';
  const exposure = input.exposure || 'occasional';
  const cooling = input.cooling || 'good';
  const riskScore = input.riskScore;

  // ── 1. Reasons and Trigger Conditions ─────────────────────────────────────

  if (temp >= 35) {
    reasons.push(dict.reason_high_temp(Math.round(temp * 10) / 10));
  }
  if (apparent >= 38) {
    reasons.push(dict.reason_high_apparent(Math.round(apparent * 10) / 10));
  }
  if (humidity >= 65 && temp >= 30) {
    reasons.push(dict.reason_high_humidity(Math.round(humidity)));
  }
  if (wind <= 6 && temp >= 32) {
    reasons.push(dict.reason_stagnant_air(Math.round(wind * 10) / 10));
  }
  if (activity === 'high' || activity === 'very_high') {
    reasons.push(dict.reason_heavy_activity);
  }
  if (exposure === 'work' || exposure === 'physical' || exposure === 'extended') {
    reasons.push(dict.reason_prolonged_exposure);
  }
  if (cooling === 'limited' || cooling === 'none') {
    reasons.push(dict.reason_limited_cooling);
  }

  // Fallback reason if conditions are mild
  if (reasons.length === 0) {
    reasons.push(
      lang === 'te'
        ? 'ప్రస్తుత వాతావరణం సాధారణ పరిమితుల్లో ఉంది.'
        : lang === 'ta'
        ? 'தற்போதைய வானிலை இயல்பான அளவில் உள்ளது.'
        : lang === 'hi'
        ? 'वर्तमान पर्यावरणीय स्थितियां सामान्य सीमा के भीतर हैं।'
        : 'Current environmental observations are within stable baseline limits.'
    );
  }

  // ── 2. Immediate Targeted Precautions ─────────────────────────────────────

  // Hydration tier
  if (riskScore >= 70 || apparent >= 40) {
    immediate.push(dict.hydration_urgent);
  } else {
    immediate.push(dict.hydration_routine);
  }

  // Shade & Shelter tier
  if (riskScore >= 75 || temp >= 39) {
    immediate.push(dict.shade_seek);
  } else if (riskScore >= 45 || temp >= 34) {
    immediate.push(dict.shade_move);
  }

  // Humidity / Evaporative Cooling tier
  if (humidity >= 65 && temp >= 30) {
    immediate.push(dict.humidity_evap);
  }

  // Activity / Exertion tier
  if (activity === 'high' || activity === 'very_high' || riskScore >= 75) {
    if (riskScore >= 80) {
      immediate.push(dict.activity_stop);
    } else {
      immediate.push(dict.activity_reduce);
    }
  }

  // Exposure duration tier
  if (exposure === 'work' || exposure === 'physical' || exposure === 'extended') {
    immediate.push(dict.exposure_limit);
  }

  // Cooling access tier
  if (cooling === 'limited' || cooling === 'none') {
    immediate.push(dict.cooling_find);
  }

  // Protective clothing
  if (riskScore >= 50 && immediate.length < 5) {
    immediate.push(dict.clothing_light);
  }

  // Vulnerable group safeguard
  if (riskScore >= 65 && immediate.length < 5) {
    immediate.push(dict.vulnerable_check);
  }

  // ── 3. Forecast-Aware Upcoming Warnings ───────────────────────────────────
  // Inspect the next 2-4 hours from actual forecast array
  if (input.forecast && Array.isArray(input.forecast) && input.forecast.length > 0) {
    const upcomingPoints = input.forecast.slice(0, 4); // Next 4 hours
    for (const point of upcomingPoints) {
      const pScore = point.riskScore ?? 0;
      const pLevel = point.riskLevel || (pScore >= 75 ? 'EXTREME' : pScore >= 50 ? 'HIGH' : 'MODERATE');

      // Check if risk escalates significantly within 2-4 hours
      if (pScore >= 75 && riskScore < 75) {
        const timeStr = point.time ? new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '2 hours';
        upcoming.push(dict.forecast_warning_extreme(timeStr));
        reasons.push(dict.reason_peak_approaching(pLevel));
        break;
      } else if (pScore >= 50 && riskScore < 50) {
        const timeStr = point.time ? new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '2 hours';
        upcoming.push(dict.forecast_warning_high(timeStr));
        reasons.push(dict.reason_peak_approaching(pLevel));
        break;
      }
    }
  }

  // ── 4. Priority Ranking (Limit to 3–5 items to prevent cognitive overload) ─
  const priorityPool = [...upcoming, ...immediate];
  // Deduplicate and cap between 3 and 5 items
  const uniquePriority = Array.from(new Set(priorityPool)).slice(0, 5);

  return {
    priority: uniquePriority.length >= 3 ? uniquePriority : uniquePriority.concat(dict.clothing_light).slice(0, 5),
    immediate,
    upcoming,
    reasons: Array.from(new Set(reasons)),
    language: lang,
  };
}

import { SendEmailOptions, ContributingFactorItem } from './types';

/**
 * Escapes HTML characters to prevent XSS / HTML injection in generated emails.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strips dangerous script tags and potential secret tokens.
 */
export function sanitizeEmailContent(content: string): string {
  if (!content) return '';
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Strip patterns that resemble API keys or secrets
  sanitized = sanitized.replace(/(?:re_|AIza|eyJh|ghp_|sq0csp-)[a-zA-Z0-9_-]{10,}/g, '[REDACTED_SECRET]');
  return sanitized;
}

/**
 * Validates whether an email string conforms to standard RFC 5322 format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  // Standard email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface LocalizedAlertEmailParams {
  language: 'en' | 'te' | 'ta' | 'hi';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  riskScore: number;
  locationName: string;
  temperature?: number;
  apparentTemperature?: number;
  humidity?: number;
  windSpeed?: number;
  reasons: string[];
  precautions: string[];
  upcomingWarning?: string;
  recipientName?: string;
  timestamp?: string;
  timezone?: string;
  modelVersion?: string;
  customSubject?: string;
}

export const EMAIL_I18N: Record<
  'en' | 'te' | 'ta' | 'hi',
  {
    header: string;
    subHeader: string;
    riskLevels: Record<string, string>;
    greeting: (name?: string) => string;
    locationLabel: string;
    updatedLabel: string;
    currentConditions: string;
    tempLabel: string;
    feelsLikeLabel: string;
    humidityLabel: string;
    windLabel: string;
    whyTitle: string;
    actNowTitle: string;
    nextTitle: string;
    emergencyTitle: string;
    emergencyText: string;
    reassessTitle: string;
    reassessText: string;
    footerDisclaimer: string;
    dataSource: string;
    managePrefs: string;
  }
> = {
  en: {
    header: 'HEATSHIELD AI',
    subHeader: 'CURRENT HEAT RISK ADVISORY',
    riskLevels: { LOW: 'LOW', MODERATE: 'MODERATE', HIGH: 'HIGH', EXTREME: 'EXTREME' },
    greeting: (name) => (name ? `Hello ${name},` : 'Hello,'),
    locationLabel: 'Location',
    updatedLabel: 'Updated Local Time',
    currentConditions: 'Current Environmental Observations',
    tempLabel: 'Air Temperature',
    feelsLikeLabel: 'Feels Like',
    humidityLabel: 'Relative Humidity',
    windLabel: 'Wind Speed',
    whyTitle: 'WHY THIS ALERT WAS TRIGGERED',
    actNowTitle: 'PERSONALIZED PREVENTIVE PRECAUTIONS',
    nextTitle: 'UPCOMING FORECAST RISK',
    emergencyTitle: 'EMERGENCY MEDICAL GUIDANCE',
    emergencyText: 'If anyone displays confusion, loss of consciousness, cessation of sweating, or extreme fever, call emergency services immediately and move the individual to shade while applying cold water.',
    reassessTitle: 'WHEN TO REASSESS',
    reassessText: 'Re-check local heat conditions every 1–2 hours or before transitioning into outdoor physical labor.',
    footerDisclaimer: 'HeatShield AI is an environmental safety decision-support platform. It does not provide medical diagnoses.',
    dataSource: 'Meteorological data: Open-Meteo API',
    managePrefs: 'Manage Preferences / Notification Settings',
  },
  te: {
    header: 'హీట్‌షీల్డ్ AI',
    subHeader: 'ప్రస్తుత వేడి ప్రమాద హెచ్చరిక',
    riskLevels: { LOW: 'తక్కువ', MODERATE: 'మధ్యస్థం', HIGH: 'అధికం', EXTREME: 'తీవ్రమైన ప్రమాదం' },
    greeting: (name) => (name ? `నమస్కారం ${name},` : 'నమస్కారం,'),
    locationLabel: 'ప్రాంతం',
    updatedLabel: 'స్థానిక సమయం',
    currentConditions: 'ప్రస్తుత వాతావరణ పరిస్థితులు',
    tempLabel: 'ఉష్ణోగ్రత',
    feelsLikeLabel: 'అనిపించే ఉష్ణోగ్రత',
    humidityLabel: 'తేమ శాతం',
    windLabel: 'గాలి వేగం',
    whyTitle: 'ఈ హెచ్చరిక ఎందుకు జారీ చేయబడింది',
    actNowTitle: 'వ్యక్తిగతీకరించిన జాగ్రత్తలు',
    nextTitle: 'రాబోయే సమయం: ఫోర్‌కాస్ట్ ప్రమాదం',
    emergencyTitle: 'అత్యవసర వైద్య మార్గదర్శకం',
    emergencyText: 'స్పృహ కోల్పోవడం, మైకం, చెమట పట్టని పొడి చర్మం వంటి తీవ్ర వడదెబ్బ లక్షణాలు కనిపిస్తే, వెంటనే అత్యవసర వైద్య సేవలను పిలవండి మరియు బాధితుడిని చల్లని ప్రదేశానికి తరలించి చల్లటి నీటితో తడపండి.',
    reassessTitle: 'ఎప్పుడు తిరిగి సమీక్షించాలి',
    reassessText: 'పరిస్థితులను ప్రతి 1 నుండి 2 గంటలకు లేదా బయటి శారీరక శ్రమ ప్రారంభించే ముందు తిరిగి తనిఖీ చేయండి.',
    footerDisclaimer: 'హీట్‌షీల్డ్ AI అనేది పర్యావరణ భద్రతా నిర్ణయ మద్దతు వ్యవస్థ మాత్రమే. ఇది వైద్య నిర్ధారణ చేయదు.',
    dataSource: 'వాతావరణ సమాచార మూలం: Open-Meteo',
    managePrefs: 'నోటిఫికేషన్ ప్రాధాన్యతలను నిర్వహించండి',
  },
  ta: {
    header: 'ஹீட்ஷீல்டு AI',
    subHeader: 'தற்போதைய வெப்ப அபாய எச்சரிக்கை',
    riskLevels: { LOW: 'குறைவு', MODERATE: 'மிதமான', HIGH: 'அதிகம்', EXTREME: 'மிகக் கடுமையான' },
    greeting: (name) => (name ? `வணக்கம் ${name},` : 'வணக்கம்,'),
    locationLabel: 'இடம்',
    updatedLabel: 'உள்ளூர் நேரம்',
    currentConditions: 'தற்போதைய வானிலை நிலை',
    tempLabel: 'வெப்பநிலை',
    feelsLikeLabel: 'உணரப்படும் வெப்பம்',
    humidityLabel: 'ஈரப்பதம்',
    windLabel: 'காற்று வேகம்',
    whyTitle: 'இந்த எச்சரிக்கை ஏன் தூண்டப்பட்டது',
    actNowTitle: 'தனிப்பயனாக்கப்பட்ட முன்னெச்சரிக்கைகள்',
    nextTitle: 'அடுத்து: முன்னறிவிப்பு அபாய நிலை',
    emergencyTitle: 'அவசர மருத்துவ வழிகாட்டுதல்',
    emergencyText: 'மயக்கம், குழப்பம், அதிக உடல் உஷ்ணம் அல்லது வியர்வை இல்லாமை போன்ற தீவிர அறிகுறிகள் தென்பட்டால், உடனடியாக அவசர மருத்துவ உதவியை அழைக்கவும் மற்றும் பாதிக்கப்பட்டவரை நிழலான இடத்திற்கு மாற்றி குளிர்ந்த நீர் தெளிக்கவும்.',
    reassessTitle: 'மீண்டும் எப்போது சரிபார்க்க வேண்டும்',
    reassessText: '1 முதல் 2 மணி நேரத்திற்கு ஒருமுறை அல்லது வெளிப்புற உடலுழைப்பைத் தொடங்குவதற்கு முன் வானிலை நிலையை மீண்டும் சரிபார்க்கவும்.',
    footerDisclaimer: 'ஹீட்ஷீல்டு AI என்பது ஒரு பாதுகாப்பு வழிகாட்டுதல் திட்டம் மட்டுமே. இது மருத்துவ சிகிச்சை கருவி அல்ல.',
    dataSource: 'வானிலை தகவல் ஆதாரம்: Open-Meteo',
    managePrefs: 'அறிவிப்பு விருப்பங்களை நிர்வகிக்கவும்',
  },
  hi: {
    header: 'हीटशील्ड AI',
    subHeader: 'वर्तमान गर्मी जोखिम चेतावनी',
    riskLevels: { LOW: 'कम', MODERATE: 'मध्यम', HIGH: 'उच्च', EXTREME: 'अत्यधिक गंभीर' },
    greeting: (name) => (name ? `नमस्ते ${name},` : 'नमस्ते,'),
    locationLabel: 'स्थान',
    updatedLabel: 'स्थानीय समय',
    currentConditions: 'वर्तमान मौसम स्थिति',
    tempLabel: 'तापमान',
    feelsLikeLabel: 'महसूस होने वाला तापमान',
    humidityLabel: 'सापेक्ष आर्द्रता',
    windLabel: 'हवा की गति',
    whyTitle: 'यह चेतावनी क्यों जारी की गई',
    actNowTitle: 'व्यक्तिगत सुरक्षा सावधानियां',
    nextTitle: 'आगे: आगामी घंटों का अनुमानित जोखिम',
    emergencyTitle: 'आपातकालीन चिकित्सा मार्गदर्शन',
    emergencyText: 'यदि किसी में अत्यधिक शरीर का तापमान, भ्रम, बेहोशी या पसीना न आने जैसे हीट स्ट्रोक के लक्षण दिखाई दें, तो तुरंत आपातकालीन चिकित्सा सहायता को कॉल करें और पीड़ित को ठंडी जगह पर ले जाकर ठंडे पानी से स्पंज करें।',
    reassessTitle: 'कब पुनः मूल्यांकन करें',
    reassessText: 'हर 1 से 2 घंटे में या बाहरी शारीरिक श्रम शुरू करने से पहले स्थितियों का पुनः मूल्यांकन करें।',
    footerDisclaimer: 'हीटशील्ड AI एक पर्यावरणीय सुरक्षा निर्णय सहायता प्रणाली है। यह कोई चिकित्सीय निदान उपकरण नहीं है।',
    dataSource: 'मौसम डेटा स्रोत: Open-Meteo',
    managePrefs: 'अधिसूचना प्राथमिकताएं प्रबंधित करें',
  },
};

/**
 * Generates an end-to-end localized advisory email with complete
 * language synchronization across Subject, Body, Factors, Guidance, and Footer.
 */
export function getLocalizedAlertEmail(params: LocalizedAlertEmailParams): RenderedEmail {
  const validLang: 'en' | 'te' | 'ta' | 'hi' = EMAIL_I18N[params.language] ? params.language : 'en';
  const i18n = EMAIL_I18N[validLang];

  const loc = sanitizeEmailContent(params.locationName || 'Monitored Region');
  const riskLevelRaw = params.riskLevel || 'HIGH';
  const riskScore = params.riskScore ?? 0;
  const localizedRiskLevel = i18n.riskLevels[riskLevelRaw] || riskLevelRaw;
  const effectiveModelVersion = params.modelVersion || 'Rule-Based Heat Risk Engine v1.4 (Physics & Context)';

  // Format local time with user timezone if provided
  let formattedTime = '';
  try {
    const d = params.timestamp ? new Date(params.timestamp) : new Date();
    formattedTime = d.toLocaleString('en-US', {
      timeZone: params.timezone || 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    if (params.timezone) formattedTime += ` (${params.timezone})`;
  } catch {
    formattedTime = params.timestamp ? new Date(params.timestamp).toUTCString() : new Date().toUTCString();
  }

  const subject =
    params.customSubject ||
    `${i18n.header} — ${localizedRiskLevel} (${riskScore}/100) ${i18n.subHeader} [${loc}]`;

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    LOW: { bg: '#064e3b', text: '#6ee7b7', border: '#059669' },
    MODERATE: { bg: '#78350f', text: '#fcd34d', border: '#d97706' },
    HIGH: { bg: '#7c2d12', text: '#fdba74', border: '#ea580c' },
    EXTREME: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  };
  const badge = badgeColors[riskLevelRaw] || badgeColors.HIGH;

  const reasonsList = params.reasons && params.reasons.length > 0 ? params.reasons : [
    validLang === 'te'
      ? 'పరిసర ఉష్ణోగ్రత మరియు తేమ శరీర ఉష్ణోగ్రతను ప్రభావితం చేస్తున్నాయి.'
      : validLang === 'ta'
      ? 'சுற்றுப்புற வெப்பமும் ஈரப்பதமும் உடல் வெப்பநிலையை அதிகரிக்கின்றன.'
      : validLang === 'hi'
      ? 'परिवेश का तापमान और आर्द्रता थर्मल तनाव उत्पन्न कर रहे हैं।'
      : 'Ambient thermal and atmospheric parameters are contributing to heat strain.',
  ];

  const precautionsList = params.precautions && params.precautions.length > 0 ? params.precautions : [
    validLang === 'te'
      ? 'క్రమం తప్పకుండా నీరు త్రాగండి మరియు చల్లని నీడలో విశ్రాంతి తీసుకోండి.'
      : validLang === 'ta'
      ? 'தொடர்ந்து குடிநீர் அருந்துங்கள் மற்றும் நிழலான இடத்தில் ஓய்வெடுங்கள்.'
      : validLang === 'hi'
      ? 'नियमित रूप से पानी पिएं और ठंडी छायादार जगह पर विश्राम करें।'
      : 'Maintain hydration and take regular rest breaks in shaded environments.',
  ];

  const greetingStr = i18n.greeting(params.recipientName);

  // Plain text representation
  const factorsText = reasonsList.map((r) => `- ${r}`).join('\n');
  const precautionsText = precautionsList.slice(0, 5).map((p, idx) => `${idx + 1}. ${p}`).join('\n');

  const text = `${i18n.header} — ${i18n.subHeader}

${greetingStr}

${i18n.riskLevels[riskLevelRaw] || riskLevelRaw} (${riskScore}/100)

${i18n.locationLabel}: ${loc}
${i18n.updatedLabel}: ${formattedTime}

${i18n.currentConditions}:
• ${i18n.tempLabel}: ${params.temperature !== undefined ? `${params.temperature}°C` : 'N/A'}
• ${i18n.feelsLikeLabel}: ${params.apparentTemperature !== undefined ? `${params.apparentTemperature}°C` : 'N/A'}
• ${i18n.humidityLabel}: ${params.humidity !== undefined ? `${params.humidity}%` : 'N/A'}
• ${i18n.windLabel}: ${params.windSpeed !== undefined ? `${params.windSpeed} km/h` : 'N/A'}

${i18n.whyTitle}:
${factorsText}

${i18n.actNowTitle}:
${precautionsText}

${params.upcomingWarning ? `${i18n.nextTitle}:\n${params.upcomingWarning}\n\n` : ''}${i18n.reassessTitle}:
${i18n.reassessText}

${i18n.emergencyTitle}:
${i18n.emergencyText}

---
${i18n.footerDisclaimer}
${i18n.dataSource}
${i18n.managePrefs}: https://heatshield-ai-kare.vercel.app/settings`;

  // Professional, responsive HTML without excessive whitespace
  const html = `<!DOCTYPE html>
<html lang="${validLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
    <style>
      body { margin: 0; padding: 12px; background-color: #050811; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
      .wrapper { width: 100%; max-width: 620px; margin: 0 auto; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
      .top-banner { background: #090d16; padding: 20px 24px 16px; border-bottom: 1px solid #1e293b; }
      .brand { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #10b981; }
      .title { font-size: 18px; font-weight: 800; color: #ffffff; margin: 6px 0 14px 0; line-height: 1.3; }
      .badge-wrap { display: inline-block; padding: 5px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; text-transform: uppercase; letter-spacing: 0.05em; }
      .score-num { font-size: 14px; font-weight: 800; color: #f8fafc; margin-left: 8px; vertical-align: middle; }
      .body-content { padding: 20px 24px; }
      .greeting { font-size: 14px; color: #cbd5e1; margin-bottom: 14px; }
      .meta-panel { background: #070b14; border-radius: 8px; padding: 10px 14px; border: 1px solid #1e293b; margin-bottom: 18px; font-size: 12px; color: #94a3b8; }
      .section-heading { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em; margin: 18px 0 8px 0; }
      .weather-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-left: -8px; margin-right: -8px; margin-bottom: 16px; }
      .weather-col { display: table-cell; width: 25%; background: #070b14; border-radius: 8px; padding: 10px; border: 1px solid #1e293b; text-align: center; vertical-align: top; }
      .weather-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
      .weather-val { font-size: 16px; font-weight: 800; color: #f8fafc; font-family: monospace; }
      .factors-panel { background: #070b14; border-radius: 8px; padding: 12px 16px; border: 1px solid #1e293b; margin-bottom: 16px; }
      .factors-list { margin: 0; padding-left: 18px; font-size: 13px; color: #cbd5e1; line-height: 1.55; }
      .precautions-panel { background: #071520; border-radius: 8px; padding: 14px 18px; border: 1px solid #059669; margin-bottom: 16px; }
      .precautions-list { margin: 0; padding-left: 18px; font-size: 13px; color: #e2e8f0; line-height: 1.6; }
      .precautions-list li { margin-bottom: 6px; }
      .forecast-panel { background: #18152e; border-radius: 8px; padding: 12px 16px; border: 1px solid #6366f1; margin-bottom: 16px; color: #c7d2fe; font-size: 12px; line-height: 1.5; }
      .reassess-panel { background: #070b14; border-radius: 8px; padding: 10px 14px; border: 1px solid #1e293b; margin-bottom: 16px; font-size: 12px; color: #94a3b8; }
      .emergency-panel { background: #260a12; border-radius: 8px; padding: 12px 16px; border: 1px solid #e11d48; margin-bottom: 18px; color: #fecdd3; font-size: 12px; line-height: 1.5; }
      .emergency-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #fda4af; margin-bottom: 4px; letter-spacing: 0.05em; }
      .footer-panel { background: #070b14; padding: 16px 24px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
      .footer-panel a { color: #38bdf8; text-decoration: none; font-weight: 600; }
      @media only screen and (max-width: 480px) {
        .weather-grid { display: block; margin: 0 0 16px 0; }
        .weather-col { display: inline-block; width: 46%; margin: 2% 2%; box-sizing: border-box; }
        .top-banner, .body-content, .footer-panel { padding-left: 16px; padding-right: 16px; }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="top-banner">
        <div class="brand">${escapeHtml(i18n.header)}</div>
        <h1 class="title">${escapeHtml(i18n.subHeader)}</h1>
        <div>
          <span class="badge-wrap">${escapeHtml(localizedRiskLevel)}</span>
          <span class="score-num">${riskScore} / 100</span>
        </div>
      </div>

      <div class="body-content">
        <div class="greeting">${escapeHtml(greetingStr)}</div>

        <div class="meta-panel">
          <div><strong>${escapeHtml(i18n.locationLabel)}:</strong> ${escapeHtml(loc)}</div>
          <div style="margin-top: 3px;"><strong>${escapeHtml(i18n.updatedLabel)}:</strong> ${escapeHtml(formattedTime)}</div>
        </div>

        <div class="section-heading">${escapeHtml(i18n.currentConditions)}</div>
        <div class="weather-grid">
          <div class="weather-col">
            <div class="weather-label">${escapeHtml(i18n.tempLabel)}</div>
            <div class="weather-val">${params.temperature !== undefined ? `${params.temperature}°C` : 'N/A'}</div>
          </div>
          <div class="weather-col">
            <div class="weather-label">${escapeHtml(i18n.feelsLikeLabel)}</div>
            <div class="weather-val">${params.apparentTemperature !== undefined ? `${params.apparentTemperature}°C` : 'N/A'}</div>
          </div>
          <div class="weather-col">
            <div class="weather-label">${escapeHtml(i18n.humidityLabel)}</div>
            <div class="weather-val">${params.humidity !== undefined ? `${params.humidity}%` : 'N/A'}</div>
          </div>
          <div class="weather-col">
            <div class="weather-label">${escapeHtml(i18n.windLabel)}</div>
            <div class="weather-val">${params.windSpeed !== undefined ? `${params.windSpeed} km/h` : 'N/A'}</div>
          </div>
        </div>

        <div class="section-heading">${escapeHtml(i18n.whyTitle)}</div>
        <div class="factors-panel">
          <ul class="factors-list">
            ${reasonsList.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>

        <div class="section-heading">${escapeHtml(i18n.actNowTitle)}</div>
        <div class="precautions-panel">
          <ol class="precautions-list">
            ${precautionsList.slice(0, 5).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
          </ol>
        </div>

        ${
          params.upcomingWarning
            ? `<div class="section-heading">${escapeHtml(i18n.nextTitle)}</div>
               <div class="forecast-panel">${escapeHtml(params.upcomingWarning)}</div>`
            : ''
        }

        <div class="reassess-panel">
          <strong>${escapeHtml(i18n.reassessTitle)}:</strong> ${escapeHtml(i18n.reassessText)}
        </div>

        ${
          riskLevelRaw === 'HIGH' || riskLevelRaw === 'EXTREME'
            ? `<div class="emergency-panel">
                 <div class="emergency-title">${escapeHtml(i18n.emergencyTitle)}</div>
                 <div>${escapeHtml(i18n.emergencyText)}</div>
               </div>`
            : ''
        }
      </div>

      <div class="footer-panel">
        <div>${escapeHtml(i18n.footerDisclaimer)}</div>
        <div style="margin-top: 4px;">${escapeHtml(i18n.dataSource)} • ${escapeHtml(effectiveModelVersion)}</div>
        <div style="margin-top: 10px;">
          <a href="https://heatshield-ai-kare.vercel.app/settings">${escapeHtml(i18n.managePrefs)}</a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

/**
 * Generates the standardized HeatShield AI environmental advisory email.
 * Adapts legacy SendEmailOptions by extracting parameters and invoking
 * the authoritative getLocalizedAlertEmail renderer.
 */
export function generateEmailContent(options: SendEmailOptions): RenderedEmail {
  const {
    alert,
    locationName,
    recipientName,
    customSubject,
    contributingFactors,
    modelVersion,
    language = 'en',
    timezone,
    upcomingRisk,
  } = options;

  const validLang: 'en' | 'te' | 'ta' | 'hi' = EMAIL_I18N[language] ? language : 'en';

  const riskLevelRaw = (alert.trigger_data?.risk_level || 'HIGH') as 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  const riskScore = alert.trigger_data?.risk_score ?? 0;

  // Extract reasons from factors or alert
  const reasons: string[] =
    contributingFactors && contributingFactors.length > 0
      ? contributingFactors.map((f) => f.description ? `${f.name}: ${f.description}` : f.name)
      : alert.why_generated
      ? [alert.why_generated]
      : [];

  const precautions = alert.precautions && alert.precautions.length > 0 ? alert.precautions : [];

  return getLocalizedAlertEmail({
    language: validLang,
    riskLevel: riskLevelRaw,
    riskScore,
    locationName: locationName || alert.location_name || 'Monitored Region',
    temperature: alert.trigger_data?.temperature,
    apparentTemperature: alert.trigger_data?.apparent_temperature,
    humidity: alert.trigger_data?.humidity,
    windSpeed: alert.trigger_data?.wind_speed,
    reasons,
    precautions,
    upcomingWarning: upcomingRisk,
    recipientName,
    timestamp: alert.timestamp,
    timezone,
    modelVersion,
    customSubject,
  });
}

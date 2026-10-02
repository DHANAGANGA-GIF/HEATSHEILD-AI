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

const EMAIL_I18N: Record<
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
    footerDisclaimer: string;
    dataSource: string;
    managePrefs: string;
  }
> = {
  en: {
    header: 'HEATSHIELD AI',
    subHeader: 'CURRENT HEAT RISK ALERT',
    riskLevels: { LOW: 'LOW', MODERATE: 'MODERATE', HIGH: 'HIGH', EXTREME: 'VERY HIGH / EXTREME' },
    greeting: (name) => (name ? `Hello ${name},` : 'Hello,'),
    locationLabel: 'Location',
    updatedLabel: 'Updated Local Time',
    currentConditions: 'Current Conditions',
    tempLabel: 'Air Temperature',
    feelsLikeLabel: 'Feels Like',
    humidityLabel: 'Relative Humidity',
    windLabel: 'Wind Speed',
    whyTitle: 'WHY: Actual Risk Factors',
    actNowTitle: 'ACT NOW: Recommended Precautions',
    nextTitle: 'NEXT: Upcoming Forecast Risk',
    footerDisclaimer: 'HeatShield AI is a decision-support system. It does not diagnose medical conditions.',
    dataSource: 'Weather data source: Open-Meteo',
    managePrefs: 'Manage Preferences / Unsubscribe',
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
    whyTitle: 'కారణాలు: వాస్తవ ప్రమాద కారకాలు',
    actNowTitle: 'తక్షణ చర్యలు: సిఫార్సు చేసిన జాగ్రత్తలు',
    nextTitle: 'రాబోయే సమయం: ఫోర్‌కాస్ట్ ప్రమాదం',
    footerDisclaimer: 'హీట్‌షీల్డ్ AI అనేది నిర్ణయ మద్దతు వ్యవస్థ మాత్రమే. ఇది వైద్య నిర్ధారణ చేయదు.',
    dataSource: 'వాతావరణ సమాచార మూలం: Open-Meteo',
    managePrefs: 'ప్రాధాన్యతలను నిర్వహించండి',
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
    whyTitle: 'காரணங்கள்: முக்கிய அபாயக் காரணிகள்',
    actNowTitle: 'உடனடி நடவடிக்கை: பரிந்துரைக்கப்பட்ட முன்னெச்சரிக்கைகள்',
    nextTitle: 'அடுத்து: முன்னறிவிப்பு அபாய நிலை',
    footerDisclaimer: 'ஹீட்ஷீல்டு AI என்பது ஒரு பாதுகாப்பு வழிகாட்டுதல் திட்டம் மட்டுமே. இது மருத்துவ சிகிச்சை கருவி அல்ல.',
    dataSource: 'வானிலை தகவல் ஆதாரம்: Open-Meteo',
    managePrefs: 'விருப்பங்களை நிர்வகிக்கவும்',
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
    whyTitle: 'कारण: वास्तविक जोखिम कारक',
    actNowTitle: 'तुरंत कदम उठाएं: अनुशंसित सावधानियां',
    nextTitle: 'आगे: आगामी घंटों का अनुमानित जोखिम',
    footerDisclaimer: 'हीटशील्ड AI एक निर्णय सहायता प्रणाली है। यह कोई चिकित्सीय निदान उपकरण नहीं है।',
    dataSource: 'मौसम डेटा स्रोत: Open-Meteo',
    managePrefs: 'प्राथमिकताएं प्रबंधित करें',
  },
};

/**
 * Generates the standardized HeatShield AI environmental advisory email.
 * Guarantees consistent, responsive formatting across Resend and Gmail providers,
 * with complete multilingual support (en, te, ta, hi).
 */
export function generateEmailContent(options: SendEmailOptions): RenderedEmail {
  const {
    alert,
    locationName,
    recipientName,
    locationStatus,
    weatherCondition,
    weatherObservedAt,
    dataQualityStatus,
    customSubject,
    contributingFactors,
    modelVersion,
    language = 'en',
    timezone,
    upcomingRisk,
  } = options;

  const validLang: 'en' | 'te' | 'ta' | 'hi' = EMAIL_I18N[language] ? language : 'en';
  const i18n = EMAIL_I18N[validLang];

  const loc = sanitizeEmailContent(locationName || alert.location_name || 'Current Monitored Location');
  const riskLevelRaw = alert.trigger_data?.risk_level || 'HIGH';
  const riskScore = alert.trigger_data?.risk_score ?? 0;
  const effectiveModelVersion = modelVersion || 'Rule-Based Heat Risk Engine v1.4 (Physics & Context)';

  const localizedRiskLevel = i18n.riskLevels[riskLevelRaw] || riskLevelRaw;

  // Format local time with user timezone if provided
  let formattedTime = '';
  try {
    const d = alert.timestamp ? new Date(alert.timestamp) : new Date();
    formattedTime = d.toLocaleString('en-US', {
      timeZone: timezone || 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    if (timezone) formattedTime += ` (${timezone})`;
  } catch {
    formattedTime = alert.timestamp ? new Date(alert.timestamp).toUTCString() : new Date().toUTCString();
  }

  const subject =
    customSubject ||
    `HeatShield AI — ${localizedRiskLevel} (${riskScore}/100) ${i18n.subHeader} [${loc}]`;

  const defaultPrecautions = [
    'Take regular cooling/rest breaks in shaded or ventilated areas.',
    'Increase hydration: drink 250-500ml of clean water every 30-45 minutes.',
    'Reduce prolonged strenuous outdoor physical exertion during peak hours.',
    'Move to shade, air-conditioned, or fan-cooled indoor spaces when possible.',
    'Wear lightweight, loose-fitting, light-colored clothing.',
  ];

  const precautionsList =
    alert.precautions && alert.precautions.length >= 3
      ? alert.precautions
      : defaultPrecautions;

  const greetingStr = i18n.greeting(recipientName);

  const factors: ContributingFactorItem[] =
    contributingFactors && contributingFactors.length > 0
      ? contributingFactors
      : [
          {
            name: i18n.feelsLikeLabel,
            description: `Thermal load feels like ${alert.trigger_data?.apparent_temperature ?? 'elevated'}°C`,
          },
          {
            name: i18n.humidityLabel,
            description: `Relative humidity at ${alert.trigger_data?.humidity ?? 'normal'}% limits sweat evaporation`,
          },
        ];

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    LOW: { bg: '#064e3b', text: '#6ee7b7', border: '#059669' },
    MODERATE: { bg: '#78350f', text: '#fcd34d', border: '#d97706' },
    HIGH: { bg: '#7c2d12', text: '#fdba74', border: '#ea580c' },
    EXTREME: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  };
  const badge = badgeColors[riskLevelRaw] || badgeColors.HIGH;

  // Plain text representation
  const factorsText = factors.map((f) => `- ${f.name}${f.description ? `: ${f.description}` : ''}`).join('\n');
  const precautionsText = precautionsList.slice(0, 5).map((p, idx) => `${idx + 1}. ${p}`).join('\n');

  const text = `${i18n.header} — ${i18n.subHeader}

Risk:
${localizedRiskLevel} — ${riskScore}/100

${i18n.locationLabel}:
${loc}

${i18n.updatedLabel}:
${formattedTime}

${i18n.currentConditions}:
• ${i18n.tempLabel}: ${alert.trigger_data?.temperature ?? 'N/A'}°C
• ${i18n.feelsLikeLabel}: ${alert.trigger_data?.apparent_temperature ?? 'N/A'}°C
• ${i18n.humidityLabel}: ${alert.trigger_data?.humidity ?? 'N/A'}%
• ${i18n.windLabel}: ${alert.trigger_data?.wind_speed ?? 'N/A'} km/h

${i18n.whyTitle}:
${factorsText}

${i18n.actNowTitle}:
${precautionsText}

${upcomingRisk ? `${i18n.nextTitle}:\n${upcomingRisk}\n\n` : ''}---
${i18n.footerDisclaimer}
${i18n.dataSource}
${i18n.managePrefs}: https://heatshield-ai-kare.vercel.app/settings`;

  // HTML representation
  const html = `
    <!DOCTYPE html>
    <html lang="${validLang}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased; }
          .container { max-width: 600px; margin: 0 auto; background: #131c2e; border-radius: 14px; padding: 28px; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #10b981; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; line-height: 1.3; }
          .badge-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 800; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; text-transform: uppercase; letter-spacing: 0.05em; }
          .score-label { font-size: 14px; font-weight: 800; color: #f8fafc; }
          .meta-box { background: #0b1324; border-radius: 10px; padding: 12px 16px; border: 1px solid #1e293b; margin-bottom: 16px; font-size: 13px; color: #94a3b8; }
          .section-title { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em; margin: 18px 0 10px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
          .card { background: #0b1324; border-radius: 10px; padding: 12px 14px; border: 1px solid #1e293b; }
          .card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .card-value { font-size: 16px; font-weight: 800; color: #f8fafc; font-family: monospace; }
          .factors-box { background: #0b1324; border-radius: 10px; padding: 14px; border: 1px solid #1e293b; margin-bottom: 16px; }
          .factors-list { margin: 0; padding-left: 18px; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
          .precautions-box { background: #0f172a; border-radius: 10px; padding: 16px; border: 1px solid #10b981; margin-bottom: 16px; }
          .precautions-list { margin: 0; padding-left: 20px; font-size: 13px; color: #e2e8f0; line-height: 1.65; }
          .precautions-list li { margin-bottom: 6px; }
          .upcoming-box { background: #1e1b4b; border-radius: 10px; padding: 14px; border: 1px solid #6366f1; margin-bottom: 16px; color: #c7d2fe; font-size: 13px; line-height: 1.5; }
          .disclaimer { background: #0b1324; border-radius: 8px; padding: 12px; margin-top: 14px; color: #94a3b8; font-size: 11px; line-height: 1.5; border: 1px solid #1e293b; }
          .footer { font-size: 11px; color: #475569; margin-top: 20px; text-align: center; }
          .footer a { color: #38bdf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">${escapeHtml(i18n.header)}</div>
          <h1 class="title">${escapeHtml(i18n.subHeader)}</h1>
          <div class="badge-row">
            <span class="badge">${escapeHtml(localizedRiskLevel)}</span>
            <span class="score-label">${riskScore} / 100</span>
          </div>

          <div class="meta-box">
            <div><strong>${escapeHtml(i18n.locationLabel)}:</strong> ${escapeHtml(loc)}</div>
            <div style="margin-top: 4px;"><strong>${escapeHtml(i18n.updatedLabel)}:</strong> ${escapeHtml(formattedTime)}</div>
          </div>

          <div class="section-title">${escapeHtml(i18n.currentConditions)}</div>
          <div class="grid">
            <div class="card">
              <div class="card-title">${escapeHtml(i18n.tempLabel)}</div>
              <div class="card-value">${alert.trigger_data?.temperature !== undefined ? `${alert.trigger_data.temperature}°C` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">${escapeHtml(i18n.feelsLikeLabel)}</div>
              <div class="card-value">${alert.trigger_data?.apparent_temperature !== undefined ? `${alert.trigger_data.apparent_temperature}°C` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">${escapeHtml(i18n.humidityLabel)}</div>
              <div class="card-value">${alert.trigger_data?.humidity !== undefined ? `${alert.trigger_data.humidity}%` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">${escapeHtml(i18n.windLabel)}</div>
              <div class="card-value">${alert.trigger_data?.wind_speed !== undefined ? `${alert.trigger_data.wind_speed} km/h` : 'N/A'}</div>
            </div>
          </div>

          <div class="section-title">${escapeHtml(i18n.whyTitle)}</div>
          <div class="factors-box">
            <ul class="factors-list">
              ${factors.map((f) => `<li><strong>${escapeHtml(f.name)}:</strong> ${escapeHtml(f.description || 'Active risk component')}</li>`).join('')}
            </ul>
          </div>

          <div class="section-title">${escapeHtml(i18n.actNowTitle)}</div>
          <div class="precautions-box">
            <ol class="precautions-list">
              ${precautionsList.slice(0, 5).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
            </ol>
          </div>

          ${
            upcomingRisk
              ? `<div class="section-title">${escapeHtml(i18n.nextTitle)}</div>
                 <div class="upcoming-box">${escapeHtml(upcomingRisk)}</div>`
              : ''
          }

          <div class="disclaimer">
            <strong>Notice:</strong> ${escapeHtml(i18n.footerDisclaimer)}<br/>
            ${escapeHtml(i18n.dataSource)} • ${escapeHtml(effectiveModelVersion)}
          </div>

          <div class="footer">
            <a href="https://heatshield-ai-kare.vercel.app/settings">${escapeHtml(i18n.managePrefs)}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    subject,
    html,
    text,
  };
}


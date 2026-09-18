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

/**
 * Generates the standardized HeatShield AI environmental advisory email.
 * Guarantees consistent, responsive formatting across Resend and Gmail providers.
 */
export function generateEmailContent(options: SendEmailOptions): RenderedEmail {
  const {
    alert,
    locationName,
    recipientName,
    locationStatus,
    coordinates,
    gpsAccuracy,
    weatherCondition,
    weatherObservedAt,
    dataQualityStatus,
    dataQualityExplanation,
    riskCalculatedAt,
    trend,
    customSubject,
    contributingFactors,
    modelVersion,
  } = options;

  const loc = sanitizeEmailContent(locationName || alert.location_name || 'Current Monitored Location');
  const alertTime = alert.timestamp ? new Date(alert.timestamp).toUTCString() : new Date().toUTCString();
  const riskLevel = alert.trigger_data?.risk_level || 'EVALUATED';
  const riskScore = alert.trigger_data?.risk_score ?? 0;
  const effectiveModelVersion = modelVersion || 'HeatShield-ML v1.3.0 (Physics-Context Dual Engine)';

  const subject =
    customSubject ||
    `HeatShield AI — ${riskLevel.charAt(0) + riskLevel.slice(1).toLowerCase()} Heat Risk Advisory for ${loc}`;

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

  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : 'Hello,';
  const plainGreeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const accuracyStr = gpsAccuracy !== undefined ? `±${gpsAccuracy} m` : 'N/A';
  const locSourceStr = locationStatus || 'SAVED_LOCATION';
  const coordsStr = coordinates
    ? `${coordinates.latitude.toFixed(4)}° N, ${coordinates.longitude.toFixed(4)}° E`
    : 'Coordinates unavailable';
  const conditionStr = weatherCondition || 'Current Weather Observation';
  const observedTimeStr = weatherObservedAt || alertTime;
  const qualityStr = dataQualityStatus || alert.source_status || 'LIVE';

  const factors: ContributingFactorItem[] = contributingFactors && contributingFactors.length > 0
    ? contributingFactors
    : [
        { name: 'Apparent Temperature', impact: 'high', description: `Thermal load feels like ${alert.trigger_data?.apparent_temperature ?? 'elevated'}°C` },
        { name: 'Relative Humidity', impact: 'moderate', description: `Vapor pressure at ${alert.trigger_data?.humidity ?? 'normal'}% influences sweat evaporation` },
        { name: 'Environmental Exposure', impact: 'moderate', description: 'Ambient thermal stress based on localized geographic coordinates' },
      ];

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    LOW: { bg: '#064e3b', text: '#6ee7b7', border: '#059669' },
    MODERATE: { bg: '#78350f', text: '#fcd34d', border: '#d97706' },
    HIGH: { bg: '#7c2d12', text: '#fdba74', border: '#ea580c' },
    EXTREME: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  };
  const badge = badgeColors[riskLevel] || badgeColors.HIGH;

  // Plain text representation
  const factorsText = factors.map((f) => `- ${f.name}${f.description ? `: ${f.description}` : ''}`).join('\n');
  const precautionsText = precautionsList.map((p, idx) => `${idx + 1}. ${p}`).join('\n');

  const text = `${subject}

${plainGreeting}

Current location:
${loc}

Latest environmental conditions:
Temperature: ${alert.trigger_data?.temperature ?? 'N/A'}°C
Feels like: ${alert.trigger_data?.apparent_temperature ?? 'N/A'}°C
Humidity: ${alert.trigger_data?.humidity ?? 'N/A'}%
Wind: ${alert.trigger_data?.wind_speed ?? 'N/A'} km/h

Current estimated heat-risk:
${riskScore} / 100 — ${riskLevel}

Main contributing factors:
${factorsText}

Recommended precautions:
${precautionsText}

Data timestamp:
${observedTimeStr}

Model:
${effectiveModelVersion}

Important Safety Notice:
HeatShield AI provides environmental decision support and is not medical advice. Consult healthcare professionals for personal symptoms or emergencies.

Manage preferences / unsubscribe: https://heatshield-ai-kare.vercel.app/profile`;

  // HTML representation
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased; }
          .container { max-width: 600px; margin: 0 auto; background: #131c2e; border-radius: 14px; padding: 28px; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #10b981; margin-bottom: 8px; }
          .title { font-size: 21px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; line-height: 1.3; }
          .badge-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; text-transform: uppercase; letter-spacing: 0.05em; }
          .score-label { font-size: 14px; font-weight: 800; color: #f8fafc; }
          .greeting { font-size: 14px; color: #cbd5e1; margin-bottom: 16px; }
          .section-title { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 10px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
          .card { background: #0b1324; border-radius: 10px; padding: 12px 14px; border: 1px solid #1e293b; }
          .card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .card-value { font-size: 16px; font-weight: 800; color: #f8fafc; font-family: monospace; }
          .factors-box { background: #0b1324; border-radius: 10px; padding: 14px; border: 1px solid #1e293b; margin-bottom: 16px; }
          .factors-list { margin: 0; padding-left: 18px; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
          .precautions-box { background: #0f172a; border-radius: 10px; padding: 16px; border: 1px solid #10b981; margin-bottom: 16px; }
          .precautions-list { margin: 0; padding-left: 20px; font-size: 13px; color: #e2e8f0; line-height: 1.65; }
          .precautions-list li { margin-bottom: 6px; }
          .meta-info { font-size: 11px; color: #64748b; line-height: 1.6; border-top: 1px solid #1e293b; padding-top: 14px; margin-top: 20px; }
          .disclaimer { background: #0b1324; border-radius: 8px; padding: 12px; margin-top: 14px; color: #94a3b8; font-size: 11px; line-height: 1.5; border: 1px solid #1e293b; }
          .footer { font-size: 11px; color: #475569; margin-top: 22px; text-align: center; font-family: monospace; }
          .footer a { color: #38bdf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">HEATSHIELD AI ENVIRONMENTAL SAFETY SYSTEM</div>
          <h1 class="title">${escapeHtml(subject)}</h1>
          <div class="badge-row">
            <span class="badge">${escapeHtml(riskLevel)} RISK</span>
            <span class="score-label">${riskScore} / 100 Heat-Risk Index ${trend ? `(Trend: ${escapeHtml(trend)})` : ''}</span>
          </div>

          <div class="greeting">
            ${greeting}<br/>
            Here is your personalized point-in-time environmental heat-risk advisory for <strong>${escapeHtml(loc)}</strong>.
          </div>

          <div class="section-title">Latest Environmental Conditions</div>
          <div class="grid">
            <div class="card">
              <div class="card-title">Air Temperature</div>
              <div class="card-value">${alert.trigger_data?.temperature !== undefined ? `${alert.trigger_data.temperature}°C` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">Feels Like (Apparent)</div>
              <div class="card-value">${alert.trigger_data?.apparent_temperature !== undefined ? `${alert.trigger_data.apparent_temperature}°C` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">Relative Humidity</div>
              <div class="card-value">${alert.trigger_data?.humidity !== undefined ? `${alert.trigger_data.humidity}%` : 'N/A'}</div>
            </div>
            <div class="card">
              <div class="card-title">Wind Speed</div>
              <div class="card-value">${alert.trigger_data?.wind_speed !== undefined ? `${alert.trigger_data.wind_speed} km/h` : 'N/A'}</div>
            </div>
          </div>

          <div class="section-title">Main Contributing Factors</div>
          <div class="factors-box">
            <ul class="factors-list">
              ${factors.map((f) => `<li><strong>${escapeHtml(f.name)}:</strong> ${escapeHtml(f.description || (f.direction === 'mitigating' ? 'Convective cooling relief' : 'Thermal stress escalator'))}</li>`).join('')}
            </ul>
          </div>

          <div class="section-title">Recommended Personalized Precautions</div>
          <div class="precautions-box">
            <ol class="precautions-list">
              ${precautionsList.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
            </ol>
          </div>

          <div class="disclaimer">
            <strong>Important Safety Notice:</strong> HeatShield AI provides environmental decision support and is not medical advice. Consult healthcare professionals for personal health symptoms. In case of heat stroke, fainting, or severe dehydration, seek emergency medical care immediately.
          </div>

          <div class="meta-info">
            <div><strong>Location:</strong> ${escapeHtml(loc)} (${escapeHtml(coordsStr)}) • <strong>Source:</strong> ${escapeHtml(locSourceStr)}</div>
            <div><strong>Observation Time:</strong> ${escapeHtml(observedTimeStr)} • <strong>Data Status:</strong> ${escapeHtml(qualityStr)}</div>
            <div><strong>Inference Model:</strong> ${escapeHtml(effectiveModelVersion)}</div>
          </div>

          <div class="footer">
            Dispatched via HeatShield AI Dispatch Gateway • <a href="https://heatshield-ai-kare.vercel.app/profile">Manage Preferences / Unsubscribe</a>
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

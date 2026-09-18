import { Resend } from 'resend';
import { SmartAlert } from './types';

export interface ContributingFactorItem {
  name: string;
  impact?: string;
  description?: string;
  direction?: 'escalating' | 'mitigating';
  weight_percent?: number;
}

export interface SendEmailOptions {
  to: string;
  alert: SmartAlert;
  locationName?: string;
  recipientName?: string;
  locationStatus?: string;
  coordinates?: { latitude: number; longitude: number };
  gpsAccuracy?: number;
  weatherCondition?: string;
  weatherObservedAt?: string;
  dataQualityStatus?: string;
  dataQualityExplanation?: string;
  riskCalculatedAt?: string;
  trend?: 'increasing' | 'stable' | 'decreasing';
  customSubject?: string;
  contributingFactors?: ContributingFactorItem[];
  modelVersion?: string;
  replyTo?: string;
}

export type ResendErrorCode =
  | 'EMAIL_DOMAIN_NOT_VERIFIED'
  | 'INVALID_RECIPIENT'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_CONFIGURATION';

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  errorCode?: ResendErrorCode;
  rawError?: string;
}

/**
 * Classifies Resend and network delivery errors into structured, actionable categories.
 * Prevents opaque "Unknown error" strings in the UI and server logs.
 */
export function classifyResendError(error: any): { errorCode: ResendErrorCode; message: string } {
  const errMsg = typeof error === 'string' ? error : error?.message || '';
  const errCode = error?.code || error?.statusCode || error?.name || '';
  const lower = `${errMsg} ${errCode}`.toLowerCase();

  if (
    lower.includes('only send testing emails to your own email address') ||
    lower.includes('resend.dev') ||
    lower.includes('not verified') ||
    lower.includes('unverified') ||
    lower.includes('domain_not_found') ||
    lower.includes('validation_error')
  ) {
    return {
      errorCode: 'EMAIL_DOMAIN_NOT_VERIFIED',
      message:
        'EMAIL_DOMAIN_NOT_VERIFIED: Resend domain restriction active. The sender domain is either unverified or in sandbox testing mode (onboarding@resend.dev). To deliver to arbitrary subscribers, configure and verify your custom domain in Resend and set RESEND_FROM_EMAIL.',
    };
  }

  if (
    lower.includes('invalid email') ||
    lower.includes('invalid_parameter') ||
    lower.includes('invalid to') ||
    lower.includes('rejected') ||
    lower.includes('recipient')
  ) {
    return {
      errorCode: 'INVALID_RECIPIENT',
      message: 'INVALID_RECIPIENT: The recipient email address is invalid or was rejected by the email provider.',
    };
  }

  if (
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return {
      errorCode: 'RATE_LIMITED',
      message: 'RATE_LIMITED: Resend rate limit reached. Please wait before triggering further email dispatches.',
    };
  }

  if (
    lower.includes('missing_api_key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return {
      errorCode: 'INVALID_CONFIGURATION',
      message: 'INVALID_CONFIGURATION: RESEND_API_KEY is missing or invalid in server environment configuration.',
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('socket')
  ) {
    return {
      errorCode: 'NETWORK_ERROR',
      message: 'NETWORK_ERROR: Network connectivity failed while contacting Resend API.',
    };
  }

  return {
    errorCode: 'PROVIDER_ERROR',
    message: `PROVIDER_ERROR: ${errMsg || 'Resend provider rejected delivery.'}`,
  };
}

export interface EmailServiceStatus {
  mode: 'SANDBOX' | 'PRODUCTION' | 'NOT_READY';
  configured: boolean;
  domain: string;
  domainVerified: boolean;
  senderConfigured: boolean;
  message: string;
}

// In-memory cache for Resend domain verification to avoid excessive API requests
let domainVerificationCache: {
  domain: string;
  verified: boolean;
  status: string;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Returns the public status of the transactional email service.
 * Authoritative: checks Resend API to verify whether the custom domain is actually verified.
 * NEVER exposes secret keys, DNS records, or private tokens.
 */
export async function getEmailServiceStatus(): Promise<EmailServiceStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
  const hasKey = Boolean(apiKey && apiKey.startsWith('re_') && !apiKey.includes('your_'));

  if (!hasKey) {
    return {
      mode: 'NOT_READY',
      configured: false,
      domain: '',
      domainVerified: false,
      senderConfigured: false,
      message: 'Email service is not configured. Missing or invalid RESEND_API_KEY.',
    };
  }

  if (!fromAddress || !fromAddress.trim()) {
    return {
      mode: 'NOT_READY',
      configured: true,
      domain: '',
      domainVerified: false,
      senderConfigured: false,
      message: 'Email service is not configured. Missing EMAIL_FROM environment variable.',
    };
  }

  const domainMatch = fromAddress.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (!domainMatch) {
    return {
      mode: 'NOT_READY',
      configured: true,
      domain: '',
      domainVerified: false,
      senderConfigured: false,
      message: 'EMAIL_FROM has an invalid email format or missing domain.',
    };
  }

  const domain = domainMatch[1].toLowerCase();

  // If using the official Resend Sandbox sender
  if (domain === 'resend.dev' || fromAddress.includes('onboarding@resend.dev')) {
    return {
      mode: 'SANDBOX',
      configured: true,
      domain: 'resend.dev',
      domainVerified: false,
      senderConfigured: true,
      message: 'Resend sandbox mode — emails can only be sent to the Resend account owner.',
    };
  }

  // Custom domain: Check if the domain is verified with Resend
  const now = Date.now();
  if (domainVerificationCache && domainVerificationCache.domain === domain && (now - domainVerificationCache.timestamp) < CACHE_TTL_MS) {
    if (domainVerificationCache.verified) {
      return {
        mode: 'PRODUCTION',
        configured: true,
        domain,
        domainVerified: true,
        senderConfigured: true,
        message: `Production email delivery enabled for ${domain}.`,
      };
    }
    return {
      mode: 'NOT_READY',
      configured: true,
      domain,
      domainVerified: false,
      senderConfigured: true,
      message: `Domain "${domain}" is not verified in Resend (status: ${domainVerificationCache.status}).`,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const listResult = await resend.domains.list();

    if (listResult.error) {
      return {
        mode: 'NOT_READY',
        configured: true,
        domain,
        domainVerified: false,
        senderConfigured: true,
        message: `Unable to verify domain status with Resend: ${listResult.error.message}`,
      };
    }

    const domainList = listResult.data?.data || [];
    const matched = domainList.find((d: any) => d.name?.toLowerCase() === domain);

    if (!matched) {
      domainVerificationCache = { domain, verified: false, status: 'not_found', timestamp: now };
      return {
        mode: 'NOT_READY',
        configured: true,
        domain,
        domainVerified: false,
        senderConfigured: true,
        message: `Domain "${domain}" is not registered in your Resend account. Production email delivery is not ready.`,
      };
    }

    const isVerified = matched.status === 'verified';
    domainVerificationCache = { domain, verified: isVerified, status: matched.status || 'unverified', timestamp: now };

    if (!isVerified) {
      return {
        mode: 'NOT_READY',
        configured: true,
        domain,
        domainVerified: false,
        senderConfigured: true,
        message: `Domain "${domain}" is currently "${matched.status}" (pending verification in Resend).`,
      };
    }

    return {
      mode: 'PRODUCTION',
      configured: true,
      domain,
      domainVerified: true,
      senderConfigured: true,
      message: `Production email delivery enabled for ${domain}.`,
    };
  } catch (err: any) {
    return {
      mode: 'NOT_READY',
      configured: true,
      domain,
      domainVerified: false,
      senderConfigured: true,
      message: `Error checking domain status with Resend: ${err?.message || 'Network exception'}`,
    };
  }
}

/**
 * Server-only transactional email service for HeatShield AI using Resend.
 * Reads API key securely from process.env.RESEND_API_KEY.
 * Never exposes credentials to client-side code.
 */
export async function sendAlertEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'HeatShield AI Alerts <onboarding@resend.dev>';
  const replyToAddress = options.replyTo || process.env.RESEND_REPLY_TO;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!fromAddress || !fromAddress.includes('@')) {
    return {
      success: false,
      error: 'INVALID_CONFIGURATION: Email service is misconfigured. Set RESEND_FROM_EMAIL or EMAIL_FROM to a valid email address.',
      errorCode: 'INVALID_CONFIGURATION',
    };
  }

  const {
    to,
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

  const loc = locationName || alert.location_name || 'Current Monitored Location';
  const alertTime = alert.timestamp ? new Date(alert.timestamp).toUTCString() : new Date().toUTCString();
  const riskLevel = alert.trigger_data?.risk_level || 'EVALUATED';
  const riskScore = alert.trigger_data?.risk_score ?? 0;
  const isCritical = alert.priority === 'CRITICAL' || riskLevel === 'EXTREME';
  const effectiveModelVersion = modelVersion || 'HeatShield-ML v1.3.0 (Physics-Context Dual Engine)';

  // Subject line matching specification:
  // e.g., "HeatShield AI — High Heat Risk Advisory for Kakinada"
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

  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const accuracyStr = gpsAccuracy !== undefined ? `±${gpsAccuracy} m` : 'N/A';
  const locSourceStr = locationStatus || 'SAVED_LOCATION';
  const coordsStr = coordinates
    ? `${coordinates.latitude.toFixed(4)}° N, ${coordinates.longitude.toFixed(4)}° E`
    : 'Coordinates unavailable';
  const conditionStr = weatherCondition || 'Current Weather Observation';
  const observedTimeStr = weatherObservedAt || alertTime;
  const qualityStr = dataQualityStatus || alert.source_status || 'LIVE';
  const qualityExplainStr =
    dataQualityExplanation ||
    (qualityStr === 'LIVE'
      ? 'Fresh live observation from Open-Meteo API captured at dispatch.'
      : 'Cached observation from recent regional reading.');
  const calcTimeStr = riskCalculatedAt || alertTime;

  // Contributing factors (truthfully labeled as contributing factors, not exact causal weights)
  const factors = contributingFactors && contributingFactors.length > 0
    ? contributingFactors
    : [
        { name: 'Apparent Temperature', impact: 'high', description: `Thermal load feels like ${alert.trigger_data?.apparent_temperature ?? 'elevated'}°C` },
        { name: 'Relative Humidity', impact: 'moderate', description: `Vapor pressure at ${alert.trigger_data?.humidity ?? 'normal'}% influences sweat evaporation` },
        { name: 'Environmental Exposure', impact: 'moderate', description: 'Ambient thermal stress based on localized geographic coordinates' },
      ];

  // Risk badge color mapping
  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    LOW: { bg: '#064e3b', text: '#6ee7b7', border: '#059669' },
    MODERATE: { bg: '#78350f', text: '#fcd34d', border: '#d97706' },
    HIGH: { bg: '#7c2d12', text: '#fdba74', border: '#ea580c' },
    EXTREME: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  };
  const badge = badgeColors[riskLevel] || badgeColors.HIGH;

  // Plain-text alternative matching exact prompt format
  const factorsText = factors.map((f) => `- ${f.name}${f.description ? `: ${f.description}` : ''}`).join('\n');
  const precautionsText = precautionsList.map((p, idx) => `${idx + 1}. ${p}`).join('\n');

  const textContent = `${subject}

${greeting}

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

Important:
HeatShield AI provides environmental decision support and is not medical advice. Consult healthcare professionals for personal symptoms or emergencies.

Manage preferences / unsubscribe: https://heatshield-ai-kare.vercel.app/profile`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
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
          <h1 class="title">${subject}</h1>
          <div class="badge-row">
            <span class="badge">${riskLevel} RISK</span>
            <span class="score-label">${riskScore} / 100 Heat-Risk Index ${trend ? `(Trend: ${trend})` : ''}</span>
          </div>

          <div class="greeting">
            ${greeting}<br/>
            Here is your personalized point-in-time environmental heat-risk advisory for <strong>${loc}</strong>.
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
              ${factors.map((f) => `<li><strong>${f.name}:</strong> ${f.description || (f.direction === 'mitigating' ? 'Convective cooling relief' : 'Thermal stress escalator')}</li>`).join('')}
            </ul>
          </div>

          <div class="section-title">Recommended Personalized Precautions</div>
          <div class="precautions-box">
            <ol class="precautions-list">
              ${precautionsList.map((p) => `<li>${p}</li>`).join('')}
            </ol>
          </div>

          <div class="disclaimer">
            <strong>Important Safety Notice:</strong> HeatShield AI provides environmental decision support and is not medical advice. Consult healthcare professionals for personal health symptoms. In case of heat stroke, fainting, or severe dehydration, seek emergency medical care immediately.
          </div>

          <div class="meta-info">
            <div><strong>Location:</strong> ${loc} (${coordsStr}) • <strong>Source:</strong> ${locSourceStr}</div>
            <div><strong>Observation Time:</strong> ${observedTimeStr} • <strong>Data Status:</strong> ${qualityStr}</div>
            <div><strong>Inference Model:</strong> ${effectiveModelVersion}</div>
          </div>

          <div class="footer">
            Dispatched via HeatShield AI Dispatch Gateway • <a href="https://heatshield-ai-kare.vercel.app/profile">Manage Preferences / Unsubscribe</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (!apiKey || !apiKey.startsWith('re_') || apiKey.includes('your_')) {
    if (isProduction) {
      return {
        success: false,
        error: 'INVALID_CONFIGURATION: RESEND_API_KEY is missing or invalid in production environment.',
        errorCode: 'INVALID_CONFIGURATION',
      };
    }
    return {
      success: true,
      id: `resend_simulated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      replyTo: replyToAddress || undefined,
      html: htmlContent,
      text: textContent,
    });

    if (response.error) {
      console.warn('[HeatShield Email] Resend provider returned error:', response.error.message);
      const classified = classifyResendError(response.error);
      return {
        success: false,
        error: classified.message,
        errorCode: classified.errorCode,
        rawError: response.error.message,
      };
    }

    return {
      success: true,
      id: response.data?.id || `resend_${Date.now()}`,
    };
  } catch (err: any) {
    console.error('[HeatShield Email] Resend network/execution exception:', err?.message);
    const classified = classifyResendError(err);
    return {
      success: false,
      error: classified.message,
      errorCode: classified.errorCode,
      rawError: err?.message,
    };
  }
}




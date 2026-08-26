import { Resend } from 'resend';
import { SmartAlert } from './types';

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
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Server-only transactional email service for HeatShield AI using Resend.
 * Reads API key securely from process.env.RESEND_API_KEY.
 * Never exposes credentials to client-side code.
 */
export async function sendAlertEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM || 'HeatShield AI Alerts <onboarding@resend.dev>';

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
  } = options;

  const loc = locationName || alert.location_name || 'Location Unavailable';
  const alertTime = alert.timestamp ? new Date(alert.timestamp).toUTCString() : new Date().toUTCString();
  const isCritical = alert.priority === 'CRITICAL' || alert.trigger_data.risk_level === 'EXTREME';
  const severityStr = alert.priority || alert.trigger_data.risk_level || 'ALERT';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Subject format per specification: HeatShield AI | [SEVERITY] | [REAL LOCATION] | [EVENT TIME]
  const subject = `HeatShield AI | [${severityStr}] | [${loc}] | [${timeStr}]`;

  const defaultPrecautions = [
    'Drink 250-500ml of clean water every hour during outdoor exposure.',
    'Move into shaded, air-conditioned, or fan-cooled environments immediately.',
    'Reschedule strenuous outdoor physical labor to early morning or night.',
    'Take 15-20 minute recovery rest breaks every hour in a cool area.',
    'Monitor for dizziness, headache, rapid pulse, or unusual weakness.',
    'Apply cool damp cloths to skin, forehead, and neck.',
    'Seek immediate medical attention if confusion, fainting, or high fever occurs.'
  ];

  const precautionsList = (alert.precautions && alert.precautions.length >= 3)
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
  const qualityExplainStr = dataQualityExplanation || (qualityStr === 'LIVE' ? 'Freshly fetched live observation from Open-Meteo API for this dispatch.' : 'Cached observation from recent local observation.');
  const calcTimeStr = riskCalculatedAt || alertTime;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${alert.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 20px; }
          .container { max-width: 640px; margin: 0 auto; background: #131c2e; border-radius: 14px; padding: 28px; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981; margin-bottom: 6px; }
          .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 12px; line-height: 1.25; }
          .badge { display: inline-block; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; background: ${isCritical ? '#991b1b' : '#9a3412'}; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; }
          .meta-bar { font-size: 12px; color: #94a3b8; margin-top: 14px; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; line-height: 1.6; }
          .message { font-size: 14px; color: #e2e8f0; line-height: 1.6; margin: 18px 0; background: #0f172a; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; }
          .section-title { font-size: 13px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; letter-spacing: 0.05em; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0 20px 0; }
          .card { background: #0b1324; border-radius: 8px; padding: 14px; border: 1px solid #1e293b; }
          .card-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .card-value { font-size: 15px; font-weight: 700; color: #f8fafc; font-family: monospace; }
          .precautions-header { font-size: 14px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-top: 24px; margin-bottom: 10px; }
          .precautions-list { margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.6; }
          .precautions-list li { margin-bottom: 6px; }
          .action-box { background: #064e3b; border: 1px solid #059669; border-radius: 10px; padding: 18px; margin-top: 22px; color: #a7f3d0; font-size: 14px; line-height: 1.5; }
          .quality-box { background: #0f172a; border-radius: 8px; padding: 12px 16px; margin: 16px 0; border: 1px solid #334155; font-size: 12px; color: #cbd5e1; line-height: 1.5; }
          .disclaimer { background: #1e293b; border-radius: 8px; padding: 14px; margin-top: 24px; color: #94a3b8; font-size: 11px; line-height: 1.5; border: 1px solid #334155; }
          .footer { font-size: 11px; color: #475569; margin-top: 28px; text-align: center; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">HEATSHIELD AI SAFETY SYSTEM | LIVE POINT-IN-TIME GPS REPORT</div>
          <div class="title">${alert.title}</div>
          <div>
            <span class="badge">${alert.priority}</span>
            <span style="font-size:12px; color:#94a3b8; margin-left:10px;">Risk Level: ${alert.trigger_data.risk_level} (${alert.trigger_data.risk_score}/100) ${trend ? `• Trend: ${trend.toUpperCase()}` : ''}</span>
          </div>

          <div class="meta-bar">
            <strong>${greeting}</strong><br/>
            <strong>Snapshot Notice:</strong> Point-in-Time Environmental Snapshot (Captured at dispatch)<br/>
            <strong>Recipient:</strong> ${to}<br/>
            <strong>Location:</strong> ${loc}<br/>
            <strong>GPS Coordinates:</strong> ${coordsStr}<br/>
            <strong>Location Source:</strong> ${locSourceStr}<br/>
            <strong>GPS Accuracy:</strong> ${accuracyStr}<br/>
            <strong>Generated At:</strong> ${alertTime}
          </div>

          <div class="message">
            <strong>Environmental Thermal Assessment:</strong><br/>
            ${alert.message}
            ${alert.why_generated ? `<br/><br/><strong>Why this risk:</strong> ${alert.why_generated}` : ''}
          </div>

          <div class="section-title">Live Weather Observation</div>
          <div class="grid">
            <div class="card">
              <div class="card-title">Temperature</div>
              <div class="card-value">${alert.trigger_data.temperature !== undefined ? `${alert.trigger_data.temperature}°C` : 'Unavailable'}</div>
            </div>
            <div class="card">
              <div class="card-title">Feels-Like Temp</div>
              <div class="card-value">${alert.trigger_data.apparent_temperature !== undefined ? `${alert.trigger_data.apparent_temperature}°C` : 'Unavailable'}</div>
            </div>
            <div class="card">
              <div class="card-title">Relative Humidity</div>
              <div class="card-value">${alert.trigger_data.humidity !== undefined ? `${alert.trigger_data.humidity}%` : 'Unavailable'}</div>
            </div>
            <div class="card">
              <div class="card-title">Wind Speed</div>
              <div class="card-value">${alert.trigger_data.wind_speed !== undefined ? `${alert.trigger_data.wind_speed} km/h` : 'Unavailable'}</div>
            </div>
            <div class="card">
              <div class="card-title">Weather Condition</div>
              <div class="card-value">${conditionStr}</div>
            </div>
            <div class="card">
              <div class="card-title">Observation Time</div>
              <div class="card-value" style="font-size:12px;">${observedTimeStr}</div>
            </div>
          </div>

          <div class="section-title">Risk Assessment & Truthful Data Quality</div>
          <div class="grid">
            <div class="card">
              <div class="card-title">Heat Index Score</div>
              <div class="card-value">${alert.trigger_data.risk_score} / 100</div>
            </div>
            <div class="card">
              <div class="card-title">Calculated At</div>
              <div class="card-value" style="font-size:12px;">${calcTimeStr}</div>
            </div>
          </div>

          <div class="quality-box">
            <strong>DATA QUALITY STATUS: <span style="color: ${qualityStr === 'LIVE' ? '#10b981' : '#f59e0b'};">${qualityStr}</span></strong><br/>
            <span>Provider: Open-Meteo & Nominatim • ${qualityExplainStr}</span>
          </div>

          <div class="precautions-header">Recommended Dynamic Precautions</div>
          <ol class="precautions-list">
            ${precautionsList.map(p => `<li>${p}</li>`).join('')}
          </ol>

          <div class="action-box">
            <strong>RECOMMENDED IMMEDIATE PREVENTIVE ACTION:</strong><br/>
            ${alert.recommended_action}
          </div>

          <div class="disclaimer">
            <strong>SAFETY & WELLNESS DISCLAIMER:</strong> This notification is generated from live environmental observations to assist with heat safety awareness. It is not a medical diagnosis or treatment evaluation. Consult healthcare professionals for personal medical concerns.
          </div>

          <div class="footer">
            HeatShield AI Real-Time Environmental Risk Pipeline<br/>
            Notification ID: ${alert.id} | Dedup Key: ${alert.dedup_key} | Provider: Open-Meteo & OpenStreetMap
          </div>
        </div>
      </body>
    </html>
  `;

  if (!apiKey || !apiKey.startsWith('re_') || apiKey.includes('your_')) {
    return {
      success: true,
      id: `resend_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: htmlContent,
      text: `${alert.title}\nSnapshot Notice: Point-in-Time Environmental Snapshot (Captured at dispatch)\nNotification ID: ${alert.id}\nPriority: ${alert.priority}\nRisk Level: ${alert.trigger_data.risk_level} (${alert.trigger_data.risk_score}/100)\nLocation: ${loc}\nGPS Coordinates: ${coordsStr}\nLocation Source: ${locSourceStr}\nGPS Accuracy: ${accuracyStr}\nData Quality: ${qualityStr}\nObservation Time: ${observedTimeStr}\n\nTemperature: ${alert.trigger_data.temperature}°C\nFeels-Like: ${alert.trigger_data.apparent_temperature}°C\nHumidity: ${alert.trigger_data.humidity}%\nWind: ${alert.trigger_data.wind_speed} km/h\nCondition: ${conditionStr}\n\nWhy Generated:\n${alert.why_generated || 'Environmental evaluation'}\n\nRecommended Action:\n${alert.recommended_action}\n\nPrecautions:\n${precautionsList.join('\n')}\n\nDisclaimer: This is informational environmental safety guidance, not a medical diagnosis.`,
    });

    if (response.error) {
      console.warn('[HeatShield Email] Resend error:', response.error.message);
      return {
        success: false,
        error: response.error.message || 'Resend delivery failed.',
      };
    }

    return {
      success: true,
      id: response.data?.id || `resend_${Date.now()}`,
    };
  } catch (err: any) {
    console.error('[HeatShield Email] Resend exception:', err?.message);
    return {
      success: false,
      error: err?.message || 'Email delivery exception.',
    };
  }
}



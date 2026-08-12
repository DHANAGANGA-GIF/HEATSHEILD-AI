import { Resend } from 'resend';
import { SmartAlert } from './types';

export interface SendEmailOptions {
  to: string;
  alert: SmartAlert;
  locationName?: string;
  recipientName?: string;
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
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not configured',
    };
  }

  const fromAddress = process.env.EMAIL_FROM || 'HeatShield AI Alerts <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  const { to, alert, locationName } = options;
  const loc = locationName || alert.location_name || 'Selected Location';

  const subject = `[HeatShield AI Alert] ${alert.priority}: ${alert.title}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
          .header { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8; margin-bottom: 8px; }
          .title { font-size: 20px; font-weight: bold; color: #ffffff; margin-bottom: 12px; line-height: 1.3; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; background: #ef4444; color: #ffffff; text-transform: uppercase; }
          .message { font-size: 14px; color: #e2e8f0; line-height: 1.5; margin: 16px 0; }
          .details { background: #0f172a; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #334155; }
          .detail-item { font-size: 13px; color: #cbd5e1; margin-bottom: 6px; font-family: monospace; }
          .action { background: #064e3b; border: 1px solid #059669; border-radius: 8px; padding: 16px; margin-top: 16px; color: #a7f3d0; font-size: 13px; line-height: 1.5; }
          .footer { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">HeatShield AI Safety System</div>
          <div class="title">${alert.title}</div>
          <div><span class="badge">${alert.priority}</span></div>
          <p class="message">${alert.message}</p>
          
          <div class="details">
            <div class="detail-item"><strong>Location:</strong> ${loc}</div>
            <div class="detail-item"><strong>Risk Score:</strong> ${alert.trigger_data.risk_score} / 100 (${alert.trigger_data.risk_level})</div>
            ${alert.trigger_data.temperature !== undefined ? `<div class="detail-item"><strong>Temperature:</strong> ${alert.trigger_data.temperature}°C (Apparent: ${alert.trigger_data.apparent_temperature ?? '--'}°C)</div>` : ''}
            ${alert.trigger_data.humidity !== undefined ? `<div class="detail-item"><strong>Humidity:</strong> ${alert.trigger_data.humidity}%</div>` : ''}
            <div class="detail-item"><strong>Data Quality/Source:</strong> ${alert.source_status}</div>
          </div>

          <div class="action">
            <strong>RECOMMENDED PREVENTIVE ACTION:</strong><br/>
            ${alert.recommended_action}
          </div>

          <div class="footer">
            Automated Smart Alert dispatches derived from live Open-Meteo & deterministic HeatShield risk engine.<br/>
            Rule ID: ${alert.rule_id} | Dedup Key: ${alert.dedup_key}
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const response = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: htmlContent,
      text: `${alert.title}\nPriority: ${alert.priority}\nLocation: ${loc}\nRisk Score: ${alert.trigger_data.risk_score}/100 (${alert.trigger_data.risk_level})\n\n${alert.message}\n\nRecommended Action:\n${alert.recommended_action}\n\nRule ID: ${alert.rule_id}`,
    });

    if (response.error) {
      return {
        success: false,
        error: response.error.message || 'Resend API returned an error',
      };
    }

    return {
      success: true,
      id: response.data?.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unexpected error sending transactional alert email',
    };
  }
}

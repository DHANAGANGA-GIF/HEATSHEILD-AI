import { google } from 'googleapis';
import {
  IEmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailServiceStatus,
  GmailErrorCode,
} from './types';
import { generateEmailContent, isValidEmail } from './template';
import { getGmailRefreshToken, getStoredSenderEmail } from './token-store';

/**
 * Creates RFC 2822 compliant MIME email string, then encodes as URL-safe base64.
 */
function createRawEmail(options: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): string {
  const boundary = `====_HeatShield_Boundary_${Date.now()}_====`;
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(options.subject, 'utf-8').toString('base64')}?=`;

  const headers = [
    `From: HeatShield AI <${options.from}>`,
    `To: ${options.to}`,
    ...(options.replyTo ? [`Reply-To: ${options.replyTo}`] : []),
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ];

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.html,
    '',
    `--${boundary}--`,
  ];

  const fullMessage = headers.concat(body).join('\r\n');
  return Buffer.from(fullMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Normalizes Gmail API exceptions into structured, actionable error codes.
 */
export function classifyGmailError(error: any): { errorCode: GmailErrorCode; message: string } {
  const errMsg = typeof error === 'string' ? error : error?.message || '';
  const status = error?.status || error?.response?.status || error?.code || 0;
  const lower = `${errMsg} ${status}`.toLowerCase();

  if (
    lower.includes('invalid_grant') ||
    lower.includes('token expired') ||
    lower.includes('revoked') ||
    lower.includes('unauthorized') ||
    lower.includes('auth') ||
    status === 401
  ) {
    return {
      errorCode: 'GMAIL_AUTH_REQUIRED',
      message:
        'GMAIL_AUTH_REQUIRED: Gmail OAuth credentials expired, revoked, or missing. Reconnect at /api/email/google/connect.',
    };
  }

  if (
    lower.includes('rate_limit') ||
    lower.includes('user rate limit exceeded') ||
    lower.includes('daily limit') ||
    status === 429
  ) {
    return {
      errorCode: 'GMAIL_RATE_LIMITED',
      message: 'GMAIL_RATE_LIMITED: Google API rate limit exceeded. Please throttle dispatch frequency.',
    };
  }

  if (
    lower.includes('invalid recipient') ||
    lower.includes('recipient address') ||
    lower.includes('malformed') ||
    lower.includes('invalid to') ||
    status === 400
  ) {
    return {
      errorCode: 'GMAIL_INVALID_RECIPIENT',
      message: 'GMAIL_INVALID_RECIPIENT: The recipient email address is invalid or rejected by Gmail.',
    };
  }

  if (
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('socket') ||
    status === 503 ||
    status === 504
  ) {
    return {
      errorCode: 'GMAIL_NETWORK_ERROR',
      message: 'GMAIL_NETWORK_ERROR: Network failure communicating with Google Gmail API endpoints.',
    };
  }

  return {
    errorCode: 'GMAIL_PROVIDER_ERROR',
    message: `GMAIL_PROVIDER_ERROR: ${errMsg || 'Gmail API rejected transmission.'}`,
  };
}

export class GmailEmailProvider implements IEmailProvider {
  readonly name = 'gmail' as const;

  /**
   * Initializes server-side OAuth2 client with minimal required scope:
   * https://www.googleapis.com/auth/gmail.send
   */
  private getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || 'https://heatshield-ai-kare.vercel.app/api/email/google/callback';

    if (!clientId || !clientSecret) {
      return null;
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async getStatus(): Promise<EmailServiceStatus> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const senderEmail = getStoredSenderEmail() || process.env.GMAIL_SENDER_EMAIL;
    const refreshToken = await getGmailRefreshToken();

    if (!clientId || !clientSecret) {
      return {
        provider: 'gmail',
        mode: 'NOT_READY',
        configured: false,
        senderConfigured: false,
        oauthConnected: false,
        message: 'Gmail provider not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.',
      };
    }

    if (!senderEmail || !senderEmail.includes('@')) {
      return {
        provider: 'gmail',
        mode: 'NOT_READY',
        configured: true,
        senderConfigured: false,
        oauthConnected: false,
        message: 'Gmail provider missing valid GMAIL_SENDER_EMAIL configuration.',
      };
    }

    if (!refreshToken) {
      return {
        provider: 'gmail',
        mode: 'NOT_READY',
        configured: true,
        senderConfigured: true,
        senderEmail,
        oauthConnected: false,
        message: 'Gmail OAuth authorization required. Admin must visit /api/email/google/connect to authorize background sending.',
      };
    }

    return {
      provider: 'gmail',
      mode: 'PRODUCTION',
      configured: true,
      senderConfigured: true,
      senderEmail,
      oauthConnected: true,
      domainVerified: true,
      message: `Gmail API delivery active for ${senderEmail} (authorized offline background dispatch).`,
    };
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const senderEmail = getStoredSenderEmail() || process.env.GMAIL_SENDER_EMAIL;
    const replyTo = options.replyTo || process.env.GMAIL_REPLY_TO || senderEmail;
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    // 1. Recipient safety check
    if (!isValidEmail(options.to)) {
      return {
        success: false,
        provider: 'gmail',
        error: 'GMAIL_INVALID_RECIPIENT: Recipient email address format is invalid.',
        errorCode: 'GMAIL_INVALID_RECIPIENT',
        errorMessage: 'Invalid recipient email format',
      };
    }

    // 2. Sender email check (Strictly enforce GMAIL_SENDER_EMAIL to prevent user spoofing)
    if (!senderEmail || !senderEmail.includes('@')) {
      return {
        success: false,
        provider: 'gmail',
        error: 'GMAIL_CONFIG_ERROR: GMAIL_SENDER_EMAIL environment variable is missing or invalid.',
        errorCode: 'GMAIL_CONFIG_ERROR',
        errorMessage: 'Missing sender configuration',
      };
    }

    const oauth2Client = this.getOAuth2Client();
    const refreshToken = await getGmailRefreshToken();

    // 3. OAuth readiness check
    if (!oauth2Client || !refreshToken) {
      if (!isProduction) {
        // Safe simulated send in test/development environments
        const simId = `gmail_simulated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        return {
          success: true,
          provider: 'gmail',
          messageId: simId,
          id: simId,
        };
      }

      return {
        success: false,
        provider: 'gmail',
        error: 'GMAIL_AUTH_REQUIRED: Gmail OAuth refresh token missing. Admin must authorize via /api/email/google/connect.',
        errorCode: 'GMAIL_AUTH_REQUIRED',
        errorMessage: 'OAuth authorization required',
      };
    }

    try {
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const rendered = generateEmailContent(options);

      const raw = createRawEmail({
        to: options.to,
        from: senderEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo,
      });

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
        },
      });

      const messageId = res.data.id || `gmail_${Date.now()}`;
      return {
        success: true,
        provider: 'gmail',
        messageId,
        id: messageId,
      };
    } catch (err: any) {
      const classified = classifyGmailError(err);
      return {
        success: false,
        provider: 'gmail',
        error: classified.message,
        errorCode: classified.errorCode,
        errorMessage: classified.message,
        rawError: err?.message,
      };
    }
  }
}

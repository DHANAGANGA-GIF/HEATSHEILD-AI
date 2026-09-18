import { Resend } from 'resend';
import {
  IEmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailServiceStatus,
  ResendErrorCode,
} from './types';
import { generateEmailContent, isValidEmail } from './template';

let domainVerificationCache: {
  domain: string;
  verified: boolean;
  status: string;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute

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
      errorCode: 'RESEND_DOMAIN_NOT_VERIFIED',
      message:
        'RESEND_DOMAIN_NOT_VERIFIED: Resend domain restriction active. The sender domain is either unverified or in sandbox testing mode (onboarding@resend.dev). Configure and verify your custom domain in Resend or switch to Gmail API (EMAIL_PROVIDER=gmail).',
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
      errorCode: 'RESEND_INVALID_RECIPIENT',
      message: 'RESEND_INVALID_RECIPIENT: The recipient email address is invalid or was rejected by Resend.',
    };
  }

  if (
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return {
      errorCode: 'RESEND_RATE_LIMITED',
      message: 'RESEND_RATE_LIMITED: Resend rate limit reached. Please wait before triggering further email dispatches.',
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
      errorCode: 'RESEND_CONFIG_ERROR',
      message: 'RESEND_CONFIG_ERROR: RESEND_API_KEY is missing or invalid in server environment configuration.',
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
      errorCode: 'RESEND_NETWORK_ERROR',
      message: 'RESEND_NETWORK_ERROR: Network connectivity failed while contacting Resend API.',
    };
  }

  return {
    errorCode: 'RESEND_PROVIDER_ERROR',
    message: `RESEND_PROVIDER_ERROR: ${errMsg || 'Resend provider rejected delivery.'}`,
  };
}

export class ResendEmailProvider implements IEmailProvider {
  readonly name = 'resend' as const;

  async getStatus(): Promise<EmailServiceStatus> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    const hasKey = Boolean(apiKey && apiKey.startsWith('re_') && !apiKey.includes('your_'));

    if (!hasKey) {
      return {
        provider: 'resend',
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
        provider: 'resend',
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
        provider: 'resend',
        mode: 'NOT_READY',
        configured: true,
        domain: '',
        domainVerified: false,
        senderConfigured: false,
        message: 'EMAIL_FROM has an invalid email format or missing domain.',
      };
    }

    const domain = domainMatch[1].toLowerCase();

    if (domain === 'resend.dev' || fromAddress.includes('onboarding@resend.dev')) {
      return {
        provider: 'resend',
        mode: 'SANDBOX',
        configured: true,
        domain: 'resend.dev',
        domainVerified: false,
        senderConfigured: true,
        senderEmail: fromAddress,
        message: 'Resend sandbox mode — emails can only be sent to the Resend account owner.',
      };
    }

    const now = Date.now();
    if (
      domainVerificationCache &&
      domainVerificationCache.domain === domain &&
      now - domainVerificationCache.timestamp < CACHE_TTL_MS
    ) {
      if (domainVerificationCache.verified) {
        return {
          provider: 'resend',
          mode: 'PRODUCTION',
          configured: true,
          domain,
          domainVerified: true,
          senderConfigured: true,
          senderEmail: fromAddress,
          message: `Production email delivery enabled for ${domain}.`,
        };
      }
      return {
        provider: 'resend',
        mode: 'NOT_READY',
        configured: true,
        domain,
        domainVerified: false,
        senderConfigured: true,
        senderEmail: fromAddress,
        message: `Domain "${domain}" is not verified in Resend (status: ${domainVerificationCache.status}).`,
      };
    }

    try {
      const resend = new Resend(apiKey);
      const listResult = await resend.domains.list();

      if (listResult.error) {
        return {
          provider: 'resend',
          mode: 'NOT_READY',
          configured: true,
          domain,
          domainVerified: false,
          senderConfigured: true,
          senderEmail: fromAddress,
          message: `Unable to verify domain status with Resend: ${listResult.error.message}`,
        };
      }

      const domainList = listResult.data?.data || [];
      const matched = domainList.find((d: any) => d.name?.toLowerCase() === domain);

      if (!matched) {
        domainVerificationCache = { domain, verified: false, status: 'not_found', timestamp: now };
        return {
          provider: 'resend',
          mode: 'NOT_READY',
          configured: true,
          domain,
          domainVerified: false,
          senderConfigured: true,
          senderEmail: fromAddress,
          message: `Domain "${domain}" is not registered in your Resend account. Production email delivery is not ready.`,
        };
      }

      const isVerified = matched.status === 'verified';
      domainVerificationCache = {
        domain,
        verified: isVerified,
        status: matched.status || 'unverified',
        timestamp: now,
      };

      if (!isVerified) {
        return {
          provider: 'resend',
          mode: 'NOT_READY',
          configured: true,
          domain,
          domainVerified: false,
          senderConfigured: true,
          senderEmail: fromAddress,
          message: `Domain "${domain}" is currently "${matched.status}" (pending verification in Resend).`,
        };
      }

      return {
        provider: 'resend',
        mode: 'PRODUCTION',
        configured: true,
        domain,
        domainVerified: true,
        senderConfigured: true,
        senderEmail: fromAddress,
        message: `Production email delivery enabled for ${domain}.`,
      };
    } catch (err: any) {
      return {
        provider: 'resend',
        mode: 'NOT_READY',
        configured: true,
        domain,
        domainVerified: false,
        senderConfigured: true,
        senderEmail: fromAddress,
        message: `Error checking domain status with Resend: ${err?.message || 'Network exception'}`,
      };
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'HeatShield AI Alerts <onboarding@resend.dev>';
    const replyToAddress = options.replyTo || process.env.RESEND_REPLY_TO;
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (!isValidEmail(options.to)) {
      return {
        success: false,
        provider: 'resend',
        error: 'RESEND_INVALID_RECIPIENT: Recipient email address format is invalid.',
        errorCode: 'RESEND_INVALID_RECIPIENT',
        errorMessage: 'Invalid recipient format',
      };
    }

    if (!fromAddress || !fromAddress.includes('@')) {
      return {
        success: false,
        provider: 'resend',
        error:
          'RESEND_CONFIG_ERROR: Email service is misconfigured. Set RESEND_FROM_EMAIL or EMAIL_FROM to a valid email address.',
        errorCode: 'RESEND_CONFIG_ERROR',
        errorMessage: 'Invalid from address configuration',
      };
    }

    const rendered = generateEmailContent(options);

    if (!apiKey || !apiKey.startsWith('re_') || apiKey.includes('your_')) {
      if (isProduction) {
        return {
          success: false,
          provider: 'resend',
          error:
            'RESEND_CONFIG_ERROR: RESEND_API_KEY is missing or invalid in production environment.',
          errorCode: 'RESEND_CONFIG_ERROR',
          errorMessage: 'Missing API Key in production',
        };
      }
      const simId = `resend_simulated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        success: true,
        provider: 'resend',
        messageId: simId,
        id: simId,
      };
    }

    try {
      const resend = new Resend(apiKey);
      const response = await resend.emails.send({
        from: fromAddress,
        to: [options.to],
        subject: rendered.subject,
        replyTo: replyToAddress || undefined,
        html: rendered.html,
        text: rendered.text,
      });

      if (response.error) {
        const classified = classifyResendError(response.error);
        return {
          success: false,
          provider: 'resend',
          error: classified.message,
          errorCode: classified.errorCode,
          errorMessage: classified.message,
          rawError: response.error.message,
        };
      }

      const msgId = response.data?.id || `resend_${Date.now()}`;
      return {
        success: true,
        provider: 'resend',
        messageId: msgId,
        id: msgId,
      };
    } catch (err: any) {
      const classified = classifyResendError(err);
      return {
        success: false,
        provider: 'resend',
        error: classified.message,
        errorCode: classified.errorCode,
        errorMessage: classified.message,
        rawError: err?.message,
      };
    }
  }
}

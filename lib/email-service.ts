import {
  getEmailProvider,
  IEmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailServiceStatus,
  ResendErrorCode,
  classifyResendError,
  ContributingFactorItem,
} from './email-providers';

export {
  getEmailProvider,
  classifyResendError,
};
export type {
  ContributingFactorItem,
  SendEmailOptions,
  SendEmailResult,
  EmailServiceStatus,
  ResendErrorCode,
  IEmailProvider,
};

/**
 * Transient error categories eligible for retry with exponential backoff.
 * Hard failures (invalid recipient, missing auth, invalid config) must NEVER be retried.
 */
function isTransientError(errorCode?: string): boolean {
  if (!errorCode) return false;
  const transientCodes = [
    'NETWORK_ERROR',
    'RESEND_NETWORK_ERROR',
    'GMAIL_NETWORK_ERROR',
    'RATE_LIMITED',
    'RESEND_RATE_LIMITED',
    'GMAIL_RATE_LIMITED',
  ];
  return transientCodes.includes(errorCode);
}

/**
 * Universal transactional email dispatcher for HeatShield AI.
 * Routes automatically through the active provider (Gmail or Resend) based on EMAIL_PROVIDER.
 * Implements exponential backoff retries (up to 3 attempts) for transient network or rate-limit errors.
 */
export async function sendAlertEmail(
  options: SendEmailOptions,
  providerOverride?: string
): Promise<SendEmailResult> {
  const provider = getEmailProvider(providerOverride);
  const maxRetries = 3;
  let attempt = 0;
  let lastResult: SendEmailResult = {
    success: false,
    provider: provider.name,
    error: 'Initial dispatch attempt not completed',
  };

  while (attempt < maxRetries) {
    attempt++;
    lastResult = await provider.sendEmail(options);

    if (lastResult.success) {
      return lastResult;
    }

    // Do NOT retry permanent / deterministic errors
    if (!isTransientError(lastResult.errorCode)) {
      break;
    }

    if (attempt < maxRetries) {
      // Exponential backoff: 300ms, 600ms (shorter for serverless environments)
      const backoffMs = Math.min(300 * Math.pow(2, attempt - 1), 2000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  return lastResult;
}

/**
 * Returns the public status of the active transactional email service.
 * Respects EMAIL_PROVIDER environment configuration.
 * Authoritative: checks Resend domains or Google OAuth credentials.
 * NEVER exposes secret keys, refresh tokens, or private credentials.
 */
export async function getEmailServiceStatus(): Promise<EmailServiceStatus> {
  const provider = getEmailProvider();
  return provider.getStatus();
}

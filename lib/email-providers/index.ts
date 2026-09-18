import { IEmailProvider } from './types';
import { GmailEmailProvider } from './gmail-provider';
import { ResendEmailProvider } from './resend-provider';

export * from './types';
export * from './template';
export * from './token-store';
export * from './gmail-provider';
export * from './resend-provider';

let singletonGmail: GmailEmailProvider | null = null;
let singletonResend: ResendEmailProvider | null = null;

/**
 * Returns the configured email provider.
 * Selection is driven by environment variable: EMAIL_PROVIDER (gmail | resend).
 * Defaults to 'resend' when unset to preserve backwards compatibility.
 */
export function getEmailProvider(explicitProvider?: string): IEmailProvider {
  const chosen = (explicitProvider || process.env.EMAIL_PROVIDER || 'resend')
    .toLowerCase()
    .trim();

  if (chosen === 'gmail') {
    if (!singletonGmail) {
      singletonGmail = new GmailEmailProvider();
    }
    return singletonGmail;
  }

  // Default to Resend
  if (!singletonResend) {
    singletonResend = new ResendEmailProvider();
  }
  return singletonResend;
}

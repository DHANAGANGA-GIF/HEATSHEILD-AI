import { SmartAlert } from '../types';

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
  subject?: string;
  html?: string;
  text?: string;
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
  from?: string;
}

export type GmailErrorCode =
  | 'GMAIL_AUTH_REQUIRED'
  | 'GMAIL_RATE_LIMITED'
  | 'GMAIL_INVALID_RECIPIENT'
  | 'GMAIL_NETWORK_ERROR'
  | 'GMAIL_PROVIDER_ERROR'
  | 'GMAIL_CONFIG_ERROR';

export type ResendErrorCode =
  | 'EMAIL_DOMAIN_NOT_VERIFIED'
  | 'RESEND_DOMAIN_NOT_VERIFIED'
  | 'INVALID_RECIPIENT'
  | 'RESEND_INVALID_RECIPIENT'
  | 'RATE_LIMITED'
  | 'RESEND_RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'RESEND_PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'RESEND_NETWORK_ERROR'
  | 'INVALID_CONFIGURATION'
  | 'RESEND_CONFIG_ERROR';

export type EmailErrorCode = GmailErrorCode | ResendErrorCode;

export interface SendEmailResult {
  success: boolean;
  provider: 'gmail' | 'resend';
  messageId?: string;
  id?: string; // alias for backward compatibility with existing tests
  error?: string;
  errorCode?: EmailErrorCode;
  errorMessage?: string;
  rawError?: string;
}

export interface EmailServiceStatus {
  provider: 'gmail' | 'resend';
  mode: 'SANDBOX' | 'PRODUCTION' | 'NOT_READY';
  configured: boolean;
  domain?: string;
  domainVerified?: boolean;
  senderConfigured: boolean;
  senderEmail?: string;
  oauthConnected?: boolean;
  message: string;
}

export interface IEmailProvider {
  readonly name: 'gmail' | 'resend';
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  getStatus(): Promise<EmailServiceStatus>;
}

/**
 * HeatShield AI — Safe Server Environment Validator
 *
 * Validates required server-side configuration at runtime without leaking secret values.
 * NEVER prints or logs secret contents.
 */

export interface ServerEnvStatus {
  isValid: boolean;
  hasFirebaseServiceAccount: boolean;
  hasResendApiKey: boolean;
  hasEmailFrom: boolean;
  isResendSandbox: boolean;
  missingVariables: string[];
}

export function validateServerEnvironment(): ServerEnvStatus {
  const missing: string[] = [];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  const hasFirebaseServiceAccount = Boolean(
    serviceAccount && serviceAccount.trim().startsWith('{') && serviceAccount.includes('project_id')
  );
  if (!hasFirebaseServiceAccount) {
    missing.push('FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  const hasResendApiKey = Boolean(
    resendKey && resendKey.startsWith('re_') && !resendKey.includes('your_')
  );
  if (!hasResendApiKey) {
    missing.push('RESEND_API_KEY');
  }

  const hasEmailFrom = Boolean(emailFrom && emailFrom.includes('@'));
  if (!hasEmailFrom) {
    missing.push('EMAIL_FROM');
  }

  const isResendSandbox = Boolean(emailFrom && emailFrom.includes('onboarding@resend.dev'));

  return {
    isValid: missing.length === 0,
    hasFirebaseServiceAccount,
    hasResendApiKey,
    hasEmailFrom,
    isResendSandbox,
    missingVariables: missing,
  };
}

import crypto from 'crypto';

/**
 * Server-side encryption using AES-256-GCM.
 * Used for securing OAuth refresh tokens in database/storage.
 * NEVER exposed to client or browser.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.RESEND_API_KEY ||
    'heatshield_default_secure_vault_key_2026_cse_aiml';
  return crypto.scryptSync(secret, 'heatshield_token_salt_vault_99', 32);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 */
export function encryptString(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM payload back to plaintext.
 */
export function decryptString(ciphertext: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

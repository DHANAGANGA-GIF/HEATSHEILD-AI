import { isSupabaseConfigured, supabase } from '../supabase';
import { encryptString, decryptString } from '../crypto';

// In-memory cache for fast access during runtime
let inMemoryRefreshToken: string | null = null;
let inMemorySenderEmail: string | null = null;

/**
 * Retrieves the Gmail OAuth2 refresh token from:
 * 1. In-memory runtime cache
 * 2. Supabase `oauth_tokens` table (decrypted)
 * 3. Environment variable `GMAIL_REFRESH_TOKEN`
 */
export async function getGmailRefreshToken(): Promise<string | null> {
  if (inMemoryRefreshToken) {
    return inMemoryRefreshToken;
  }

  // 1. Try Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('encrypted_token, iv, auth_tag, account_email')
        .eq('provider', 'google')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.encrypted_token && data.iv && data.auth_tag) {
        try {
          const decrypted = decryptString(data.encrypted_token, data.iv, data.auth_tag);
          if (decrypted && decrypted.length > 5) {
            inMemoryRefreshToken = decrypted;
            if (data.account_email) {
              inMemorySenderEmail = data.account_email;
            }
            return decrypted;
          }
        } catch (decErr) {
          console.warn('[HeatShield:WARN] Failed to decrypt stored oauth token:', decErr);
        }
      }
    } catch (dbErr) {
      console.warn('[HeatShield:WARN] Supabase oauth_tokens query error:', dbErr);
    }
  }

  // 2. Fall back to environment variable
  const envToken = process.env.GMAIL_REFRESH_TOKEN;
  if (envToken && envToken.trim() && !envToken.includes('your_')) {
    return envToken.trim();
  }

  return null;
}

/**
 * Securely stores the Gmail OAuth2 refresh token.
 * Uses AES-256-GCM encryption before writing to Supabase.
 */
export async function saveGmailRefreshToken(
  refreshToken: string,
  accountEmail?: string
): Promise<{ success: boolean; error?: string }> {
  inMemoryRefreshToken = refreshToken;
  if (accountEmail) {
    inMemorySenderEmail = accountEmail;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { ciphertext, iv, authTag } = encryptString(refreshToken);

      // Check if a record already exists
      const { data: existing } = await supabase
        .from('oauth_tokens')
        .select('id')
        .eq('provider', 'google')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('oauth_tokens')
          .update({
            encrypted_token: ciphertext,
            iv,
            auth_tag: authTag,
            account_email: accountEmail || process.env.GMAIL_SENDER_EMAIL || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          return { success: false, error: error.message };
        }
      } else {
        const { error } = await supabase.from('oauth_tokens').insert({
          provider: 'google',
          encrypted_token: ciphertext,
          iv,
          auth_tag: authTag,
          scope: 'https://www.googleapis.com/auth/gmail.send',
          account_email: accountEmail || process.env.GMAIL_SENDER_EMAIL || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database error saving token' };
    }
  }

  // In-memory persistence active
  return { success: true };
}

/**
 * Returns the cached account email associated with the token, if known.
 */
export function getStoredSenderEmail(): string | null {
  return inMemorySenderEmail || process.env.GMAIL_SENDER_EMAIL || null;
}

/**
 * Clears the runtime token cache (useful for tests)
 */
export function clearTokenCacheForTesting(): void {
  inMemoryRefreshToken = null;
  inMemorySenderEmail = null;
}

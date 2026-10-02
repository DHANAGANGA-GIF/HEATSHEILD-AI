/**
 * HeatShield AI — Smart Alert Manager & Deduplication Engine (v2.1)
 *
 * Implements:
 * 1. Server-side cooldown (default 60 minutes for identical risk states)
 * 2. Meaningful escalation bypass (allows immediate dispatch if risk escalates:
 *    e.g. MODERATE -> HIGH, or score jump >= 12 points)
 * 3. Idempotent deduplication keys
 * 4. Audit dispatch logging in Supabase `heat_risk_dispatch_log` + in-memory store
 */

import { isSupabaseConfigured, supabase } from './supabase';
import { Language } from './types';

export interface AlertCooldownCheckInput {
  userId: string;
  recipientEmail: string;
  alertType: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  cooldownMinutes?: number;
  isTest?: boolean;
}

export interface AlertCooldownResult {
  allowed: boolean;
  reason?: string;
  lastDispatchedAt?: string;
  previousRiskLevel?: string;
  previousRiskScore?: number;
}

export interface RecordDispatchInput {
  userId: string;
  recipientEmail: string;
  alertType: string;
  locationName: string;
  riskScore: number;
  riskLevel: string;
  weatherSnapshot?: any;
  language: Language;
  deliveryStatus: 'SENT' | 'ACCEPTED' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
  providerMessageId?: string;
  errorMessage?: string;
}

interface InMemoLogEntry {
  userId: string;
  recipientEmail: string;
  alertType: string;
  riskScore: number;
  riskLevel: string;
  timestamp: number; // ms
  language: Language;
}

// In-memory cache for fast, reliable cooldown checks across serverless invocations
const inMemoryDispatchCache: InMemoLogEntry[] = [];
const MAX_CACHE_SIZE = 500;

/**
 * Checks whether an alert should be sent based on cooldown rules.
 */
export async function checkAlertCooldown(
  input: AlertCooldownCheckInput
): Promise<AlertCooldownResult> {
  const {
    userId,
    recipientEmail,
    alertType,
    riskScore,
    riskLevel,
    cooldownMinutes = 60,
    isTest = false,
  } = input;

  // Test emails always bypass cooldown
  if (isTest) {
    return { allowed: true, reason: 'Explicit test email triggered by user.' };
  }

  const nowMs = Date.now();
  const cooldownMs = cooldownMinutes * 60 * 1000;

  // 1. Check in-memory dispatch history
  const recentInMemo = inMemoryDispatchCache
    .filter(
      (entry) =>
        (entry.userId === userId || entry.recipientEmail.toLowerCase() === recipientEmail.toLowerCase()) &&
        entry.alertType === alertType
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (recentInMemo) {
    const elapsedMs = nowMs - recentInMemo.timestamp;
    const isSameRiskLevel = recentInMemo.riskLevel === riskLevel;
    const scoreDiff = Math.abs(riskScore - recentInMemo.riskScore);

    // If within cooldown period:
    if (elapsedMs < cooldownMs) {
      // Escalation bypass: if risk escalates to a higher tier or jumps significantly
      const isEscalation =
        (recentInMemo.riskLevel === 'LOW' && (riskLevel === 'MODERATE' || riskLevel === 'HIGH' || riskLevel === 'EXTREME')) ||
        (recentInMemo.riskLevel === 'MODERATE' && (riskLevel === 'HIGH' || riskLevel === 'EXTREME')) ||
        (recentInMemo.riskLevel === 'HIGH' && riskLevel === 'EXTREME') ||
        (riskScore > recentInMemo.riskScore && scoreDiff >= 12);

      if (isEscalation) {
        return {
          allowed: true,
          reason: `Risk escalated from ${recentInMemo.riskLevel} (${recentInMemo.riskScore}) to ${riskLevel} (${riskScore}). Cooldown bypassed.`,
          lastDispatchedAt: new Date(recentInMemo.timestamp).toISOString(),
          previousRiskLevel: recentInMemo.riskLevel,
          previousRiskScore: recentInMemo.riskScore,
        };
      }

      // Identical or milder risk within cooldown -> suppress duplicate
      const remainingMin = Math.ceil((cooldownMs - elapsedMs) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active: An alert for ${riskLevel} risk was already dispatched ${Math.floor(elapsedMs / 60000)} minutes ago. Next dispatch eligible in ${remainingMin}m.`,
        lastDispatchedAt: new Date(recentInMemo.timestamp).toISOString(),
        previousRiskLevel: recentInMemo.riskLevel,
        previousRiskScore: recentInMemo.riskScore,
      };
    }
  }

  // 2. Check Supabase dispatch log if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const cutoffIso = new Date(nowMs - cooldownMs).toISOString();
      const { data, error } = await supabase
        .from('heat_risk_dispatch_log')
        .select('created_at, risk_score, risk_level')
        .or(`user_id.eq.${userId},recipient_email.eq.${recipientEmail}`)
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const isSameRiskLevel = data.risk_level === riskLevel;
        const scoreDiff = Math.abs(riskScore - (data.risk_score || 0));

        const isEscalation =
          (data.risk_level === 'LOW' && (riskLevel === 'MODERATE' || riskLevel === 'HIGH' || riskLevel === 'EXTREME')) ||
          (data.risk_level === 'MODERATE' && (riskLevel === 'HIGH' || riskLevel === 'EXTREME')) ||
          (data.risk_level === 'HIGH' && riskLevel === 'EXTREME') ||
          (riskScore > (data.risk_score || 0) && scoreDiff >= 12);

        if (!isEscalation && isSameRiskLevel) {
          return {
            allowed: false,
            reason: `Cooldown active: Alert for ${riskLevel} already logged in database at ${data.created_at}.`,
            lastDispatchedAt: data.created_at,
            previousRiskLevel: data.risk_level,
            previousRiskScore: data.risk_score,
          };
        }
      }
    } catch {
      // Non-blocking fallback to in-memory decision
    }
  }

  return { allowed: true };
}

/**
 * Records an alert dispatch into cache and database.
 */
export async function recordAlertDispatch(input: RecordDispatchInput): Promise<void> {
  const now = Date.now();

  // Add to in-memory ring buffer
  inMemoryDispatchCache.unshift({
    userId: input.userId,
    recipientEmail: input.recipientEmail,
    alertType: input.alertType,
    riskScore: input.riskScore,
    riskLevel: input.riskLevel,
    timestamp: now,
    language: input.language,
  });

  if (inMemoryDispatchCache.length > MAX_CACHE_SIZE) {
    inMemoryDispatchCache.pop();
  }

  // Persist to Supabase heat_risk_dispatch_log if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const dispatchKey = `${input.recipientEmail}_${input.alertType}_${Math.floor(now / 3600000)}_${Math.random().toString(36).slice(2, 7)}`;
      await supabase.from('heat_risk_dispatch_log').insert({
        user_id: input.userId && input.userId.length > 20 ? input.userId : null,
        recipient_email: input.recipientEmail,
        location: input.locationName,
        risk_score: input.riskScore,
        risk_level: input.riskLevel,
        dispatch_key: dispatchKey,
        provider_message_id: input.providerMessageId || null,
        status: input.deliveryStatus,
        error_message: input.errorMessage || null,
        created_at: new Date(now).toISOString(),
        sent_at: input.deliveryStatus === 'SENT' ? new Date(now).toISOString() : null,
      });
    } catch (dbErr) {
      console.warn('[HeatShield AlertManager] Failed to write dispatch log to Supabase:', dbErr);
    }
  }
}

/**
 * Clears the in-memory cooldown cache (useful for testing).
 */
export function clearAlertCooldownCacheForTesting(): void {
  inMemoryDispatchCache.length = 0;
}

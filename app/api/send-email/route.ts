import { NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/email-service';
import { SmartAlert } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// In-memory rate limiting map: email -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Deduplication cooldown map: dedup_key -> timestamp
const sentAlertsMap = new Map<string, number>();
const DEDUP_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const history = (rateLimitMap.get(email) || []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (history.length >= RATE_LIMIT_MAX) {
    return true;
  }
  history.push(now);
  rateLimitMap.set(email, history);
  return false;
}

function isDuplicateAlert(dedupKey: string): boolean {
  const now = Date.now();
  const lastSent = sentAlertsMap.get(dedupKey);
  if (lastSent && now - lastSent < DEDUP_COOLDOWN_MS) {
    return true;
  }
  sentAlertsMap.set(dedupKey, now);
  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to: bodyTo, alert, locationName } = body as { to?: string; alert?: SmartAlert; locationName?: string };

    let targetEmail: string | undefined = bodyTo?.trim().toLowerCase();

    // PHASE 1 SECURITY: Verify caller authentication if Authorization header or Supabase session is present
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && isSupabaseConfigured && supabase) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user && user.email) {
        // Prefer verified user account email over arbitrary caller string
        targetEmail = user.email.toLowerCase();
      }
    }

    if (!targetEmail || typeof targetEmail !== 'string' || !targetEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email recipient address is required. Please sign in or provide a valid address.' },
        { status: 400 }
      );
    }

    if (!alert || !alert.title || !alert.priority || !alert.trigger_data) {
      return NextResponse.json(
        { success: false, error: 'A valid SmartAlert payload is required.' },
        { status: 400 }
      );
    }

    // SERVER-SIDE RATE LIMITING
    if (isRateLimited(targetEmail)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Maximum 5 alert emails per minute permitted.' },
        { status: 429 }
      );
    }

    // SERVER-SIDE 60-MINUTE DEDUPLICATION
    const dedupKey = alert.dedup_key ? `${targetEmail}_${alert.dedup_key}` : `${targetEmail}_${alert.id}`;
    if (isDuplicateAlert(dedupKey)) {
      return NextResponse.json(
        { success: false, error: 'Duplicate alert email blocked. Cooldown of 60 minutes active for this alert key.' },
        { status: 409 }
      );
    }

    // SERVER-ONLY RESEND DISPATCH
    const result = await sendAlertEmail({
      to: targetEmail,
      alert,
      locationName,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send transactional alert email via Resend' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Email alert dispatched successfully via Resend', id: result.id, recipient: targetEmail },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error while processing email alert dispatch.' },
      { status: 500 }
    );
  }
}

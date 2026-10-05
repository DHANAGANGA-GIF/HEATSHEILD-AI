import { NextResponse } from 'next/server';
import { verifyAdminRequest, isBootstrapAdminEmail } from '@/lib/admin-auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getRecipientProfiles, saveRecipientProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 *
 * Lists all registered users and their notification settings.
 * Strictly protected: Requires verified administrator session.
 * NEVER exposes passwords, tokens, OAuth credentials, or private keys.
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let users: any[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, preferred_language, timezone, hourly_heat_alerts_enabled, minimum_risk_level, created_at, last_notification_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        users = data.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.full_name || u.email?.split('@')[0] || 'User',
          role: u.role || 'user',
          preferred_language: u.preferred_language || 'en',
          timezone: u.timezone || 'Asia/Kolkata',
          hourly_heat_alerts_enabled: Boolean(u.hourly_heat_alerts_enabled),
          minimum_risk_level: u.minimum_risk_level || 'high',
          created_at: u.created_at,
          last_notification_at: u.last_notification_at || null,
        }));
      }
    } catch (err) {
      console.warn('[Admin Users] Supabase query warning:', err);
    }
  }

  // Fall back to local store if DB returned empty
  if (users.length === 0) {
    const localRecipients = getRecipientProfiles();
    users = localRecipients.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.display_name,
      role: isBootstrapAdminEmail(r.email) ? 'admin' : 'user',
      preferred_language: r.preferred_language || 'en',
      timezone: r.timezone || 'Asia/Kolkata',
      hourly_heat_alerts_enabled: Boolean(r.hourly_heat_alerts_enabled),
      minimum_risk_level: r.minimum_risk_level || 'high',
      created_at: r.created_at,
      last_notification_at: null,
    }));
  }

  return NextResponse.json({ users, count: users.length });
}

/**
 * PATCH /api/admin/users
 *
 * Allows administrators to toggle notification status or assign roles.
 * Body: { userId: string, hourly_heat_alerts_enabled?: boolean, role?: string }
 */
export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { userId, hourly_heat_alerts_enabled, role } = body as {
      userId?: string;
      hourly_heat_alerts_enabled?: boolean;
      role?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    // Safeguard: Prevent self-demotion
    if (userId === auth.uid && role && role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot demote your own administrator account.' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (hourly_heat_alerts_enabled !== undefined) {
      updatePayload.hourly_heat_alerts_enabled = Boolean(hourly_heat_alerts_enabled);
    }

    if (role && ['user', 'school', 'worksite', 'ngo', 'admin'].includes(role)) {
      updatePayload.role = role;
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Also update local recipient pool if matched
    const localRecipients = getRecipientProfiles();
    const matched = localRecipients.find((r) => r.id === userId || r.user_id === userId);
    if (matched && hourly_heat_alerts_enabled !== undefined) {
      saveRecipientProfile({
        ...matched,
        hourly_heat_alerts_enabled: Boolean(hourly_heat_alerts_enabled),
      });
    }

    return NextResponse.json({ success: true, updated: updatePayload });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

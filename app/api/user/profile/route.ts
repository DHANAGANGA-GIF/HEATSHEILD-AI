import { NextResponse } from 'next/server';
import { resolveAuthSession } from '@/lib/firebase/admin';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Language, UserProfile } from '@/lib/types';
import { getGmailRefreshToken, getStoredOAuthAccountEmail } from '@/lib/email-providers/token-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile
 *
 * Retrieves the authenticated user's persistent profile, language,
 * timezone, and notification preferences.
 */
export async function GET(request: Request) {
  try {
    const session = await resolveAuthSession(request);
    if (!session || !session.uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const uid = session.uid;
    const email = session.email || '';
    const name = session.name || '';

    // Check Gmail connection state
    const gmailToken = await getGmailRefreshToken();
    const isGmailConnected = Boolean(gmailToken && gmailToken.length > 10);

    let profileData: Partial<UserProfile> = {
      id: uid,
      firebase_uid: uid,
      email,
      name,
      language: 'en',
      timezone: 'Asia/Kolkata',
      email_alerts_enabled: false,
      alert_threshold: 'high',
      forecast_alerts_enabled: true,
      daily_summary_enabled: false,
      quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
      gmail_connected: isGmailConnected,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle();

        if (!error && data) {
          profileData = {
            ...profileData,
            name: data.full_name || profileData.name,
            language: (data.preferred_language as Language) || profileData.language,
            preferred_language: (data.preferred_language as Language) || profileData.language,
            email_alerts_enabled: data.hourly_heat_alerts_enabled ?? profileData.email_alerts_enabled,
            alert_threshold: data.minimum_risk_level || profileData.alert_threshold,
            minimum_risk_level: data.minimum_risk_level || 'high',
            forecast_alerts_enabled: data.forecast_alerts_enabled ?? profileData.forecast_alerts_enabled,
            daily_summary_enabled: data.daily_summary_enabled ?? profileData.daily_summary_enabled,
            timezone: data.timezone || profileData.timezone,
            quiet_hours: data.quiet_hours || profileData.quiet_hours,
            role: data.role || 'user',
            age_group: data.age_group || 'adult',
            exposure: data.exposure || 'occasional',
            activity_level: data.activity_level || 'moderate',
            cooling_access: data.cooling_access || 'good',
          };
        }
      } catch (dbErr) {
        console.warn('[HeatShield Profile] Database read error:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      profile: profileData,
    });
  } catch (err: any) {
    console.error('[HeatShield Profile GET] Exception:', err?.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile
 *
 * Updates persistent user preferences (language, timezone, quiet hours, notifications, etc.)
 * Strictly upserts the profile row to ensure single-source-of-truth persistence.
 */
export async function PUT(request: Request) {
  try {
    const session = await resolveAuthSession(request);
    if (!session || !session.uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const uid = session.uid;
    const body = await request.json();

    const allowedLanguages: Language[] = ['en', 'te', 'ta', 'hi'];
    const rawLang = body.preferred_language || body.language;
    const preferredLanguage: Language =
      rawLang && allowedLanguages.includes(rawLang) ? rawLang : 'en';

    const fullName = typeof body.name === 'string' ? body.name.trim() : undefined;
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : undefined;
    const emailAlertsEnabled = typeof body.email_alerts_enabled === 'boolean'
      ? body.email_alerts_enabled
      : typeof body.hourly_heat_alerts_enabled === 'boolean'
      ? body.hourly_heat_alerts_enabled
      : undefined;
    const alertThreshold = body.minimum_risk_level || body.alert_threshold || 'high';
    const quietHours = body.quiet_hours && typeof body.quiet_hours === 'object' ? {
      enabled: Boolean(body.quiet_hours.enabled),
      start: typeof body.quiet_hours.start === 'string' ? body.quiet_hours.start : '22:00',
      end: typeof body.quiet_hours.end === 'string' ? body.quiet_hours.end : '07:00',
    } : undefined;

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: Record<string, any> = {
          id: uid,
          firebase_uid: uid,
          updated_at: new Date().toISOString(),
          preferred_language: preferredLanguage,
        };
        if (session.email) updatePayload.email = session.email;
        if (fullName !== undefined) updatePayload.full_name = fullName;
        if (emailAlertsEnabled !== undefined) updatePayload.hourly_heat_alerts_enabled = emailAlertsEnabled;
        if (timezone !== undefined) updatePayload.timezone = timezone;
        if (quietHours !== undefined) updatePayload.quiet_hours = quietHours;
        if (alertThreshold !== undefined) updatePayload.minimum_risk_level = alertThreshold;
        if (body.forecast_alerts_enabled !== undefined) updatePayload.forecast_alerts_enabled = Boolean(body.forecast_alerts_enabled);
        if (body.daily_summary_enabled !== undefined) updatePayload.daily_summary_enabled = Boolean(body.daily_summary_enabled);

        await supabase
          .from('profiles')
          .upsert(updatePayload, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('[HeatShield Profile Update] Supabase update warning:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      updated: {
        id: uid,
        language: preferredLanguage,
        name: fullName,
        timezone,
        email_alerts_enabled: emailAlertsEnabled,
        alert_threshold: alertThreshold,
        quiet_hours: quietHours,
      },
    });
  } catch (err: any) {
    console.error('[HeatShield Profile PUT] Exception:', err?.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

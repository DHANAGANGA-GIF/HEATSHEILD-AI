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
            email_alerts_enabled: data.hourly_heat_alerts_enabled ?? profileData.email_alerts_enabled,
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
 * Updates persistent user preferences (language, timezone, notifications, etc.)
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
    const preferredLanguage: Language =
      body.language && allowedLanguages.includes(body.language) ? body.language : 'en';

    const fullName = typeof body.name === 'string' ? body.name.trim() : undefined;
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : undefined;
    const emailAlertsEnabled = typeof body.email_alerts_enabled === 'boolean' ? body.email_alerts_enabled : undefined;
    const alertThreshold = body.alert_threshold || 'high';

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
          preferred_language: preferredLanguage,
        };
        if (fullName !== undefined) updatePayload.full_name = fullName;
        if (emailAlertsEnabled !== undefined) updatePayload.hourly_heat_alerts_enabled = emailAlertsEnabled;

        await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', uid);
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
      },
    });
  } catch (err: any) {
    console.error('[HeatShield Profile PUT] Exception:', err?.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

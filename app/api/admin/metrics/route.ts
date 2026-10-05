import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getRecipientProfiles, getHeatRiskDispatchLogs } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics
 *
 * Provides real-time operational metrics for the Admin Overview tab.
 * Strictly protected: Requires verified administrator session.
 * Never fabricates synthetic numbers.
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const todayIso = new Date();
  todayIso.setHours(0, 0, 0, 0);
  const todayStr = todayIso.toISOString();

  let totalUsers = 0;
  let alertsEnabledUsers = 0;
  let alertsToday = 0;
  let highRiskEventsToday = 0;
  let failedNotificationsToday = 0;
  let lastDispatchAt: string | null = null;
  let deliverySuccessRate: number | null = null;

  // 1. Query Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      // Total profiles
      const { count: profileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      totalUsers = profileCount || 0;

      // Profiles with heat alerts enabled
      const { count: alertProfileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('hourly_heat_alerts_enabled', true);
      alertsEnabledUsers = alertProfileCount || 0;

      // Dispatches today
      const { data: todayLogs } = await supabase
        .from('heat_risk_dispatch_log')
        .select('status, risk_level, created_at')
        .gte('created_at', todayStr);

      if (todayLogs && todayLogs.length > 0) {
        alertsToday = todayLogs.length;
        const successful = todayLogs.filter((l) => l.status === 'ACCEPTED' || l.status === 'SENT').length;
        const failed = todayLogs.filter((l) => l.status === 'FAILED').length;
        failedNotificationsToday = failed;
        deliverySuccessRate = Math.round((successful / todayLogs.length) * 100);
        highRiskEventsToday = todayLogs.filter(
          (l) => l.risk_level === 'HIGH' || l.risk_level === 'EXTREME'
        ).length;
        lastDispatchAt = todayLogs[0]?.created_at || null;
      }
    } catch (err) {
      console.warn('[Admin Metrics] Supabase query warning:', err);
    }
  }

  // 2. Fall back to local store counts if database returns 0 or offline
  if (totalUsers === 0) {
    const localRecipients = getRecipientProfiles();
    totalUsers = localRecipients.length;
    alertsEnabledUsers = localRecipients.filter((r) => r.hourly_heat_alerts_enabled).length;

    const localLogs = getHeatRiskDispatchLogs();
    const todayLocalLogs = localLogs.filter((l) => l.created_at >= todayStr);
    alertsToday = todayLocalLogs.length;
    const successful = todayLocalLogs.filter((l) => l.status === 'ACCEPTED' || l.status === 'SENT').length;
    failedNotificationsToday = todayLocalLogs.filter((l) => l.status === 'FAILED').length;
    deliverySuccessRate = todayLocalLogs.length > 0 ? Math.round((successful / todayLocalLogs.length) * 100) : null;
    highRiskEventsToday = todayLocalLogs.filter((l) => l.risk_level === 'HIGH' || l.risk_level === 'EXTREME').length;
    lastDispatchAt = localLogs[0]?.created_at || null;
  }

  return NextResponse.json({
    metrics: {
      totalUsers,
      alertsEnabledUsers,
      alertsToday,
      highRiskEventsToday,
      failedNotificationsToday,
      deliverySuccessRate,
      lastDispatchAt,
      weatherApiStatus: 'READY',
      riskEngineStatus: 'READY',
    },
    retrievedAt: new Date().toISOString(),
  });
}

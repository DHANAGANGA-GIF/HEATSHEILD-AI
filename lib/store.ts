import { AlertItem, AlertPriority, AlertSettings, CommunityCategory, CommunityReport, LocationData, ReportSeverity, ReportStatus, SmartAlert, UserProfile, VerifiedCoolingLocation } from './types';
import { isSupabaseConfigured, supabase } from './supabase';
import { checkDuplicateSubmission, recordSubmissionTime, validateReportInput } from './community-moderation';
import { calculateDistanceKm } from './cluster-detector';

const PROFILE_KEY = 'heatshield_user_profile';
const SAVED_LOCATIONS_KEY = 'heatshield_saved_locations';
const COMMUNITY_REPORTS_KEY = 'heatshield_community_reports';
const ALERTS_KEY = 'heatshield_alerts';

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr_demo_101',
  email: 'demo.user@heatshield.org',
  name: 'Demo User',
  age_group: 'adult',
  exposure: 'occasional',
  activity_level: 'moderate',
  exposure_duration: 'moderate',
  cooling_access: 'good',
  language: 'en',
  role: 'user',
  location: {
    name: 'Chennai',
    locality: 'Tamil Nadu, India',
    latitude: 13.0827,
    longitude: 80.2707,
    country: 'India',
  },
  created_at: new Date().toISOString(),
};

export const INITIAL_DEMO_REPORTS: CommunityReport[] = [
  {
    id: 'rep_001',
    user_id: 'usr_demo_101',
    category: 'water_access',
    description: '[DEMO DATA] Public water fountain malfunctioning at Central Metro Station plaza.',
    location: { name: 'Central Metro Plaza', locality: 'Chennai', latitude: 13.0815, longitude: 80.2725 },
    timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    status: 'VERIFIED',
    votes_count: 14,
  },
  {
    id: 'rep_002',
    user_id: 'usr_demo_102',
    category: 'water_access',
    description: '[DEMO DATA] Refill station empty near Anna Salai Bus Stop.',
    location: { name: 'Anna Salai Bus Stand', locality: 'Chennai', latitude: 13.0830, longitude: 80.2710 },
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    status: 'VERIFIED',
    votes_count: 9,
  },
  {
    id: 'rep_003',
    user_id: 'usr_demo_103',
    category: 'shade_cooling',
    description: '[DEMO DATA] Bus stop shelter canopy removed for renovation, leaving commuters exposed to direct sunlight.',
    location: { name: 'Park Town Junction', locality: 'Chennai', latitude: 13.0789, longitude: 80.2750 },
    timestamp: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    status: 'UNDER_REVIEW',
    votes_count: 7,
  },
  {
    id: 'rep_004',
    user_id: 'usr_demo_104',
    category: 'outdoor_heat',
    description: '[DEMO DATA] Asphalt heat accumulation outside Government High School playground.',
    location: { name: 'Egmore High School', locality: 'Chennai', latitude: 13.0732, longitude: 80.2610 },
    timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    status: 'SUBMITTED',
    votes_count: 3,
  },
];

export const INITIAL_DEMO_ALERTS: AlertItem[] = [
  {
    id: 'alt_01',
    user_id: 'usr_demo_101',
    title: 'Heat Risk Level Escalation',
    message: 'Heat risk level in Chennai increased to HIGH (Score: 74/100). Review hydration and cooling guidance.',
    severity: 'warning',
    timestamp: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    read: false,
    category: 'risk_change',
  },
  {
    id: 'alt_02',
    user_id: 'usr_demo_101',
    title: 'Forecast Peak Warning',
    message: 'High-risk period expected between 12:30 PM and 4:00 PM today. Limit strenuous outdoor work.',
    severity: 'warning',
    timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    read: true,
    category: 'forecast_warning',
  },
  {
    id: 'alt_03',
    user_id: 'usr_demo_101',
    title: 'Potential Community Issue Detected',
    message: 'Multiple water access reports cluster near Central Metro Station.',
    severity: 'info',
    timestamp: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    read: true,
    category: 'community_alert',
  },
];

export function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_USER_PROFILE;
  const stored = localStorage.getItem(PROFILE_KEY);
  if (!stored) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(DEFAULT_USER_PROFILE));
    return DEFAULT_USER_PROFILE;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: Partial<UserProfile>): UserProfile {
  const current = getUserProfile();
  const updated = { ...current, authenticated: true, ...profile };
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function clearUserProfile(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PROFILE_KEY);
  }
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on logout
    }
  }
  clearUserProfile();
}


export function getSavedLocations(): LocationData[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SAVED_LOCATIONS_KEY);
  if (!stored) {
    const defaultSaved = [
      { name: 'Chennai', locality: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707 },
      { name: 'New Delhi', locality: 'Delhi', latitude: 28.6139, longitude: 77.2090 },
    ];
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(defaultSaved));
    return defaultSaved;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function toggleSaveLocation(loc: LocationData): LocationData[] {
  const list = getSavedLocations();
  const exists = list.some(l => l.name.toLowerCase() === loc.name.toLowerCase());
  let updated: LocationData[];
  if (exists) {
    updated = list.filter(l => l.name.toLowerCase() !== loc.name.toLowerCase());
  } else {
    updated = [loc, ...list];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export const VERIFIED_COOLING_LOCATIONS: VerifiedCoolingLocation[] = [
  {
    id: 'cool_001',
    name: 'Chennai Central Climate Shelter & Water Station',
    category: 'cooling_center',
    address: 'Grand Southern Trunk Rd, Central Metro Plaza, Chennai',
    location: { name: 'Central Metro Plaza', locality: 'Chennai', latitude: 13.0820, longitude: 80.2730 },
    is_verified: true,
    operating_hours: '08:00 AM - 08:00 PM',
    contact_phone: '+91 44 2530 0000',
    data_type: 'VERIFIED_LOCATION',
  },
  {
    id: 'cool_002',
    name: 'Anna Salai Public Shade Canopy & Hydration Point',
    category: 'water_refill',
    address: 'Near Thousand Lights, Anna Salai, Chennai',
    location: { name: 'Anna Salai Bus Stand', locality: 'Chennai', latitude: 13.0835, longitude: 80.2715 },
    is_verified: true,
    operating_hours: '24/7 Public Access',
    contact_phone: 'Public Hydration Station',
    data_type: 'VERIFIED_LOCATION',
  },
  {
    id: 'cool_003',
    name: 'Egmore Eco-Park Shaded Cooling Zone',
    category: 'shaded_park',
    address: 'EVR Periyar Salai, Egmore, Chennai',
    location: { name: 'Egmore Eco-Park', locality: 'Chennai', latitude: 13.0740, longitude: 80.2620 },
    is_verified: true,
    operating_hours: '06:00 AM - 09:00 PM',
    contact_phone: '+91 44 2819 0000',
    data_type: 'VERIFIED_LOCATION',
  },
];

export function getCommunityReports(): CommunityReport[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_REPORTS;
  const stored = localStorage.getItem(COMMUNITY_REPORTS_KEY);
  if (!stored) {
    localStorage.setItem(COMMUNITY_REPORTS_KEY, JSON.stringify(INITIAL_DEMO_REPORTS));
    return INITIAL_DEMO_REPORTS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_DEMO_REPORTS;
  }
}

export function addCommunityReport(report: Omit<CommunityReport, 'id' | 'timestamp' | 'votes_count' | 'status'> & { severity?: ReportSeverity }): CommunityReport {
  const list = getCommunityReports();
  const newReport: CommunityReport = {
    ...report,
    id: `rep_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'SUBMITTED',
    severity: report.severity || 'info',
    votes_count: 1,
    data_type: 'COMMUNITY_REPORT',
  };
  const updated = [newReport, ...list];
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMMUNITY_REPORTS_KEY, JSON.stringify(updated));
  }
  return newReport;
}

export function canUserModifyReport(userId: string | undefined, report: CommunityReport): boolean {
  if (!userId || !report) return false;
  return report.user_id === userId;
}

export async function deleteCommunityReport(
  userId: string,
  reportId: string,
  targetReport?: CommunityReport
): Promise<{ success: boolean; error?: string }> {
  const reports = getCommunityReports();
  const target = targetReport || reports.find((r) => r.id === reportId);
  if (!target) {
    return { success: false, error: 'Report not found.' };
  }

  if (!canUserModifyReport(userId, target)) {
    return { success: false, error: 'Unauthorized: You can only delete or modify your own reports.' };
  }

  const updated = reports.filter((r) => r.id !== reportId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMMUNITY_REPORTS_KEY, JSON.stringify(updated));
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('incidents').delete().eq('id', reportId).eq('user_id', userId);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }

  return { success: true };
}

export async function fetchCommunityReportsFromSupabase(): Promise<CommunityReport[]> {
  if (!isSupabaseConfigured || !supabase) {
    return getCommunityReports();
  }
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return getCommunityReports();
    }

    return data.map((item: any) => ({
      id: item.id,
      user_id: item.user_id || 'anonymous',
      category: item.category as CommunityCategory,
      description: item.description,
      location: {
        name: item.location_name || 'Report Location',
        locality: item.locality || '',
        latitude: item.latitude,
        longitude: item.longitude,
      },
      timestamp: item.created_at || new Date().toISOString(),
      status: (item.status as ReportStatus) || 'SUBMITTED',
      severity: item.severity || 'info',
      votes_count: item.votes_count || 1,
      data_type: 'COMMUNITY_REPORT',
    }));
  } catch (e) {
    return getCommunityReports();
  }
}

export async function createCommunityReportInSupabase(
  reportData: Omit<CommunityReport, 'id' | 'timestamp' | 'votes_count' | 'status'> & { severity?: ReportSeverity }
): Promise<{ success: boolean; report?: CommunityReport; error?: string }> {
  // Input & Coordinate validation
  const val = validateReportInput(
    reportData.category,
    reportData.description,
    reportData.location.latitude,
    reportData.location.longitude
  );
  if (!val.valid) {
    return { success: false, error: val.error };
  }

  const existing = getCommunityReports();
  const dupCheck = checkDuplicateSubmission(reportData.user_id, val.sanitizedDescription!, existing);
  if (dupCheck.isDuplicate) {
    return { success: false, error: dupCheck.reason };
  }

  const localReport = addCommunityReport({
    user_id: reportData.user_id,
    category: reportData.category as CommunityCategory,
    description: val.sanitizedDescription!,
    location: reportData.location,
    severity: reportData.severity || 'info',
  });

  recordSubmissionTime(reportData.user_id);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, report: localReport };
  }

  try {
    const { data, error } = await supabase.from('incidents').insert([
      {
        user_id: reportData.user_id.startsWith('usr_demo') ? null : reportData.user_id,
        category: reportData.category,
        description: val.sanitizedDescription!,
        location_name: reportData.location.name,
        locality: reportData.location.locality || '',
        latitude: reportData.location.latitude,
        longitude: reportData.location.longitude,
        status: 'SUBMITTED',
        votes_count: 1,
      },
    ]).select();

    if (error) {
      return { success: true, report: localReport };
    }

    if (data && data.length > 0) {
      const item = data[0];
      const insertedReport: CommunityReport = {
        id: item.id,
        user_id: item.user_id || reportData.user_id,
        category: item.category as CommunityCategory,
        description: item.description,
        location: {
          name: item.location_name,
          locality: item.locality,
          latitude: item.latitude,
          longitude: item.longitude,
        },
        timestamp: item.created_at || new Date().toISOString(),
        status: (item.status as ReportStatus) || 'SUBMITTED',
        severity: reportData.severity || 'info',
        votes_count: item.votes_count || 1,
        data_type: 'COMMUNITY_REPORT',
      };
      return { success: true, report: insertedReport };
    }
  } catch (e) {
    // Fallback to local report
  }

  return { success: true, report: localReport };
}

export interface CommunityFilterOptions {
  category?: string;
  status?: string;
  severity?: string;
  timeframe?: 'all' | '24h' | '7d';
  userLocation?: LocationData;
  nearbyRadiusKm?: number;
}

export function filterCommunityReports(
  reports: CommunityReport[],
  options: CommunityFilterOptions
): CommunityReport[] {
  return reports.filter((rep) => {
    if (options.category && options.category !== 'all') {
      if (rep.category !== options.category) return false;
    }

    if (options.status && options.status !== 'all') {
      if (rep.status !== options.status) return false;
    }

    if (options.severity && options.severity !== 'all') {
      if (rep.severity !== options.severity) return false;
    }

    if (options.timeframe && options.timeframe !== 'all') {
      const reportTime = new Date(rep.timestamp).getTime();
      const now = Date.now();
      if (options.timeframe === '24h' && now - reportTime > 24 * 3600 * 1000) {
        return false;
      }
      if (options.timeframe === '7d' && now - reportTime > 7 * 24 * 3600 * 1000) {
        return false;
      }
    }

    if (options.userLocation && options.nearbyRadiusKm && options.nearbyRadiusKm > 0) {
      const dist = calculateDistanceKm(
        options.userLocation.latitude,
        options.userLocation.longitude,
        rep.location.latitude,
        rep.location.longitude
      );
      if (dist > options.nearbyRadiusKm) return false;
    }

    return true;
  });
}

export function getAlerts(): AlertItem[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_ALERTS;
  const stored = localStorage.getItem(ALERTS_KEY);
  if (!stored) {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(INITIAL_DEMO_ALERTS));
    return INITIAL_DEMO_ALERTS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return INITIAL_DEMO_ALERTS;
  }
}

export function markAlertAsRead(id: string): AlertItem[] {
  const alerts = getAlerts().map(a => a.id === id ? { ...a, read: true } : a);
  if (typeof window !== 'undefined') {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }
  return alerts;
}

// ─── Phase 5: Smart Alert Storage ────────────────────────────────────────────

const SMART_ALERTS_KEY = 'heatshield_smart_alerts';
const ALERT_SETTINGS_KEY = 'heatshield_alert_settings';
const ALERT_COOLDOWNS_KEY = 'heatshield_alert_cooldowns';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  alerts_enabled: true,
  min_severity: 'CAUTION',
  forecast_alerts_enabled: true,
  browser_notifications_enabled: false,
};

export function getAlertSettings(): AlertSettings {
  if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
  const stored = localStorage.getItem(ALERT_SETTINGS_KEY);
  if (!stored) return DEFAULT_ALERT_SETTINGS;
  try {
    return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

export function saveAlertSettings(settings: Partial<AlertSettings>): AlertSettings {
  const current = getAlertSettings();
  const updated: AlertSettings = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function getSmartAlerts(): SmartAlert[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SMART_ALERTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveSmartAlerts(alerts: SmartAlert[]): void {
  if (typeof window !== 'undefined') {
    // Cap history at 50 alerts to prevent unbounded growth
    const capped = alerts.slice(0, 50);
    localStorage.setItem(SMART_ALERTS_KEY, JSON.stringify(capped));
  }
}

export function addSmartAlerts(newAlerts: SmartAlert[]): SmartAlert[] {
  const existing = getSmartAlerts();
  // Prepend new, then deduplicate by dedup_key keeping newest
  const merged = [...newAlerts, ...existing];
  const seen = new Set<string>();
  const deduped = merged.filter(a => {
    if (seen.has(a.dedup_key)) return false;
    seen.add(a.dedup_key);
    return true;
  });
  saveSmartAlerts(deduped);
  return deduped;
}

export function dismissSmartAlert(id: string): SmartAlert[] {
  const alerts = getSmartAlerts().map(a => a.id === id ? { ...a, dismissed: true } : a);
  saveSmartAlerts(alerts);
  return alerts;
}

export function markSmartAlertRead(id: string): SmartAlert[] {
  const alerts = getSmartAlerts().map(a => a.id === id ? { ...a, read: true } : a);
  saveSmartAlerts(alerts);
  return alerts;
}

export function clearDismissedAlerts(): SmartAlert[] {
  const alerts = getSmartAlerts().filter(a => !a.dismissed);
  saveSmartAlerts(alerts);
  return alerts;
}

// ─── Cooldown Management ──────────────────────────────────────────────────────

type CooldownMap = Record<string, number>; // dedup_key → timestamp of last fire

export function getAlertCooldowns(): CooldownMap {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(ALERT_COOLDOWNS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Returns dedup keys that are still within their cooldown window.
 */
export function getActiveCooldownKeys(cooldownMs: number): string[] {
  const cooldowns = getAlertCooldowns();
  const now = Date.now();
  return Object.entries(cooldowns)
    .filter(([, ts]) => now - ts < cooldownMs)
    .map(([key]) => key);
}

export function recordAlertCooldowns(dedupKeys: string[]): void {
  if (typeof window === 'undefined') return;
  const cooldowns = getAlertCooldowns();
  const now = Date.now();
  for (const key of dedupKeys) {
    cooldowns[key] = now;
  }
  // Purge expired entries (older than 24h) to keep storage clean
  const purgeThreshold = now - 24 * 60 * 60 * 1000;
  for (const key of Object.keys(cooldowns)) {
    if (cooldowns[key] < purgeThreshold) delete cooldowns[key];
  }
  localStorage.setItem(ALERT_COOLDOWNS_KEY, JSON.stringify(cooldowns));
}


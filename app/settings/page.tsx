'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/firebase/auth-context';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { Language, UserProfile } from '@/lib/types';
import { t, getLanguageName, getLanguageFlag } from '@/lib/i18n';
import {
  Settings,
  Save,
  CheckCircle,
  Globe,
  Bell,
  Mail,
  Shield,
  Clock,
  Send,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  MapPin,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { firebaseUser, appProfile, getIdToken } = useAuth();

  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [language, setLanguage] = useState<Language>(() => getUserProfile().language || 'en');
  const [timezone, setTimezone] = useState<string>(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  });

  // Notification settings
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState<boolean>(() => {
    return profile.hourly_heat_alerts_enabled ?? profile.email_alerts_enabled ?? false;
  });
  const [alertThreshold, setAlertThreshold] = useState<'moderate' | 'high' | 'extreme'>('high');
  const [forecastAlertsEnabled, setForecastAlertsEnabled] = useState<boolean>(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState<boolean>(false);

  // Gmail connection state
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    email: string | null;
    loading: boolean;
  }>({
    connected: false,
    email: null,
    loading: true,
  });

  // Test Email state
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Privacy / Location permission status
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Fetch initial server status
  useEffect(() => {
    // 1. Fetch Gmail status
    fetch('/api/email/google/status')
      .then((res) => res.json())
      .then((data) => {
        setGmailStatus({
          connected: Boolean(data?.connected),
          email: data?.email || null,
          loading: false,
        });
      })
      .catch(() => {
        setGmailStatus({ connected: false, email: null, loading: false });
      });

    // 2. Fetch server user profile if logged in
    fetch('/api/user/profile', { credentials: 'include' })
      .then((res) => res.json())
      .then((resData) => {
        if (resData?.success && resData.profile) {
          const p = resData.profile;
          if (p.language) setLanguage(p.language);
          if (p.timezone) setTimezone(p.timezone);
          if (p.email_alerts_enabled !== undefined) setEmailAlertsEnabled(p.email_alerts_enabled);
          if (p.alert_threshold) setAlertThreshold(p.alert_threshold);
          if (p.forecast_alerts_enabled !== undefined) setForecastAlertsEnabled(p.forecast_alerts_enabled);
          if (p.daily_summary_enabled !== undefined) setDailySummaryEnabled(p.daily_summary_enabled);
        }
      })
      .catch(() => {});

    // 3. Inspect browser geolocation permission
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          setLocationPermission(permissionStatus.state);
          permissionStatus.onchange = () => {
            setLocationPermission(permissionStatus.state);
          };
        })
        .catch(() => {
          setLocationPermission('unknown');
        });
    }
  }, []);

  const handleLanguageSelect = (newLang: Language) => {
    setLanguage(newLang);
    const updated = { ...profile, language: newLang };
    setProfile(updated);
    saveUserProfile(updated);

    // Sync to server asynchronously
    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLang }),
      credentials: 'include',
    }).catch(() => {});
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSavedSuccess(false);

    const updatedProfile: UserProfile = {
      ...profile,
      language,
      hourly_heat_alerts_enabled: emailAlertsEnabled,
      email_alerts_enabled: emailAlertsEnabled,
      timezone,
      alert_threshold: alertThreshold,
      forecast_alerts_enabled: forecastAlertsEnabled,
      daily_summary_enabled: dailySummaryEnabled,
    };

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          timezone,
          email_alerts_enabled: emailAlertsEnabled,
          alert_threshold: alertThreshold,
          forecast_alerts_enabled: forecastAlertsEnabled,
          daily_summary_enabled: dailySummaryEnabled,
        }),
        credentials: 'include',
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.warn('[HeatShield Settings] Server save warning:', err);
      setSavedSuccess(true); // local is saved
      setTimeout(() => setSavedSuccess(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailFeedback(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          isTest: true,
          locationName: profile.location?.name || 'Chennai, India',
          clientLocation: {
            latitude: profile.location?.latitude || 13.0827,
            longitude: profile.location?.longitude || 80.2707,
            location_source: 'SAVED_LOCATION',
          },
          userProfile: {
            ...profile,
            language,
            timezone,
          },
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailFeedback({
          type: 'success',
          message: `Test email dispatched to ${data.recipient || 'your verified email'} in ${getLanguageName(language)}!`,
        });
      } else {
        setTestEmailFeedback({
          type: 'error',
          message: data.error || 'Failed to dispatch test email. Check your Gmail connection.',
        });
      }
    } catch (err: any) {
      setTestEmailFeedback({
        type: 'error',
        message: err?.message || 'Network error sending test email.',
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? Background email alerts will be disabled until you reconnect.')) {
      return;
    }
    try {
      await fetch('/api/email/google/status', { method: 'DELETE' });
      setGmailStatus({ connected: false, email: null, loading: false });
    } catch {
      alert('Failed to disconnect Gmail.');
    }
  };

  const userEmail = firebaseUser?.email || appProfile?.email || profile.email || 'Not signed in';
  const userName = firebaseUser?.displayName || appProfile?.name || profile.name || 'HeatShield User';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white font-mono uppercase tracking-wider">
                  {t('settings', language)}
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Persistent Authentication • Multilingual Engine • Real-Time Alert Settings
                </p>
              </div>
            </div>
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
                <CheckCircle className="w-3.5 h-3.5" /> {t('settings_saved', language)}
              </span>
            )}
          </div>

          {/* Section 1: PROFILE */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Shield className="w-4 h-4 text-emerald-400" />
              {t('profile', language)}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-slate-400 text-[11px] block uppercase font-mono">Full Name</span>
                <span className="font-semibold text-slate-100 mt-1 block">{userName}</span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-slate-400 text-[11px] block uppercase font-mono">Verified Email</span>
                <span className="font-semibold text-slate-100 mt-1 block">{userEmail}</span>
              </div>

              <div className="sm:col-span-2 p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-100 block">{t('timezone', language)}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Used for localized weather timestamps, forecast alerts, and notifications.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
                    aria-label="Timezone"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: LANGUAGE SELECTION */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Globe className="w-4 h-4 text-emerald-400" />
              {t('language', language)}
            </h2>

            <p className="text-xs text-slate-400">
              Select your preferred language. All UI elements, alerts, precautions, and dispatched emails will be generated in your selected language.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {[
                { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
                { code: 'te' as Language, name: 'తెలుగు (Telugu)', flag: '🇮🇳' },
                { code: 'ta' as Language, name: 'தமிழ் (Tamil)', flag: '🇮🇳' },
                { code: 'hi' as Language, name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleLanguageSelect(item.code)}
                  className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between gap-2 ${
                    language === item.code
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.flag}</span>
                  <div>
                    <span className="text-xs font-bold block">{item.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {language === item.code ? '✓ Active' : 'Select'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: NOTIFICATIONS & ALERTS */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Bell className="w-4 h-4 text-emerald-400" />
              {t('notifications', language)}
            </h2>

            <div className="space-y-3 text-xs">
              {/* Email Alerts Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-100 block">{t('email_alerts', language)}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Receive point-in-time email advisories when heat risk crosses your threshold.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlertsEnabled}
                  onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                  aria-label="Email alerts"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Alert Threshold Selector */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-100 block">{t('alert_threshold', language)}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Minimum risk level required to trigger an alert email.
                  </span>
                </div>
                <select
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value as any)}
                  className="bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  aria-label="Alert threshold"
                >
                  <option value="moderate">Moderate (Score 40+)</option>
                  <option value="high">High (Score 60+)</option>
                  <option value="extreme">Very High / Extreme (Score 80+)</option>
                </select>
              </div>

              {/* Forecast Peak Alerts */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-100 block">{t('forecast_alerts', language)}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Notify when forecast data predicts a severe heat escalation within the next 2 hours.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={forecastAlertsEnabled}
                  onChange={(e) => setForecastAlertsEnabled(e.target.checked)}
                  aria-label="Forecast peak alerts"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Daily Summary */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-100 block">{t('daily_summary', language)}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Receive a morning daily heat risk preview at 08:00 AM local time.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={dailySummaryEnabled}
                  onChange={(e) => setDailySummaryEnabled(e.target.checked)}
                  aria-label="Daily summary"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 4: GMAIL OAUTH INTEGRATION */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Mail className="w-4 h-4 text-emerald-400" />
              GMAIL INTEGRATION
            </h2>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">Gmail Dispatch Gateway</span>
                  {gmailStatus.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : gmailStatus.connected ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {t('gmail_connected', language)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {gmailStatus.connected
                    ? `Connected account: ${gmailStatus.email || 'Configured via OAuth'}. Refresh token is securely persisted on the server.`
                    : 'Authorize HeatShield AI once to dispatch autonomous heat alerts without reconnecting.'}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {gmailStatus.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    className="text-xs px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800 transition font-semibold"
                  >
                    {t('disconnect_gmail', language)}
                  </button>
                ) : (
                  <a
                    href="/api/email/google/connect"
                    className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <span>{t('connect_gmail', language)}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: TEST EMAIL BUTTON (Requirement 29) */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Send className="w-4 h-4 text-emerald-400" />
              EMAIL DISPATCH TEST
            </h2>

            <p className="text-xs text-slate-400">
              Manually trigger an advisory email using real current weather data from Open-Meteo in your selected language ({getLanguageName(language)}).
              Logging in or visiting the dashboard will <strong>never</strong> trigger automated emails.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={testEmailLoading}
                className="text-xs font-semibold px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {testEmailLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Send className="w-4 h-4 text-emerald-400" />
                )}
                <span>{t('test_email', language)}</span>
              </button>
            </div>

            {testEmailFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  testEmailFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border-red-800 text-red-300'
                }`}
              >
                {testEmailFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{testEmailFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Section 6: PRIVACY & COMPLIANCE */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3">
            <h2 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800">
              <Shield className="w-4 h-4 text-emerald-400" />
              {t('privacy', language)}
            </h2>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Browser Location Permission
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                    locationPermission === 'granted'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : locationPermission === 'denied'
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {locationPermission.toUpperCase()}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                • <strong>Weather Data Source:</strong> Real-time atmospheric observations and forecasts provided by <strong>Open-Meteo</strong>. No mock weather is ever generated.
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                • <strong>Decision Support:</strong> HeatShield AI is a preventive environmental awareness system and does not constitute medical diagnosis or healthcare advice.
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                • <strong>Privacy Integrity:</strong> OAuth refresh tokens are encrypted using AES-256-GCM server-side. Passwords and credentials are never stored in localStorage.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="text-xs font-bold px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{t('save_settings', language)}</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

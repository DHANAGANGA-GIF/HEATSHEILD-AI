'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { scoreForecast, ForecastContext } from '@/lib/forecast-engine';
import { generateAlerts, ALERT_COOLDOWN_MS } from '@/lib/alert-engine';
import {
  getAlertSettings, saveAlertSettings,
  getSmartAlerts, addSmartAlerts, dismissSmartAlert,
  markSmartAlertRead, clearDismissedAlerts,
  getActiveCooldownKeys, recordAlertCooldowns,
  getUserProfile,
} from '@/lib/store';
import { AlertSettings, AlertPriority, SmartAlert, WeatherData } from '@/lib/types';
import {
  Bell, BellOff, ShieldAlert, AlertTriangle, Info, CheckCircle2,
  X, RotateCcw, Settings2, RefreshCw, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  INFO: 0, CAUTION: 1, 'HIGH PRIORITY': 2, CRITICAL: 3,
};

function priorityStyles(priority: AlertPriority) {
  const map: Record<AlertPriority, { badge: string; icon: string; border: string; bg: string }> = {
    INFO: { badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'bg-blue-100 text-blue-700', border: 'border-blue-200', bg: 'bg-white' },
    CAUTION: { badge: 'bg-amber-100 text-amber-900 border-amber-200', icon: 'bg-amber-100 text-amber-700', border: 'border-amber-200', bg: 'bg-white' },
    'HIGH PRIORITY': { badge: 'bg-orange-100 text-orange-900 border-orange-300', icon: 'bg-orange-100 text-orange-700', border: 'border-orange-300', bg: 'bg-white' },
    CRITICAL: { badge: 'bg-rose-100 text-rose-900 border-rose-300', icon: 'bg-rose-100 text-rose-700', border: 'border-rose-300', bg: 'bg-white' },
  };
  return map[priority];
}

function PriorityIcon({ priority }: { priority: AlertPriority }) {
  if (priority === 'CRITICAL') return <ShieldAlert className="w-4 h-4" />;
  if (priority === 'HIGH PRIORITY') return <AlertTriangle className="w-4 h-4" />;
  if (priority === 'CAUTION') return <AlertTriangle className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

const SEVERITY_OPTIONS: AlertPriority[] = ['INFO', 'CAUTION', 'HIGH PRIORITY', 'CRITICAL'];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Load settings, alerts, and weather on mount
  useEffect(() => {
    setSettings(getAlertSettings());
    setAlerts(getSmartAlerts());
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }

    // Pre-fetch weather data for alert generation
    const p = getUserProfile();
    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    fetchWeatherData(loc.latitude, loc.longitude, loc.name)
      .then(setWeather)
      .catch(() => setWeather(null));
  }, []);

  // Persist settings change
  const updateSetting = (patch: Partial<AlertSettings>) => {
    const updated = saveAlertSettings(patch);
    setSettings(updated);
  };

  // Generate alerts on demand (user-initiated)
  const handleGenerateAlerts = useCallback(async () => {
    if (!weather || !settings) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const p = getUserProfile();
      const ctx: ForecastContext = {
        activity: p.activity_level,
        duration: p.exposure_duration,
        cooling: p.cooling_access,
        age_group: p.age_group,
      };

      // Compute current risk
      const currentRisk = evaluateHeatRisk(weather, ctx);

      // Score forecast
      const scoredForecast = weather.hourly_forecast
        ? scoreForecast(weather, weather.hourly_forecast.slice(0, 24), ctx, !!weather.is_cached)
        : [];

      const sourceStatus = !weather
        ? 'UNAVAILABLE'
        : weather.is_cached
        ? 'CACHED'
        : scoredForecast.length > 0 ? 'FORECAST' : 'LIVE';

      // Get active cooldowns
      const cooldownKeys = getActiveCooldownKeys(ALERT_COOLDOWN_MS);

      const newAlerts = generateAlerts({
        scoredForecast,
        currentRisk,
        settings,
        activeCooldownKeys: cooldownKeys,
        sourceStatus,
      });

      if (newAlerts.length === 0) {
        setGenerateMsg('No new alerts generated. All conditions within normal thresholds or within cooldown window.');
      } else {
        // Record cooldowns for newly fired alerts
        recordAlertCooldowns(newAlerts.map(a => a.dedup_key));
        const updated = addSmartAlerts(newAlerts);
        setAlerts(updated);
        setGenerateMsg(`${newAlerts.length} alert(s) generated from current forecast data.`);
      }
    } catch (err) {
      setGenerateMsg('Alert generation failed. Forecast data may be unavailable.');
    } finally {
      setGenerating(false);
    }
  }, [weather, settings]);

  // Dismiss alert
  const handleDismiss = (id: string) => {
    setAlerts(dismissSmartAlert(id));
  };

  // Mark read
  const handleMarkRead = (id: string) => {
    setAlerts(markSmartAlertRead(id));
  };

  // Clear dismissed
  const handleClearDismissed = () => {
    setAlerts(clearDismissedAlerts());
  };

  // Request browser notifications (only on explicit user click)
  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      updateSetting({ browser_notifications_enabled: true });
    }
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);
  const dismissedAlerts = alerts.filter(a => a.dismissed);
  const unreadCount = activeAlerts.filter(a => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">

          {/* Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-slate-500" />
                <h1 className="text-xl font-bold text-slate-900">SMART HEAT-RISK ALERTS</h1>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Rule-based environmental threshold alerts — derived from live HeatShield forecast data
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-rose-100 text-rose-800 rounded border border-rose-200">
                  {unreadCount} UNREAD
                </span>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
                title="Alert Settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
            <span>
              <strong>ENVIRONMENTAL DECISION-SUPPORT NOTICE:</strong> These alerts represent estimated environmental heat-risk thresholds derived from forecast data. They do <strong>NOT</strong> predict medical outcomes, diagnose illness, or substitute for professional advice. Alert conditions and thresholds are documented in <code className="font-mono bg-blue-100 px-1 rounded">docs/FORECAST-ALERT-VALIDATION.md</code>.
            </span>
          </div>

          {/* Alert Settings Panel */}
          {showSettings && settings && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase border-b pb-2">ALERT SETTINGS</h3>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Alerts Enabled</div>
                  <div className="text-xs text-slate-500">Enable or disable all smart heat-risk alerts</div>
                </div>
                <button
                  onClick={() => updateSetting({ alerts_enabled: !settings.alerts_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    settings.alerts_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.alerts_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Forecast Alerts Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Forecast-Based Alerts</div>
                  <div className="text-xs text-slate-500">Generate alerts from Open-Meteo forecast data</div>
                </div>
                <button
                  onClick={() => updateSetting({ forecast_alerts_enabled: !settings.forecast_alerts_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    settings.forecast_alerts_enabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.forecast_alerts_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Min Severity Filter */}
              <div>
                <div className="text-sm font-semibold text-slate-900 mb-1.5">Minimum Alert Severity</div>
                <div className="text-xs text-slate-500 mb-2">Only show alerts at or above this priority level</div>
                <div className="grid grid-cols-4 gap-2">
                  {SEVERITY_OPTIONS.map(sev => (
                    <button
                      key={sev}
                      onClick={() => updateSetting({ min_severity: sev })}
                      className={`p-2 rounded-lg text-[11px] font-bold font-mono border transition ${
                        settings.min_severity === sev
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browser Notifications — user-initiated only */}
              <div>
                <div className="text-sm font-semibold text-slate-900 mb-1">Browser Notifications</div>
                <div className="text-xs text-slate-500 mb-2">
                  Permission is only requested when you click this button. Never auto-requested on page load.
                </div>
                {notifPermission === 'unsupported' ? (
                  <span className="text-xs font-mono text-slate-400">Browser notifications not supported in this environment.</span>
                ) : notifPermission === 'granted' ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Browser notifications granted</span>
                  </div>
                ) : notifPermission === 'denied' ? (
                  <span className="text-xs font-mono text-rose-600">Notifications blocked by browser. Enable in browser site settings to use this feature.</span>
                ) : (
                  <button
                    onClick={handleRequestNotifPermission}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Enable Browser Notifications
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Generate Alerts Button + Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Generate Alerts from Current Forecast</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Runs rule-based analysis on live Open-Meteo forecast data. Deduplication prevents repeated alerts within a 60-min cooldown window.
                </p>
              </div>
              <button
                onClick={handleGenerateAlerts}
                disabled={generating || !settings?.alerts_enabled}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Analysing...' : 'Run Alert Check'}
              </button>
            </div>
            {!settings?.alerts_enabled && (
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                <BellOff className="w-3.5 h-3.5" />
                Alerts are disabled. Enable in Settings to run alert checks.
              </div>
            )}
            {generateMsg && (
              <div className="text-xs font-mono text-slate-700 p-2.5 bg-slate-50 rounded border border-slate-200">
                {generateMsg}
              </div>
            )}
          </div>

          {/* Active Alerts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">
                ACTIVE ALERTS ({activeAlerts.length})
              </h3>
              {dismissedAlerts.length > 0 && (
                <button
                  onClick={handleClearDismissed}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear {dismissedAlerts.length} dismissed
                </button>
              )}
            </div>

            {activeAlerts.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                <div className="text-sm font-semibold text-slate-700">No active alerts</div>
                <div className="text-xs text-slate-500">
                  Click "Run Alert Check" above to analyse current forecast data. No alerts will be fabricated if data is unavailable.
                </div>
              </div>
            ) : (
              activeAlerts.map((alert) => {
                const styles = priorityStyles(alert.priority);
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border ${styles.border} ${!alert.read ? styles.bg + ' shadow-xs' : 'bg-slate-50 opacity-80'} transition`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Priority Icon */}
                        <div className={`p-2 rounded-lg shrink-0 ${styles.icon}`}>
                          <PriorityIcon priority={alert.priority} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Title + Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded border ${styles.badge}`}>
                              {alert.priority}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">
                              {alert.rule_id.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              alert.source_status === 'LIVE' ? 'bg-emerald-50 text-emerald-700'
                              : alert.source_status === 'FORECAST' ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                            }`}>
                              {alert.source_status}
                            </span>
                            {!alert.read && <span className="text-[9px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">UNREAD</span>}
                          </div>

                          {/* Alert Title */}
                          <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>

                          {/* Alert Message */}
                          <p className="text-xs text-slate-700 leading-relaxed">{alert.message}</p>

                          {/* Affected Period */}
                          {alert.affected_period_label && (
                            <div className="text-[11px] font-mono text-slate-500">
                              Affected period: <strong className="text-slate-700">{alert.affected_period_label}</strong>
                            </div>
                          )}

                          {/* Trigger Data */}
                          <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-500 pt-1">
                            {alert.trigger_data.temperature != null && (
                              <span>{alert.trigger_data.temperature}°C</span>
                            )}
                            {alert.trigger_data.humidity != null && (
                              <span>Humidity {alert.trigger_data.humidity}%</span>
                            )}
                            <span>Risk {alert.trigger_data.risk_score}/100</span>
                            <span className="font-bold text-slate-700">{alert.trigger_data.risk_level}</span>
                          </div>

                          {/* Recommended Action */}
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 mt-0.5" />
                            <span>{alert.recommended_action}</span>
                          </div>

                          {/* Timestamp */}
                          <span className="text-[10px] font-mono text-slate-400 block">
                            Generated: {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!alert.read && (
                          <button
                            onClick={() => handleMarkRead(alert.id)}
                            title="Mark as Read"
                            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          title="Dismiss"
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dismissed Alerts (collapsible) */}
          {dismissedAlerts.length > 0 && (
            <div>
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-600 transition"
              >
                {showDismissed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showDismissed ? 'Hide' : 'Show'} {dismissedAlerts.length} dismissed alert(s)
              </button>
              {showDismissed && (
                <div className="mt-3 space-y-2">
                  {dismissedAlerts.map(alert => {
                    const styles = priorityStyles(alert.priority);
                    return (
                      <div key={alert.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 opacity-60">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${styles.badge}`}>{alert.priority}</span>
                          <span className="text-xs text-slate-600 font-medium">{alert.title}</span>
                          <span className="text-[10px] font-mono text-slate-400 ml-auto">{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

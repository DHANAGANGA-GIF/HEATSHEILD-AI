'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
  Settings,
  Filter,
  ArrowLeft,
  X,
  Volume2,
  Globe,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Check
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  getSmartAlerts,
  getAlertSettings,
  saveAlertSettings,
  markSmartAlertRead,
  dismissSmartAlert,
  clearDismissedAlerts,
  getUserProfile,
} from '@/lib/store';
import {
  AlertPriority,
  AlertSettings,
  SmartAlert,
  UserProfile,
} from '@/lib/types';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  NotificationPermissionState,
} from '@/lib/notification-service';

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams ? searchParams.get('id') : null;

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(getAlertSettings());
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('default');
  
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<SmartAlert | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
    setSettings(getAlertSettings());
    const smartAlertsList = getSmartAlerts();
    setAlerts(smartAlertsList);
    setPermissionStatus(getNotificationPermissionStatus());

    // Deep link selection
    if (deepLinkId) {
      const found = smartAlertsList.find(a => a.id === deepLinkId);
      if (found) {
        setSelectedAlert(found);
        markSmartAlertRead(found.id);
      }
    }
  }, [deepLinkId]);

  const refreshData = () => {
    const smartAlertsList = getSmartAlerts();
    setAlerts(smartAlertsList);
    setSettings(getAlertSettings());
    setPermissionStatus(getNotificationPermissionStatus());
  };

  const handleRequestPermission = async () => {
    const status = await requestNotificationPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      const updated = saveAlertSettings({ browser_notifications_enabled: true });
      setSettings(updated);
      setPermissionMsg('Browser notifications successfully enabled!');
    } else if (status === 'denied') {
      const updated = saveAlertSettings({ browser_notifications_enabled: false });
      setSettings(updated);
      setPermissionMsg('Browser notification permission is blocked in browser settings. Please unblock site permissions to receive desktop alerts.');
    }
  };

  const handleToggleSetting = (key: keyof AlertSettings, val: any) => {
    const updated = saveAlertSettings({ [key]: val });
    setSettings(updated);
    refreshData();
  };

  const handleMarkRead = (id: string) => {
    const updated = markSmartAlertRead(id);
    setAlerts(updated);
  };

  const handleDismiss = (id: string) => {
    const updated = dismissSmartAlert(id);
    setAlerts(updated);
  };

  const handleClearDismissed = () => {
    const updated = clearDismissedAlerts();
    setAlerts(updated);
  };

  const handleOpenDetail = (alert: SmartAlert) => {
    setSelectedAlert(alert);
    handleMarkRead(alert.id);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (selectedPriority === 'ALL') return !a.dismissed;
    if (selectedPriority === 'UNREAD') return !a.read && !a.dismissed;
    return a.priority === selectedPriority && !a.dismissed;
  });

  const unreadCount = alerts.filter(a => !a.read && !a.dismissed).length;

  const getPriorityBadge = (priority: AlertPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-rose-950 text-rose-300 border border-rose-800">CRITICAL</span>;
      case 'HIGH PRIORITY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-amber-950 text-amber-300 border border-amber-800">HIGH PRIORITY</span>;
      case 'CAUTION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-yellow-950 text-yellow-300 border border-yellow-800">CAUTION</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-blue-950 text-blue-300 border border-blue-800">INFO</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center font-mono">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">NOTIFICATION CENTER & SMART ALERTS</h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Proactive Location-Aware Heat Safety Alerts & Event History
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
              >
                <Settings className="w-4 h-4" />
                <span>Preferences</span>
              </button>
              {alerts.some(a => a.dismissed) && (
                <button
                  onClick={handleClearDismissed}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Dismissed</span>
                </button>
              )}
            </div>
          </div>

          {/* Permission Status Banner */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>Browser Desktop Push Notifications:</span>
                  <span className={`font-mono text-[11px] uppercase font-bold ${
                    permissionStatus === 'granted' ? 'text-emerald-400' : permissionStatus === 'denied' ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {permissionStatus === 'granted' ? 'ACTIVE (GRANTED)' : permissionStatus === 'denied' ? 'BLOCKED (DENIED)' : 'NOT PERMITTED (DEFAULT)'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Receive instant native browser notifications when heat risk transitions to HIGH or EXTREME.
                </p>
              </div>
            </div>

            {permissionStatus !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-xs transition shrink-0"
              >
                Enable Desktop Push
              </button>
            )}
          </div>

          {permissionMsg && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300 flex items-center justify-between">
              <span>{permissionMsg}</span>
              <button onClick={() => setPermissionMsg(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Preferences Drawer */}
          {showPreferences && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <span>Notification & Alert Preferences</span>
                </h3>
                <button onClick={() => setShowPreferences(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Enable Smart Alerts</div>
                    <div className="text-[11px] text-slate-400">Process risk transitions & triggers</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.alerts_enabled}
                    onChange={(e) => handleToggleSetting('alerts_enabled', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Minimum Alert Severity</div>
                    <div className="text-[11px] text-slate-400">Filter out lower-level advisories</div>
                  </div>
                  <select
                    value={settings.min_severity}
                    onChange={(e) => handleToggleSetting('min_severity', e.target.value as AlertPriority)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 font-mono"
                  >
                    <option value="INFO">INFO (All)</option>
                    <option value="CAUTION">CAUTION</option>
                    <option value="HIGH PRIORITY">HIGH PRIORITY</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Forecast Peak Warnings</div>
                    <div className="text-[11px] text-slate-400">Alert on upcoming 24h risk spikes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.forecast_alerts_enabled}
                    onChange={(e) => handleToggleSetting('forecast_alerts_enabled', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Location Change Advisories</div>
                    <div className="text-[11px] text-slate-400">Alert when moving to higher-risk areas</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.location_alerts_enabled ?? true}
                    onChange={(e) => handleToggleSetting('location_alerts_enabled', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Risk Recovery Alerts</div>
                    <div className="text-[11px] text-slate-400">Notify when risk safely drops to MODERATE/LOW</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.recovery_alerts_enabled ?? true}
                    onChange={(e) => handleToggleSetting('recovery_alerts_enabled', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {/* Email Delivery */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between opacity-70">
                  <div>
                    <div className="font-semibold text-slate-300 flex items-center gap-2">
                      <span>Email Delivery</span>
                      <span className="text-[9px] font-mono font-bold bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/40">
                        NOT CONFIGURED
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">Requires SMTP gateway connection</div>
                  </div>
                  <input type="checkbox" disabled checked={false} className="w-4 h-4 cursor-not-allowed" />
                </div>

                {/* SMS Delivery */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between opacity-70">
                  <div>
                    <div className="font-semibold text-slate-300 flex items-center gap-2">
                      <span>SMS / Phone Alerts</span>
                      <span className="text-[9px] font-mono font-bold bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/40">
                        NOT CONFIGURED
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">Requires Twilio API gateway connection</div>
                  </div>
                  <input type="checkbox" disabled checked={false} className="w-4 h-4 cursor-not-allowed" />
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
              {['ALL', 'UNREAD', 'CRITICAL', 'HIGH PRIORITY', 'CAUTION', 'INFO'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-3 py-1.5 rounded-lg transition font-semibold whitespace-nowrap ${
                    selectedPriority === p
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Showing {filteredAlerts.length} {filteredAlerts.length === 1 ? 'alert' : 'alerts'}
            </div>
          </div>

          {/* Alert List */}
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-white">No active notifications</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No alert events match your selected priority filter. All environmental conditions and location triggers are normal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-5 rounded-2xl border transition shadow-sm ${
                    alert.read
                      ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                      : 'bg-slate-900 border-slate-700 text-white ring-1 ring-emerald-500/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getPriorityBadge(alert.priority)}
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          {alert.location_name || profile.location?.name || 'Selected Location'}
                        </span>
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
                          {alert.source_status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{alert.title}</span>
                        {!alert.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        )}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <button
                        onClick={() => handleOpenDetail(alert)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Explainable Breakdown</span>
                      </button>

                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition"
                        title="Dismiss alert"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Explainable Notification Detail View Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getPriorityBadge(selectedAlert.priority)}
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
                    {selectedAlert.source_status}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">{selectedAlert.title}</h2>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Conditions & Risk */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Risk Score</div>
                <div className="text-xl font-bold text-amber-400 mt-1">{selectedAlert.trigger_data.risk_score} / 100</div>
                <div className="text-[10px] text-slate-400">{selectedAlert.trigger_data.risk_level}</div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Temperature</div>
                <div className="text-xl font-bold text-white mt-1">{selectedAlert.trigger_data.temperature ?? '--'}°C</div>
                <div className="text-[10px] text-slate-400">Apparent: {selectedAlert.trigger_data.apparent_temperature ?? '--'}°C</div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Relative Humidity</div>
                <div className="text-xl font-bold text-blue-400 mt-1">{selectedAlert.trigger_data.humidity ?? '--'}%</div>
                <div className="text-[10px] text-slate-400">Moisture load</div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Location Context</div>
                <div className="text-sm font-bold text-emerald-400 mt-1 truncate">{selectedAlert.location_name || profile.location?.name || 'Chennai'}</div>
                <div className="text-[10px] text-slate-400">{new Date(selectedAlert.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Why This Alert Was Generated */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>WHY THIS ALERT WAS GENERATED</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {selectedAlert.why_generated || selectedAlert.message}
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Rule Identifier: <span className="text-slate-300">{selectedAlert.rule_id}</span> | Deduplication Key: <span className="text-slate-300">{selectedAlert.dedup_key}</span>
              </div>
            </div>

            {/* XAI Risk Drivers */}
            {selectedAlert.drivers && selectedAlert.drivers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  PRIMARY XAI RISK DRIVERS
                </div>
                <div className="space-y-2">
                  {selectedAlert.drivers.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-300 font-sans">{d.name}</span>
                      <span className="text-emerald-400 font-bold">{d.impact_percent}% impact</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Preventive Action */}
            <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-800/50 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>RECOMMENDED PREVENTIVE ACTION</span>
              </div>
              <p className="text-xs text-emerald-200 leading-relaxed font-sans">
                {selectedAlert.recommended_action}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white font-mono text-xs p-12 text-center animate-pulse">
        Loading HeatShield Notification Center...
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  );
}

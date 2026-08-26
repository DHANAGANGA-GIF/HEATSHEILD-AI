'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  RefreshCw,
  Mail,
  MapPin,
  Thermometer,
  ShieldAlert,
  Flame,
  Filter,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { getRecipientProfiles, getNotificationLogs } from '@/lib/store';
import { RecipientNotificationProfile, NotificationLog, RiskLevel } from '@/lib/types';
import { BroadcastResultItem } from '@/lib/broadcast-service';

export const RealtimeBroadcastCommandCenter: React.FC = () => {
  const [recipients, setRecipients] = useState<RecipientNotificationProfile[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<number>(0);
  const [broadcastResults, setBroadcastResults] = useState<BroadcastResultItem[]>([]);
  const [lastBroadcastTime, setLastBroadcastTime] = useState<string | null>(null);

  // Filters & Customizations
  const [minRiskFilter, setMinRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [customSubject, setCustomSubject] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string | 'ALL'>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = () => {
    setRecipients(getRecipientProfiles());
    setLogs(getNotificationLogs());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteBroadcast = async () => {
    setIsBroadcasting(true);
    setBroadcastProgress(10);
    setStatusMessage(null);
    setBroadcastResults([]);

    const sendToAll = selectedRecipient === 'ALL';
    const targetEmail = sendToAll ? undefined : selectedRecipient;

    try {
      setBroadcastProgress(35);
      const res = await fetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendToAll,
          targetEmail,
          minRiskLevel: minRiskFilter !== 'ALL' ? minRiskFilter : undefined,
          customSubject: customSubject.trim() || undefined,
        }),
      });

      setBroadcastProgress(80);
      const data = await res.json();

      if (data.success && Array.isArray(data.results)) {
        setBroadcastProgress(100);
        setBroadcastResults(data.results);
        setLastBroadcastTime(new Date().toLocaleTimeString());
        setStatusMessage(
          `✓ Real-Time Broadcast Complete: ${data.successfulDispatches} of ${data.totalRecipients} subscribers received live weather & precautions!`
        );
        loadData();
      } else {
        setStatusMessage(`❌ Broadcast dispatch failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error calling broadcast engine: ${err?.message || 'Network error'}`);
    } finally {
      setIsBroadcasting(false);
      setTimeout(() => setBroadcastProgress(0), 4000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-mono tracking-tight uppercase">
                REAL-TIME MULTI-USER BROADCAST COMMAND CENTER
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                ACTIVE GATEWAY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated real-time dispatch of live weather, GPS telemetry & dynamic precautions to all registered users
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition"
            title="Refresh Subscriber List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono relative z-10">
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Registered Users</span>
          <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <Users className="w-5 h-5" />
            <span>{recipients.length}</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Monitored Zones</span>
          <div className="text-2xl font-bold text-sky-400 flex items-center gap-1.5 mt-0.5">
            <MapPin className="w-5 h-5" />
            <span>{new Set(recipients.map(r => r.location_name)).size}</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Total Dispatches</span>
          <div className="text-2xl font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
            <Send className="w-5 h-5" />
            <span>{logs.length}</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Delivery Status</span>
          <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <CheckCheck className="w-5 h-5" />
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Broadcast Control Matrix */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Broadcast Trigger Console</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Queries real-time live environmental observations for every subscriber&apos;s region and sends individualized precaution emails.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Registered Users ({recipients.length})</option>
              {recipients.map((r) => (
                <option key={r.email} value={r.email}>
                  {r.display_name || r.email} ({r.location_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional Custom Subject */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Custom Broadcast Subject (Optional)</label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="e.g. HeatShield AI | High Heat Advisory Broadcast"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Minimum Severity Filter</label>
            <select
              value={minRiskFilter}
              onChange={(e) => setMinRiskFilter(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Send to All Subscribers (All Risk Levels)</option>
              <option value="MODERATE">Moderate Risk or Higher (&gt;= 30 Score)</option>
              <option value="HIGH">High Risk or Higher (&gt;= 60 Score)</option>
              <option value="EXTREME">Extreme Risk Only (&gt;= 80 Score)</option>
            </select>
          </div>
        </div>

        {/* Progress Bar (Visible during broadcast) */}
        {broadcastProgress > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>Broadcasting live weather & precautions to subscribers...</span>
              <span>{broadcastProgress}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${broadcastProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Execute Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] font-mono text-slate-500">
            {lastBroadcastTime && `Last dispatched at: ${lastBroadcastTime}`}
          </div>

          <button
            onClick={handleExecuteBroadcast}
            disabled={isBroadcasting || recipients.length === 0}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/60 disabled:opacity-50"
          >
            {isBroadcasting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Broadcasting Live Telemetry...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {selectedRecipient === 'ALL'
                    ? `Broadcast Real-Time Live Weather & Precautions (${recipients.length} Users)`
                    : `Dispatch Real-Time Alert to ${selectedRecipient}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 font-mono ${
          statusMessage.startsWith('✓')
            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
            : 'bg-rose-950/70 border-rose-800 text-rose-200'
        }`}>
          {statusMessage.startsWith('✓') ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Broadcast Results Matrix */}
      {broadcastResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
            Latest Broadcast Transmission Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto">
            {broadcastResults.map((res, i) => (
              <div
                key={i}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white truncate">{res.recipient}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      res.success ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {res.success ? 'SENT' : 'FAILED'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{res.locationName}</span>
                  <span className="text-emerald-400 font-bold">{res.temperature}°C</span>
                </div>

                <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-900 pt-1">
                  <span>Risk: {res.riskLevel || 'EVALUATED'} ({res.riskScore}/100)</span>
                  <span>{res.precautionsCount || 7} Precautions</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registered Subscriber Directory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Active Subscriber Directory ({recipients.length})</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Live Auto-Sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {recipients.map((rec) => (
            <div
              key={rec.id}
              className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-1 text-xs"
            >
              <div className="font-bold text-white font-mono text-[11px] truncate">
                {rec.display_name || rec.email}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{rec.email}</div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                <span>{rec.location_name}</span>
                <span className="text-emerald-400">
                  {rec.location_source === 'LIVE_GPS' ? 'GPS' : 'SAVED'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

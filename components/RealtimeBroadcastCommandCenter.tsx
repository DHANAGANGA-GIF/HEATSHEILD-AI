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
  Clock,
  ShieldCheck,
  CheckCheck,
  AlertCircle,
  Play,
  Calendar,
  Layers
} from 'lucide-react';
import { getRecipientProfiles, getHeatRiskDispatchLogs } from '@/lib/store';
import { RecipientNotificationProfile, HeatRiskDispatchLog, RiskLevel } from '@/lib/types';
import { useAuth } from '@/lib/firebase/auth-context';

export const RealtimeBroadcastCommandCenter: React.FC = () => {
  const { firebaseUser, getIdToken } = useAuth();
  const [recipients, setRecipients] = useState<RecipientNotificationProfile[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<HeatRiskDispatchLog[]>([]);
  const [activeTab, setActiveTab] = useState<'TEST' | 'MANUAL' | 'CRON'>('TEST');
  const [emailServiceStatus, setEmailServiceStatus] = useState<any>(null);
  const [lastDispatchDuration, setLastDispatchDuration] = useState<number | null>(null);

  // Execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');

  // Manual & Test form controls
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [minRiskFilter, setMinRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');

  const loadData = () => {
    const recs = getRecipientProfiles();
    setRecipients(recs);
    const logs = getHeatRiskDispatchLogs();
    setDispatchLogs(logs);
    if (!selectedRecipientEmail && recs.length > 0) {
      setSelectedRecipientEmail(recs[0].email);
    }
    fetch('/api/email/status')
      .then((res) => res.json())
      .then((data) => setEmailServiceStatus(data))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Compute live dispatch telemetry from real logs
  const totalDispatches = dispatchLogs.length;
  const acceptedDispatches = dispatchLogs.filter((l) => l.status === 'ACCEPTED' || l.status === 'SENT').length;
  const failedDispatches = dispatchLogs.filter((l) => l.status === 'FAILED').length;
  const skippedDispatches = dispatchLogs.filter((l) => l.status === 'SKIPPED').length;
  const latestLog = dispatchLogs[0];
  const lastFailure = dispatchLogs.find((l) => l.status === 'FAILED');

  // Calculate next scheduled hourly run
  const calculateNextHourlyRun = (): string => {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    return nextHour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Send Test Report to current user
  const handleSendTestReport = async () => {
    if (!firebaseUser) {
      setStatusType('error');
      setStatusMessage('Authentication required: Please sign in to receive a personal test report.');
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setStatusMessage(null);
    setResults([]);

    try {
      const idToken = await getIdToken();
      setProgress(50);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'TEST',
          customSubject: customSubject.trim() || undefined,
          clientLocation: {
            latitude: 13.0827,
            longitude: 80.2707,
            location_name: 'Current Monitored Region',
            location_source: 'SAVED_LOCATION',
          },
        }),
      });

      setProgress(90);
      const data = await res.json();

      if (data.success && Array.isArray(data.results)) {
        setProgress(100);
        setResults(data.results);
        setStatusType('success');
        const confirmedRecipient = data.verifiedRecipient || firebaseUser?.email;
        setStatusMessage(`Test advisory successfully accepted by provider for ${confirmedRecipient}!`);
        loadData();
      } else {
        setStatusType('error');
        setStatusMessage(data.error || 'Test report dispatch failed.');
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Network error triggering test dispatch: ${err?.message || 'Check connection'}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 4000);
    }
  };

  // 2. Send Manual Report to a selected subscriber (Admin Only)
  const handleSendManualReport = async () => {
    if (!firebaseUser) {
      setStatusType('error');
      setStatusMessage('Authentication required.');
      return;
    }

    if (!selectedRecipientEmail) {
      setStatusType('error');
      setStatusMessage('Please select an active recipient from the subscriber list.');
      return;
    }

    setIsProcessing(true);
    setProgress(25);
    setStatusMessage(null);
    setResults([]);

    try {
      const idToken = await getIdToken();
      setProgress(50);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'MANUAL',
          targetEmail: selectedRecipientEmail,
          minRiskLevel: minRiskFilter !== 'ALL' ? minRiskFilter : undefined,
          customSubject: customSubject.trim() || undefined,
        }),
      });

      setProgress(90);
      const data = await res.json();

      if (data.success && Array.isArray(data.results)) {
        setProgress(100);
        setResults(data.results);
        setStatusType('success');
        setStatusMessage(`Manual advisory successfully accepted by provider for ${selectedRecipientEmail}!`);
        loadData();
      } else if (res.status === 403) {
        setStatusType('error');
        setStatusMessage('Forbidden: Administrator role required to trigger manual dispatches to other subscribers.');
      } else {
        setStatusType('error');
        setStatusMessage(data.error || 'Manual dispatch failed.');
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Network exception: ${err?.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 4000);
    }
  };

  // 3. Trigger Hourly Automatic Dispatch via Cron route
  const handleTriggerHourlyCron = async () => {
    setIsProcessing(true);
    setProgress(30);
    setStatusMessage(null);
    setResults([]);

    try {
      const idToken = await getIdToken();
      setProgress(60);

      const res = await fetch('/api/cron/heat-risk-dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
      });

      setProgress(90);
      const data = await res.json();

      if (data.success) {
        setProgress(100);
        setStatusType('success');
        setStatusMessage(
          `Hourly dispatch complete: ${data.processed} processed, ${data.sent} accepted, ${data.skipped} skipped, ${data.failed} failed.`
        );
        if (Array.isArray(data.results)) {
          setResults(
            data.results.map((r: any) => ({
              recipient: r.email,
              locationName: r.location,
              success: r.status === 'ACCEPTED' || r.status === 'SENT',
              riskScore: r.riskScore,
              riskLevel: r.riskLevel,
              error: r.reason,
            }))
          );
        }
        loadData();
      } else {
        setStatusType('error');
        setStatusMessage(data.error || 'Hourly dispatch invocation failed.');
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Error executing cron: ${err?.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 4000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
      {/* Ambient background glow */}
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
                DISPATCH CONTROL COMMAND CENTER
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                VERIFIED GATEWAY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated hourly personalized thermal risk notifications and controlled broadcast triggers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition flex items-center gap-1.5"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Admin Notification Status Panel (Real Data) */}
      <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-mono text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Hourly Dispatch Status Panel</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Schedule: 0 * * * * (Hourly)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">TOTAL SUBSCRIBERS</span>
            <span className="text-slate-200 font-bold block mt-0.5">{recipients.length} ({recipients.filter(r => r.hourly_heat_alerts_enabled).length} eligible)</span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">ATTEMPTED</span>
            <span className="text-slate-200 font-bold block mt-0.5">{totalDispatches}</span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">SENT / ACCEPTED</span>
            <span className="text-emerald-400 font-bold block mt-0.5">{acceptedDispatches}</span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">FAILED</span>
            <span className="text-rose-400 font-bold block mt-0.5">{failedDispatches}</span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">PROVIDER</span>
            <span className="text-sky-400 font-bold block mt-0.5 uppercase">
              {emailServiceStatus?.provider || 'EMAIL'} ({emailServiceStatus?.mode || 'ACTIVE'})
            </span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">NEXT SCHEDULED</span>
            <span className="text-sky-400 font-bold block mt-0.5">{calculateNextHourlyRun()}</span>
          </div>
        </div>

        {emailServiceStatus?.message && (
          <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Provider Status: {emailServiceStatus.message}</span>
            {emailServiceStatus.provider === 'gmail' && !emailServiceStatus.oauthConnected && (
              <a
                href="/api/email/google/connect"
                className="text-emerald-400 hover:underline font-bold"
              >
                Connect Gmail OAuth &rarr;
              </a>
            )}
          </div>
        )}

        {lastFailure && (
          <div className="p-2.5 bg-rose-950/40 rounded-xl border border-rose-900/60 text-xs font-mono text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold">Last Provider / Weather Failure:</span>{' '}
              <span>{lastFailure.error_message || 'Delivery rejected'}</span>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-500 italic">
          * Scheduled hourly; execution timing depends on the deployed Vercel plan.
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2 relative z-10">
        <button
          onClick={() => { setActiveTab('TEST'); setStatusMessage(null); }}
          className={`px-4 py-2 text-xs font-mono font-bold rounded-t-xl transition border-t border-x ${
            activeTab === 'TEST'
              ? 'bg-slate-950 text-emerald-400 border-slate-800 border-b-transparent'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          1. Send Test Report
        </button>

        <button
          onClick={() => { setActiveTab('MANUAL'); setStatusMessage(null); }}
          className={`px-4 py-2 text-xs font-mono font-bold rounded-t-xl transition border-t border-x ${
            activeTab === 'MANUAL'
              ? 'bg-slate-950 text-sky-400 border-slate-800 border-b-transparent'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          2. Send Manual Report (Admin)
        </button>

        <button
          onClick={() => { setActiveTab('CRON'); setStatusMessage(null); }}
          className={`px-4 py-2 text-xs font-mono font-bold rounded-t-xl transition border-t border-x ${
            activeTab === 'CRON'
              ? 'bg-slate-950 text-amber-400 border-slate-800 border-b-transparent'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          3. Hourly Automatic Dispatch
        </button>
      </div>

      {/* Tab 1: SEND TEST REPORT */}
      {activeTab === 'TEST' && (
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4 relative z-10">
          <div>
            <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Send Personal Test Heat-Risk Report</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dispatches a point-in-time environmental advisory directly to your authenticated email (
              <span className="text-white font-mono">{firebaseUser?.email || 'Sign in required'}</span>).
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Custom Subject (Optional)</label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="e.g. HeatShield AI — Test Thermal Advisory"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-slate-500">
              Uses live Open-Meteo observations & physics-context dual risk engine
            </span>

            <button
              onClick={handleSendTestReport}
              disabled={isProcessing || !firebaseUser}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/60 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Test Report...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Test Report To Me</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: SEND MANUAL REPORT (Admin) */}
      {activeTab === 'MANUAL' && (
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4 relative z-10">
          <div>
            <h3 className="text-xs font-bold font-mono text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Manual Subscriber Dispatch</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dispatches an immediate advisory to a selected registered subscriber using{' '}
              <strong className="text-slate-200">THEIR saved location and weather</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Subscriber</label>
              <select
                value={selectedRecipientEmail}
                onChange={(e) => setSelectedRecipientEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
              >
                {recipients.length === 0 ? (
                  <option value="">No registered subscribers found</option>
                ) : (
                  recipients.map((r) => (
                    <option key={r.email} value={r.email}>
                      {r.display_name || r.email} ({r.location_name})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Minimum Risk Filter</label>
              <select
                value={minRiskFilter}
                onChange={(e) => setMinRiskFilter(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">Send Regardless of Risk Level</option>
                <option value="MODERATE">Moderate Risk or Higher (&gt;= 36 Score)</option>
                <option value="HIGH">High Risk or Higher (&gt;= 61 Score)</option>
                <option value="EXTREME">Extreme Risk Only (&gt;= 81 Score)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-slate-500">
              60s cooldown enforced to prevent accidental duplicate dispatches
            </span>

            <button
              onClick={handleSendManualReport}
              disabled={isProcessing || recipients.length === 0}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center gap-2 shadow-lg shadow-sky-950/60 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Report...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Dispatch Report to Subscriber</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: HOURLY AUTOMATIC DISPATCH */}
      {activeTab === 'CRON' && (
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4 relative z-10">
          <div>
            <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>Hourly Automated Dispatch Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production Vercel Cron endpoint:{' '}
              <code className="text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded">
                /api/cron/heat-risk-dispatch
              </code>{' '}
              with hourly schedule <code className="text-emerald-400">0 * * * *</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
            <div className="flex items-center justify-between">
              <span>Database Idempotency:</span>
              <span className="text-emerald-400 font-bold">ACTIVE (dispatch_key UNIQUE)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Duplicate Protection:</span>
              <span className="text-emerald-400 font-bold">1 Email / Hour / User Window</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Weather Source:</span>
              <span className="text-sky-400 font-bold">Live Open-Meteo per user location</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-slate-500">
              Triggers the complete hourly batch pipeline on demand
            </span>

            <button
              onClick={handleTriggerHourlyCron}
              disabled={isProcessing}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/60 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing Hourly Cycle...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Hourly Dispatch Cycle Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-emerald-500 h-2 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 font-mono ${
            statusType === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800 text-rose-200'
          }`}
        >
          {statusType === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Latest Dispatch Results Summary */}
      {results.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
            Latest Dispatch Telemetry
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
            {results.map((res, i) => (
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
                    {res.success ? 'ACCEPTED' : 'FAILED'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{res.locationName}</span>
                  {res.riskScore !== undefined && (
                    <span className="text-emerald-400 font-bold">Score: {res.riskScore}/100</span>
                  )}
                </div>

                {res.error && (
                  <div className="text-[10px] text-rose-400 border-t border-slate-900 pt-1">
                    {res.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Subscriber Directory */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Active Subscriber Directory ({recipients.length})</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Live Auto-Sync</span>
        </div>

        {recipients.length === 0 ? (
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-500 font-mono text-center">
            No active subscribers registered yet. Users can opt-in from their Profile page.
          </div>
        ) : (
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
                  <span className={rec.hourly_heat_alerts_enabled ? 'text-emerald-400' : 'text-slate-500'}>
                    {rec.hourly_heat_alerts_enabled ? 'HOURLY ON' : 'HOURLY OFF'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

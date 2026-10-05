'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/firebase/auth-context';
import { authenticatedFetch } from '@/lib/api-client';
import {
  ShieldCheck,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  PowerOff,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export default function AdminEmailDeliveryPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { appProfile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);

  const [senderConfig, setSenderConfig] = useState<{
    loading: boolean;
    senderStatus: 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR';
    senderAddress: string;
    provider: string;
    lastSuccessfulDelivery: string | null;
    lastDeliveryFailure: string | null;
    error: string | null;
  }>({
    loading: false,
    senderStatus: 'NOT CONFIGURED',
    senderAddress: 'Not configured',
    provider: 'Gmail API',
    lastSuccessfulDelivery: null,
    lastDeliveryFailure: null,
    error: null,
  });

  const [testSenderLoading, setTestSenderLoading] = useState(false);
  const [testSenderMessage, setTestSenderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function verifyAdminAccess() {
      setAdminCheckLoading(true);
      setAdminCheckError(null);

      try {
        const res = await authenticatedFetch('/api/admin/verify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.ok && data.isAdmin) {
          setIsAdmin(true);
          fetchSenderConfig();
        } else {
          setIsAdmin(false);
          setAdminCheckError(data.error || 'Access denied. Administrator privileges required.');
        }
      } catch (err: any) {
        setIsAdmin(false);
        setAdminCheckError(err?.message || 'Admin verification error.');
      } finally {
        setAdminCheckLoading(false);
      }
    }

    if (!authLoading) verifyAdminAccess();
  }, [authLoading]);

  const fetchSenderConfig = async () => {
    setSenderConfig((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await authenticatedFetch('/api/admin/email/sender');
      const data = await res.json();
      if (res.ok) {
        setSenderConfig({
          loading: false,
          senderStatus: data.senderStatus || (data.connected ? 'CONNECTED' : 'NOT CONFIGURED'),
          senderAddress: data.senderAddress || (data.email ? data.email : 'Not configured'),
          provider: data.provider || 'Gmail API',
          lastSuccessfulDelivery: data.lastSuccessfulDelivery || null,
          lastDeliveryFailure: data.lastDeliveryFailure || null,
          error: null,
        });
      } else {
        setSenderConfig((prev) => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to inspect sender configuration.',
        }));
      }
    } catch (err: any) {
      setSenderConfig((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Error communicating with sender endpoint.',
      }));
    }
  };

  const handleTestSender = async () => {
    setTestSenderLoading(true);
    setTestSenderMessage(null);
    try {
      const res = await authenticatedFetch('/api/admin/email/sender/test', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestSenderMessage({
          type: 'success',
          text: data.message || 'System sender test email dispatched successfully.',
        });
        fetchSenderConfig();
      } else {
        setTestSenderMessage({
          type: 'error',
          text: data.error || 'Sender test failed. Check Gmail API credentials.',
        });
      }
    } catch (err: any) {
      setTestSenderMessage({
        type: 'error',
        text: err?.message || 'Network error triggering sender test.',
      });
    } finally {
      setTestSenderLoading(false);
    }
  };

  const handleDisconnectSender = async () => {
    if (!confirm('Are you sure you want to disconnect the system Gmail sender? All background notifications will be unavailable until reconnected.')) {
      return;
    }
    try {
      const res = await authenticatedFetch('/api/admin/email/sender', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchSenderConfig();
      } else {
        alert(data.error || 'Failed to disconnect system sender.');
      }
    } catch {
      alert('Error disconnecting system sender.');
    }
  };

  if (adminCheckLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 font-mono text-sm text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          Verifying Administrator Privileges...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-mono">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-rose-900/60 rounded-xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 text-rose-400 flex items-center justify-center mx-auto border border-rose-800">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-rose-300">Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {adminCheckError || 'This section is restricted to authorized HeatShield administrators only.'}
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                title="Back to Admin Console"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-400" />
                  SYSTEM EMAIL DELIVERY / SENDER CONFIGURATION
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Administrative control panel for HeatShield system-wide notification sender.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-950/60 text-purple-300 rounded border border-purple-800/80">
              ADMIN ONLY
            </span>
          </div>

          {/* Sender Panel */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-6 font-mono text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-slate-400 text-xs">Provider Configuration & Diagnostics</span>
              <button
                onClick={fetchSenderConfig}
                disabled={senderConfig.loading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${senderConfig.loading ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
            </div>

            {/* Sender Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[11px] text-slate-400 uppercase">Sender Status</span>
                <div className="pt-1">
                  <span className={`px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5 ${
                    senderConfig.senderStatus === 'CONNECTED'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                      : senderConfig.senderStatus === 'ERROR'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                  }`}>
                    {senderConfig.senderStatus === 'CONNECTED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {senderConfig.senderStatus === 'ERROR' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {senderConfig.senderStatus}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[11px] text-slate-400 uppercase">Sender Address</span>
                <div className="pt-1 text-sm font-bold text-slate-200 truncate">
                  {senderConfig.senderAddress}
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[11px] text-slate-400 uppercase">Provider</span>
                <div className="pt-1 text-sm font-bold text-slate-200">
                  {senderConfig.provider}
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[11px] text-slate-400 uppercase">Last Successful Delivery</span>
                <div className="pt-1 text-xs text-slate-300 truncate">
                  {senderConfig.lastSuccessfulDelivery ? new Date(senderConfig.lastSuccessfulDelivery).toLocaleString() : 'No deliveries recorded'}
                </div>
              </div>
            </div>

            {senderConfig.lastDeliveryFailure && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <span className="font-bold">Last Delivery Failure: </span>
                  <span>{senderConfig.lastDeliveryFailure}</span>
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {senderConfig.senderStatus === 'CONNECTED' ? (
                <>
                  <a
                    href="/api/email/google/connect"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 flex items-center gap-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect Sender
                  </a>
                  <button
                    onClick={handleTestSender}
                    disabled={testSenderLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {testSenderLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Test Sender
                  </button>
                  <button
                    onClick={handleDisconnectSender}
                    className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-bold rounded-lg flex items-center gap-2 transition"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    Disconnect Sender
                  </button>
                </>
              ) : (
                <a
                  href="/api/email/google/connect"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition shadow-md shadow-emerald-950/40"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Connect Sender
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {testSenderMessage && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                testSenderMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}>
                {testSenderMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                <span>{testSenderMessage.text}</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

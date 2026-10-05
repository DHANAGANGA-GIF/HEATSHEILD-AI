'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  addOrganizationMember,
  createOrganization,
  getAuditLogs,
  getOrganizationMembers,
  getOrganizations,
  isAdminAuthorized,
  logAuditEvent,
} from '@/lib/organization-service';
import {
  deleteCommunityReport,
  fetchCommunityReportsFromSupabase,
  getUserProfile,
  VERIFIED_COOLING_LOCATIONS,
} from '@/lib/store';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  AuditLogItem,
  CommunityReport,
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationType,
  VerifiedCoolingLocation,
} from '@/lib/types';
import {
  ShieldCheck, Activity, Users, Database, Server, BarChart3,
  AlertCircle, Plus, Trash2, CheckCircle, ShieldAlert, Lock, Loader2,
  Mail, Send, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, PowerOff
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';

export default function AdminPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { appProfile, getIdToken, loading: authLoading, isAuthenticated } = useAuth();
  const profile = appProfile || getUserProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'orgs' | 'reports' | 'cooling' | 'audit' | 'ml' | 'email'>('orgs');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [coolingLocs, setCoolingLocs] = useState<VerifiedCoolingLocation[]>(VERIFIED_COOLING_LOCATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Email sender configuration state
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

  // Form states for creating new org
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState<OrganizationType>('school');
  const [newOrgLocality, setNewOrgLocality] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const mlMetrics = {
    best_model: 'Gradient Boosting',
    model_version: 'HeatShield-ML v1.2',
    metrics: {
      accuracy: 0.8170,
      precision: 0.8085,
      recall: 0.8112,
      macro_f1: 0.8083,
      confusion_matrix: [
        [240, 10, 0, 0],
        [15, 235, 12, 0],
        [0, 18, 242, 8],
        [0, 0, 14, 206],
      ],
    },
    notice: 'SYNTHETIC DEVELOPMENT DATA — NOT REAL-WORLD VALIDATION',
  };

  useEffect(() => {
    async function verifyAdminAccess() {
      setAdminCheckLoading(true);
      setAdminCheckError(null);

      try {
        // Step 1: Try server-side verification with Firebase ID token
        const res = await authenticatedFetch('/api/admin/verify-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
          if (res.ok) {
            // Server says admin — trust it
            setIsAdmin(data.isAdmin === true);
            if (!data.isAdmin) {
              setAdminCheckError(`Access denied. Server-verified role: ${data.role || 'user'}`);
            }
            setAdminCheckLoading(false);
            if (data.isAdmin) {
              setOrganizations(getOrganizations());
              setMembers(getOrganizationMembers());
              setAuditLogs(getAuditLogs());
              fetchCommunityReportsFromSupabase().then(setReports);
              fetchSenderConfig();
            }
            return;
          }

        // Step 2: Fallback — local role check (less secure, warns user)
        const authorized = isAdminAuthorized(profile.role);
        if (!authorized) {
          setAdminCheckError(
            `Access denied. Current role: "${profile.role}". Admin or Super Admin role is required.`
          );
        }
        setIsAdmin(authorized);
        if (authorized) {
          setOrganizations(getOrganizations());
          setMembers(getOrganizationMembers());
          setAuditLogs(getAuditLogs());
          fetchCommunityReportsFromSupabase().then(setReports);
          fetchSenderConfig();
        }
      } catch (err: any) {
        setAdminCheckError(err?.message || 'Admin verification error.');
        setIsAdmin(false);
      } finally {
        setAdminCheckLoading(false);
      }
    }

    if (!authLoading) verifyAdminAccess();
  }, [authLoading, profile.role, getIdToken]);

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
        setActionNotice('System sender disconnected successfully.');
        fetchSenderConfig();
      } else {
        alert(data.error || 'Failed to disconnect system sender.');
      }
    } catch {
      alert('Error disconnecting system sender.');
    }
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const created = createOrganization(newOrgName.trim(), newOrgType, {
      name: newOrgLocality || newOrgName.trim(),
      locality: newOrgLocality || 'Tamil Nadu',
      latitude: 13.0827,
      longitude: 80.2707,
    });

    setOrganizations(getOrganizations());
    setNewOrgName('');
    setNewOrgLocality('');
    logAuditEvent('ADMIN_CREATE_ORGANIZATION', { orgId: created.id, name: created.name }, profile.id);
    setActionNotice(`Organization "${created.name}" created successfully.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteReport = async (reportId: string) => {
    const res = await deleteCommunityReport(profile.id, reportId);
    if (res.success) {
      const updated = reports.filter((r) => r.id !== reportId);
      setReports(updated);
      logAuditEvent('ADMIN_DELETE_REPORT', { reportId }, profile.id);
      setActionNotice('Report removed by administrator.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  if (adminCheckLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
        <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-sm font-mono">Verifying admin credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
        <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <div className="flex-1 flex">
          <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
          <main className="flex-1 p-6 max-w-3xl mx-auto w-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-rose-100 text-rose-800 rounded-full">
              <Lock className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">ACCESS RESTRICTED</h1>
            <p className="text-xs text-slate-600 font-mono max-w-md">
              {adminCheckError || `Administrative Console access requires Admin or Super Admin privileges. Current Role: ${profile.role?.toUpperCase() || 'USER'}.`}
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Admin roles are assigned server-side and cannot be self-promoted. Contact a system administrator.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-950/60 text-purple-400 border border-purple-800/60 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">PLATFORM ADMIN CONSOLE</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Organization Management, Incident Moderation, System Audit Logs & ML Benchmark
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-950/60 text-purple-300 rounded border border-purple-800/80">
              SUPER ADMIN MODE
            </span>
          </div>

          {actionNotice && (
            <div className="p-4 bg-slate-950 text-slate-200 border border-slate-800 rounded-xl text-xs font-mono flex items-center justify-between">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 text-xs font-mono font-bold">
            {[
              { id: 'orgs', label: 'ORGANIZATIONS & USERS' },
              { id: 'reports', label: 'COMMUNITY MODERATION' },
              { id: 'cooling', label: 'VERIFIED COOLING SPOTS' },
              { id: 'audit', label: 'SYSTEM AUDIT LOGS' },
              { id: 'ml', label: 'ML MODEL BENCHMARK' },
              { id: 'email', label: 'EMAIL DELIVERY & SENDER' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Organizations & Users */}
          {activeTab === 'orgs' && (
            <div className="space-y-6">
              {/* Create Organization Form */}
              <form onSubmit={handleCreateOrg} className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4 font-mono text-xs">
                <h3 className="font-bold text-slate-300 uppercase">CREATE NEW ORGANIZATION</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Organization Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City High School"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Type *</label>
                    <select
                      value={newOrgType}
                      onChange={(e) => setNewOrgType(e.target.value as OrganizationType)}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="school">School</option>
                      <option value="worksite">Worksite</option>
                      <option value="ngo">NGO Relief</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Locality / Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Egmore, Chennai"
                      value={newOrgLocality}
                      onChange={(e) => setNewOrgLocality(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2.5 bg-purple-900 hover:bg-purple-800 text-white font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provision Organization</span>
                </button>
              </form>

              {/* Organizations Table */}
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">ACTIVE ORGANIZATIONS ({organizations.length})</h3>

                {organizations.length === 0 ? (
                  <div className="p-6 bg-slate-950 rounded-xl text-center text-xs font-mono text-slate-400 border border-slate-800">
                    No active organizations provisioned.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left border border-slate-800">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Locality</th>
                          <th className="p-2.5">Members</th>
                          <th className="p-2.5">Created At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {organizations.map((org) => (
                          <tr key={org.id} className="hover:bg-slate-800/50">
                            <td className="p-2.5 text-slate-500">{org.id}</td>
                            <td className="p-2.5 font-bold text-slate-100">{org.name}</td>
                            <td className="p-2.5 font-bold uppercase text-purple-400">{org.type}</td>
                            <td className="p-2.5 text-slate-300">{org.locality || 'Chennai'}</td>
                            <td className="p-2.5 font-bold">{org.member_count}</td>
                            <td className="p-2.5 text-slate-500">{new Date(org.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Community Moderation */}
          {activeTab === 'reports' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">COMMUNITY INCIDENT MODERATION</h3>

              {reports.length === 0 ? (
                <div className="p-6 bg-slate-950 rounded-xl text-center text-xs font-mono text-slate-400 border border-slate-800">
                  No community reports available for moderation.
                </div>
              ) : (
                <div className="space-y-3 font-sans text-xs">
                  {reports.map((rep) => (
                    <div key={rep.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-100 uppercase">{rep.category.replace('_', ' ')}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">📍 {rep.location.name}</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-bold">{rep.status}</span>
                        </div>
                        <p className="text-slate-300">{rep.description}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteReport(rep.id)}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-mono font-bold text-xs rounded-lg flex items-center gap-1 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Verified Cooling Spots */}
          {activeTab === 'cooling' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">VERIFIED PUBLIC COOLING REGISTRY ({coolingLocs.length})</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coolingLocs.map((loc) => (
                  <div key={loc.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                    <div className="font-bold text-emerald-400 text-sm">✓ {loc.name}</div>
                    <p className="text-slate-300 font-sans text-xs">📍 {loc.address}</p>
                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                      <span>🕒 {loc.operating_hours}</span>
                      <span className="font-bold text-emerald-400">VERIFIED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: System Audit Logs */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">SYSTEM SECURITY & ISOLATION AUDIT LOGS ({auditLogs.length})</h3>

              {auditLogs.length === 0 ? (
                <div className="p-6 bg-slate-950 rounded-xl text-center text-xs font-mono text-slate-400 border border-slate-800">
                  No system audit logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2 text-xs font-mono text-slate-300">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-purple-400 mr-2">[{log.action}]</span>
                        <span className="text-slate-300">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: ML Benchmark */}
          {activeTab === 'ml' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">OFFLINE RESEARCH ML BENCHMARK (RESEARCH ONLY)</h3>
                  <span className="text-xs font-mono text-slate-300">Evaluated Model: {mlMetrics.best_model} ({mlMetrics.model_version}) — Note: Production runs Rule-Based Engine</span>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 bg-amber-950/60 text-amber-300 rounded border border-amber-800/80 font-bold">
                  {mlMetrics.notice}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">ACCURACY</div>
                  <div className="text-xl font-bold text-slate-100 mt-1">{(mlMetrics.metrics.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">PRECISION</div>
                  <div className="text-xl font-bold text-slate-100 mt-1">{(mlMetrics.metrics.precision * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">RECALL</div>
                  <div className="text-xl font-bold text-slate-100 mt-1">{(mlMetrics.metrics.recall * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">MACRO F1</div>
                  <div className="text-xl font-bold text-purple-400 mt-1">{(mlMetrics.metrics.macro_f1 * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: System Email Delivery & Sender Configuration */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-6 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-400" />
                      EMAIL DELIVERY / SENDER CONFIGURATION
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure and monitor the system-wide sender account for autonomous HeatShield alerts. Normal users do not need or see this.
                    </p>
                  </div>
                  <button
                    onClick={fetchSenderConfig}
                    disabled={senderConfig.loading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 transition self-start"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${senderConfig.loading ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                </div>

                {/* Sender Status Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Sender Status */}
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

                  {/* Card 2: Sender Address (Masked) */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase">Sender Address</span>
                    <div className="pt-1 text-sm font-bold text-slate-200 truncate">
                      {senderConfig.senderAddress}
                    </div>
                  </div>

                  {/* Card 3: Provider */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase">Provider</span>
                    <div className="pt-1 text-sm font-bold text-slate-200">
                      {senderConfig.provider}
                    </div>
                  </div>

                  {/* Card 4: Last Successful Delivery */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase">Last Successful Delivery</span>
                    <div className="pt-1 text-xs text-slate-300 truncate">
                      {senderConfig.lastSuccessfulDelivery ? new Date(senderConfig.lastSuccessfulDelivery).toLocaleString() : 'No deliveries recorded'}
                    </div>
                  </div>
                </div>

                {/* Failure banner if present */}
                {senderConfig.lastDeliveryFailure && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <span className="font-bold">Last Delivery Failure: </span>
                      <span>{senderConfig.lastDeliveryFailure}</span>
                    </div>
                  </div>
                )}

                {/* Security Notice */}
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-slate-400 text-xs leading-relaxed space-y-1">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Security & Credential Integrity
                  </div>
                  <p>
                    OAuth refresh tokens are encrypted at rest using server-side AES-256-GCM. Client secrets, access tokens, and private keys are never returned to the browser.
                  </p>
                </div>

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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

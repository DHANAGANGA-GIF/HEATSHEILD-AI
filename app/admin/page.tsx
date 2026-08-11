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
  getCommunityReports,
  getUserProfile,
  VERIFIED_COOLING_LOCATIONS,
} from '@/lib/store';
import { AuditLogItem, CommunityReport, Organization, OrganizationMember, OrganizationRole, OrganizationType, VerifiedCoolingLocation } from '@/lib/types';
import { ShieldCheck, Activity, Users, Database, Server, BarChart3, AlertCircle, Plus, Trash2, CheckCircle, ShieldAlert, Lock } from 'lucide-react';

export default function AdminPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'orgs' | 'reports' | 'cooling' | 'audit' | 'ml'>('orgs');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [coolingLocs, setCoolingLocs] = useState<VerifiedCoolingLocation[]>(VERIFIED_COOLING_LOCATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

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
    // Admin access is restricted to platform admins and organization admins only.
    // school/worksite/ngo roles have dedicated portals and must NOT access platform admin.
    const authorized = isAdminAuthorized(profile.role);
    setIsAdmin(authorized);

    if (authorized) {
      setOrganizations(getOrganizations());
      setMembers(getOrganizationMembers());
      setAuditLogs(getAuditLogs());

      fetchCommunityReportsFromSupabase().then((reps) => {
        setReports(reps);
      });
    }
  }, [profile]);

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
        <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <div className="flex-1 flex">
          <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
          <main className="flex-1 p-6 max-w-3xl mx-auto w-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-rose-100 text-rose-800 rounded-full">
              <Lock className="w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">ACCESS RESTRICTED</h1>
            <p className="text-xs text-slate-600 font-mono max-w-md">
              Administrative Console access requires Super Admin or Organization Administrator privileges. Current Role: <span className="font-bold uppercase text-rose-700">{profile.role}</span>.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 text-purple-900 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">PLATFORM ADMIN CONSOLE</h1>
                <p className="text-xs text-slate-500 font-mono">
                  Organization Management, Incident Moderation, System Audit Logs & ML Benchmark
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-50 text-purple-900 rounded border border-purple-200">
              SUPER ADMIN MODE
            </span>
          </div>

          {actionNotice && (
            <div className="p-4 bg-slate-800 text-white rounded-xl text-xs font-mono flex items-center justify-between">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs font-mono font-bold">
            {[
              { id: 'orgs', label: 'ORGANIZATIONS & USERS' },
              { id: 'reports', label: 'COMMUNITY MODERATION' },
              { id: 'cooling', label: 'VERIFIED COOLING SPOTS' },
              { id: 'audit', label: 'SYSTEM AUDIT LOGS' },
              { id: 'ml', label: 'ML MODEL BENCHMARK' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
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
              <form onSubmit={handleCreateOrg} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 font-mono text-xs">
                <h3 className="font-bold text-slate-700 uppercase">CREATE NEW ORGANIZATION</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Organization Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City High School"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Type *</label>
                    <select
                      value={newOrgType}
                      onChange={(e) => setNewOrgType(e.target.value as OrganizationType)}
                      className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-slate-900 focus:outline-none"
                    >
                      <option value="school">School</option>
                      <option value="worksite">Worksite</option>
                      <option value="ngo">NGO Relief</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Locality / Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Egmore, Chennai"
                      value={newOrgLocality}
                      onChange={(e) => setNewOrgLocality(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-slate-900 focus:outline-none"
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
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">ACTIVE ORGANIZATIONS ({organizations.length})</h3>

                {organizations.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl text-center text-xs font-mono text-slate-500">
                    No active organizations provisioned.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left border">
                      <thead className="bg-slate-50 text-slate-600 border-b">
                        <tr>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Locality</th>
                          <th className="p-2.5">Members</th>
                          <th className="p-2.5">Created At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-800">
                        {organizations.map((org) => (
                          <tr key={org.id} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400">{org.id}</td>
                            <td className="p-2.5 font-bold text-slate-900">{org.name}</td>
                            <td className="p-2.5 font-bold uppercase text-purple-700">{org.type}</td>
                            <td className="p-2.5 text-slate-600">{org.locality || 'Chennai'}</td>
                            <td className="p-2.5 font-bold">{org.member_count}</td>
                            <td className="p-2.5 text-slate-400">{new Date(org.created_at).toLocaleDateString()}</td>
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
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">COMMUNITY INCIDENT MODERATION</h3>

              {reports.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl text-center text-xs font-mono text-slate-500">
                  No community reports available for moderation.
                </div>
              ) : (
                <div className="space-y-3 font-sans text-xs">
                  {reports.map((rep) => (
                    <div key={rep.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 uppercase">{rep.category.replace('_', ' ')}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">📍 {rep.location.name}</span>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-bold">{rep.status}</span>
                        </div>
                        <p className="text-slate-700">{rep.description}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteReport(rep.id)}
                        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 font-mono font-bold text-xs rounded-lg flex items-center gap-1 transition shrink-0"
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
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">VERIFIED PUBLIC COOLING REGISTRY ({coolingLocs.length})</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coolingLocs.map((loc) => (
                  <div key={loc.id} className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 font-mono text-xs">
                    <div className="font-bold text-emerald-950 text-sm">✓ {loc.name}</div>
                    <p className="text-slate-700 font-sans text-xs">📍 {loc.address}</p>
                    <div className="text-[11px] text-emerald-800 pt-2 border-t border-emerald-200 flex justify-between">
                      <span>🕒 {loc.operating_hours}</span>
                      <span className="font-bold text-emerald-700">VERIFIED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: System Audit Logs */}
          {activeTab === 'audit' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">SYSTEM SECURITY & ISOLATION AUDIT LOGS ({auditLogs.length})</h3>

              {auditLogs.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl text-center text-xs font-mono text-slate-500">
                  No system audit logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2 text-xs font-mono text-slate-700">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 mr-2">[{log.action}]</span>
                        <span className="text-slate-600">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: ML Benchmark */}
          {activeTab === 'ml' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">MACHINE LEARNING MODEL BENCHMARK</h3>
                  <span className="text-xs font-mono text-slate-700">Selected Model: {mlMetrics.best_model} ({mlMetrics.model_version})</span>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 bg-amber-50 text-amber-900 rounded border border-amber-200 font-bold">
                  {mlMetrics.notice}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <div className="text-xs text-slate-500">ACCURACY</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{(mlMetrics.metrics.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <div className="text-xs text-slate-500">PRECISION</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{(mlMetrics.metrics.precision * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <div className="text-xs text-slate-500">RECALL</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{(mlMetrics.metrics.recall * 100).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <div className="text-xs text-slate-500">MACRO F1</div>
                  <div className="text-xl font-bold text-purple-700 mt-1">{(mlMetrics.metrics.macro_f1 * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

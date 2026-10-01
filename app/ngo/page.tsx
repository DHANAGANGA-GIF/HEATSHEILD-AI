'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchCommunityReportsFromSupabase, getCommunityReports, getUserProfile, VERIFIED_COOLING_LOCATIONS } from '@/lib/store';
import { getOrganizations, logAuditEvent } from '@/lib/organization-service';
import { CommunityReport, Organization, VerifiedCoolingLocation } from '@/lib/types';
import { HeartHandshake, MapPin, ShieldCheck, AlertTriangle, CheckCircle, ThumbsUp, Filter, Info, Eye } from 'lucide-react';
import Link from 'next/link';

export default function NGOPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [organizations] = useState<Organization[]>(getOrganizations().filter((o) => o.type === 'ngo'));
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(organizations[0] || null);

  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [coolingLocs] = useState<VerifiedCoolingLocation[]>(VERIFIED_COOLING_LOCATIONS);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const list = await fetchCommunityReportsFromSupabase();
      setReports(list);
    }
    loadData();
  }, []);

  const handleUpdateStatus = (reportId: string, newStatus: 'UNDER_REVIEW' | 'VERIFIED' | 'RESOLVED') => {
    const updated = reports.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r));
    setReports(updated);
    logAuditEvent('NGO_MODERATE_REPORT', { reportId, newStatus }, profile.id, selectedOrg?.id);
    setActionNotice(`Report status updated to ${newStatus}`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const filteredReports = filterCategory === 'all' ? reports : reports.filter((r) => r.category === filterCategory);
  const waterAccessCount = reports.filter((r) => r.category === 'water_access').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-950/60 text-rose-400 border border-rose-800/60 rounded-xl">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">NGO VULNERABILITY & ASSISTANCE PORTAL</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Community Vulnerability Hotspots, Water Point Tracking & Emergency Relief Workflow
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              {organizations.length > 0 && (
                <select
                  value={selectedOrg?.id}
                  onChange={(e) => {
                    const found = organizations.find((o) => o.id === e.target.value);
                    if (found) setSelectedOrg(found);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="px-3 py-1.5 bg-rose-950/60 text-rose-300 font-bold rounded border border-rose-800/80">
                NGO LEADER MODE
              </span>
            </div>
          </div>

          {/* Data Classification Bar */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-400 uppercase">CLASSIFICATION:</span>
              <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 border border-blue-800/60 rounded font-bold">
                LIVE ENVIRONMENTAL DATA
              </span>
              <span className="px-2 py-0.5 bg-purple-950/60 text-purple-400 border border-purple-800/60 rounded font-bold">
                ESTIMATED RISK
              </span>
              <span className="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded font-bold">
                COMMUNITY REPORT
              </span>
              <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 rounded font-bold">
                VERIFIED LOCATION
              </span>
            </div>

            <Link href="/community/map" className="text-emerald-400 hover:underline font-bold">
              Open Full Map →
            </Link>
          </div>

          {actionNotice && (
            <div className="p-4 bg-slate-950 text-slate-200 border border-slate-800 rounded-xl text-xs font-mono flex items-center justify-between">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 shadow-xs font-mono">
              <div className="text-xs text-slate-400">ACTIVE COMMUNITY REPORTS</div>
              <div className="text-3xl font-extrabold text-slate-100 mt-1">{reports.length}</div>
              <span className="text-[11px] text-emerald-400 font-sans mt-1 block">Crowdsourced observations</span>
            </div>

            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 shadow-xs font-mono">
              <div className="text-xs text-slate-400">WATER ACCESS HAZARDS</div>
              <div className="text-3xl font-extrabold text-blue-400 mt-1">{waterAccessCount}</div>
              <span className="text-[11px] text-blue-400 font-sans mt-1 block">Priority relief targets</span>
            </div>

            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 shadow-xs font-mono">
              <div className="text-xs text-slate-400">VERIFIED PUBLIC STATIONS</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">{coolingLocs.length}</div>
              <span className="text-[11px] text-emerald-400 font-sans mt-1 block">Cooling & hydration points</span>
            </div>
          </div>

          {/* Reports Moderation & Relief Dispatch */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">COMMUNITY ASSISTANCE & REPORT REVIEW WORKFLOW</h3>

              <div className="flex items-center gap-2 text-xs font-mono">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-950 text-slate-200 rounded-lg border border-slate-800 px-2.5 py-1 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Categories</option>
                  <option value="water_access">Water Access</option>
                  <option value="shade_cooling">Shade & Cooling</option>
                  <option value="outdoor_heat">Outdoor Heat</option>
                  <option value="public_space">Public Space</option>
                </select>
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-400">
                No unresolved community reports available in target relief area.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((rep) => (
                  <div key={rep.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-bold text-slate-100 uppercase">{rep.category.replace('_', ' ')}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">📍 {rep.location.name}</span>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          rep.status === 'VERIFIED' || rep.status === 'RESOLVED'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : rep.status === 'UNDER_REVIEW'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                            : 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-sans">{rep.description}</p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
                      <span className="text-[11px] text-slate-500">
                        Submitted: {new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Moderation actions */}
                      <div className="flex items-center gap-2">
                        {rep.status !== 'UNDER_REVIEW' && (
                          <button
                            onClick={() => handleUpdateStatus(rep.id, 'UNDER_REVIEW')}
                            className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-semibold rounded text-[11px] transition"
                          >
                            Mark Reviewing
                          </button>
                        )}
                        {rep.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleUpdateStatus(rep.id, 'RESOLVED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[11px] transition"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Data Integrity Notice: Community reports represent crowdsourced observations. Synthetic population numbers or fake incident stats are prohibited.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

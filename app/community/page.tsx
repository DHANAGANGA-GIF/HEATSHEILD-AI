'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  deleteCommunityReport,
  fetchCommunityReportsFromSupabase,
  getCommunityReports,
  getUserProfile,
  VERIFIED_COOLING_LOCATIONS,
  canUserModifyReport,
  filterCommunityReports,
} from '@/lib/store';
import { detectCommunityClusters } from '@/lib/cluster-detector';
import { CommunityCluster, CommunityReport, VerifiedCoolingLocation } from '@/lib/types';
import Link from 'next/link';
import { Users, MapPin, Plus, AlertTriangle, CheckCircle, ThumbsUp, ShieldCheck, Trash2, Filter, Info } from 'lucide-react';

export default function CommunityPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [clusters, setClusters] = useState<CommunityCluster[]>([]);
  const [coolingLocs] = useState<VerifiedCoolingLocation[]>(VERIFIED_COOLING_LOCATIONS);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const list = await fetchCommunityReportsFromSupabase();
      setReports(list);
      setClusters(detectCommunityClusters(list));
    }
    loadData();
  }, []);

  const handleDelete = async (reportId: string) => {
    const res = await deleteCommunityReport(profile.id, reportId);
    if (res.success) {
      const updated = reports.filter((r) => r.id !== reportId);
      setReports(updated);
      setClusters(detectCommunityClusters(updated));
      setActionMessage('Report removed successfully.');
      setTimeout(() => setActionMessage(null), 3000);
    } else {
      setActionMessage(res.error || 'Failed to delete report.');
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const filteredReports = filterCommunityReports(reports, {
    category: categoryFilter,
    status: statusFilter,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-400" />
                COMMUNITY HEAT HUB
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Crowdsourced heat hazard reports, cooling point verification, & spatial cluster detection
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/community/map"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition border border-slate-700"
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Open Community Map</span>
              </Link>
              <Link
                href="/community/report"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Report Heat Issue</span>
              </Link>
            </div>
          </div>

          {/* Data Classification Banner */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase mb-2">
              DATA CLASSIFICATION & SOURCE LEGEND
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-blue-950/60 border border-blue-800/60 rounded-lg">
                <span className="font-bold text-blue-300 block">LIVE ENVIRONMENTAL</span>
                <span className="text-[11px] text-blue-400">Open-Meteo Weather Stream</span>
              </div>
              <div className="p-2.5 bg-purple-950/60 border border-purple-800/60 rounded-lg">
                <span className="font-bold text-purple-300 block">ESTIMATED RISK</span>
                <span className="text-[11px] text-purple-400">Rule-Based Heat Engine</span>
              </div>
              <div className="p-2.5 bg-amber-950/60 border border-amber-800/60 rounded-lg">
                <span className="font-bold text-amber-300 block">COMMUNITY REPORT</span>
                <span className="text-[11px] text-amber-400">Crowdsourced Observation</span>
              </div>
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/60 rounded-lg">
                <span className="font-bold text-emerald-300 block">VERIFIED LOCATION</span>
                <span className="text-[11px] text-emerald-400">Public Shelter / Fountain</span>
              </div>
            </div>
          </div>

          {/* Action Notification */}
          {actionMessage && (
            <div className="p-4 bg-slate-950 text-slate-200 border border-slate-800 rounded-xl text-xs font-mono flex items-center justify-between">
              <span>{actionMessage}</span>
              <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Cluster Warning Banner if detected */}
          {clusters.length > 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>POTENTIAL COMMUNITY CLUSTER DETECTED ({clusters.length})</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Multiple nearby reports indicate potential water access or cooling issues requiring attention near Central Metro / Anna Salai.
              </p>
            </div>
          )}

          {/* Verified Cooling & Hydration Points Section */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                VERIFIED PUBLIC COOLING & HYDRATION STATIONS
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded font-bold border border-emerald-800/80">
                OFFICIALLY VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {coolingLocs.map((loc) => (
                <div key={loc.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      ✓ {loc.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">📍 {loc.address}</p>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                    <span>🕒 {loc.operating_hours}</span>
                    <span className="font-bold text-emerald-400">Verified</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reports Grid with Filter Controls */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase">
                RECENT COMMUNITY REPORTS ({filteredReports.length})
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg border border-slate-800 px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Categories</option>
                  <option value="water_access">Water Access</option>
                  <option value="shade_cooling">Shade & Cooling</option>
                  <option value="outdoor_heat">Outdoor Heat</option>
                  <option value="cooling_facility">Cooling Facility</option>
                  <option value="unsafe_condition">Unsafe Condition</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="public_space">Public Space</option>
                  <option value="other">Other</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg border border-slate-800 px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <p className="text-xs text-slate-400 font-mono">No community reports match selected filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReports.map((rep) => {
                  const isOwner = canUserModifyReport(profile.id, rep);
                  return (
                    <div key={rep.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-100 font-mono uppercase">
                            {rep.category.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                rep.status === 'VERIFIED' || rep.status === 'RESOLVED'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                  : rep.status === 'UNDER_REVIEW' || rep.status === 'REVIEWED'
                                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                  : 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                              }`}
                            >
                              {rep.status}
                            </span>
                            {isOwner && (
                              <button
                                onClick={() => handleDelete(rep.id)}
                                title="Delete your report"
                                className="text-slate-400 hover:text-rose-400 transition p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{rep.description}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>📍 {rep.location.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-normal">
                            {new Date(rep.timestamp).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 text-slate-300 font-bold">
                            <ThumbsUp className="w-3 h-3 text-emerald-400" /> {rep.votes_count || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Disclaimer: Community reports are user-generated observations. They do not constitute official scientific weather observations or medical advice.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

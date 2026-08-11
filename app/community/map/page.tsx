'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { LeafletMap } from '@/components/LeafletMap';
import {
  fetchCommunityReportsFromSupabase,
  filterCommunityReports,
  getUserProfile,
  VERIFIED_COOLING_LOCATIONS,
} from '@/lib/store';
import { detectCommunityClusters } from '@/lib/cluster-detector';
import { CommunityCluster, CommunityReport, LocationData } from '@/lib/types';
import { MapPin, Filter, AlertTriangle, ShieldCheck, Info, Compass } from 'lucide-react';
import Link from 'next/link';

export default function CommunityMapPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [clusters, setClusters] = useState<CommunityCluster[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '24h' | '7d'>('all');
  const [nearbyRadius, setNearbyRadius] = useState<number>(0); // 0 means all

  const [userLoc, setUserLoc] = useState<LocationData>({
    name: 'Chennai',
    latitude: 13.0827,
    longitude: 80.2707,
  });

  useEffect(() => {
    const p = getUserProfile();
    if (p.location && typeof p.location.latitude === 'number' && typeof p.location.longitude === 'number') {
      setUserLoc(p.location);
    }

    async function loadReports() {
      const list = await fetchCommunityReportsFromSupabase();
      setReports(list);
      setClusters(detectCommunityClusters(list));
    }

    loadReports();
  }, []);

  const filteredReports = filterCommunityReports(reports, {
    category: categoryFilter,
    status: statusFilter,
    severity: severityFilter,
    timeframe: timeframeFilter,
    userLocation: nearbyRadius > 0 ? userLoc : undefined,
    nearbyRadiusKm: nearbyRadius > 0 ? nearbyRadius : undefined,
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <MapPin className="w-5 h-5" />
                <h1 className="text-xl font-bold text-slate-900">COMMUNITY MAP & CLUSTER MONITOR</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                Spatial Heat Hazard Markers, Verified Cooling Centers, & Real-time Spatial Cluster Heatmaps
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/community"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition border border-slate-300"
              >
                <span>Community List View</span>
              </Link>
              <Link
                href="/community/report"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
              >
                <span>+ Report Issue</span>
              </Link>
            </div>
          </div>

          {/* Data Classification Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-slate-500 uppercase">CLASSIFICATION:</span>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded font-bold">
                LIVE ENVIRONMENTAL DATA
              </span>
              <span className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded font-bold">
                ML RISK ESTIMATE
              </span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                COMMUNITY REPORT
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                VERIFIED LOCATION
              </span>
            </div>

            <div className="text-slate-400 text-[11px]">
              Center: {userLoc.name} ({userLoc.latitude.toFixed(2)}°, {userLoc.longitude.toFixed(2)}°)
            </div>
          </div>

          {/* Interactive Filters Panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-700 uppercase">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>MAP FILTERS & RADIUS CONTROLS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {/* Category Filter */}
              <div>
                <label className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:outline-none"
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
              </div>

              {/* Status Filter */}
              <div>
                <label className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Timeframe Filter */}
              <div>
                <label className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Timeframe</label>
                <select
                  value={timeframeFilter}
                  onChange={(e) => setTimeframeFilter(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="24h">Past 24 Hours</option>
                  <option value="7d">Past 7 Days</option>
                </select>
              </div>

              {/* Nearby Radius */}
              <div>
                <label className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Nearby Radius</label>
                <select
                  value={nearbyRadius}
                  onChange={(e) => setNearbyRadius(Number(e.target.value))}
                  className="w-full bg-slate-50 text-slate-800 rounded-lg border border-slate-300 px-2.5 py-1.5 focus:outline-none"
                >
                  <option value={0}>Entire Map</option>
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                  <option value={25}>Within 25 km</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 flex-wrap gap-2">
              <span>
                Showing <strong>{filteredReports.length}</strong> Community Reports |{' '}
                <strong>{VERIFIED_COOLING_LOCATIONS.length}</strong> Verified Public Stations |{' '}
                <strong>{clusters.length}</strong> Spatial Cluster Highlights
              </span>
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                USER OBSERVATIONS UNVERIFIED SCIENTIFICALLY
              </span>
            </div>

            <LeafletMap
              center={userLoc}
              reports={filteredReports}
              clusters={clusters}
              coolingLocations={VERIFIED_COOLING_LOCATIONS}
              height="550px"
            />
          </div>

          {/* Privacy & Moderation Notice */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>PRIVACY & DATA INTEGRITY POLICY</span>
            </div>
            <p className="leading-relaxed">
              Exact residential locations are protected. Community reports represent crowdsourced user observations and do not alter official meteorological streams or ML risk assessments.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

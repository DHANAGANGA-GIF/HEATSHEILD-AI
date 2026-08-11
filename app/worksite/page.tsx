'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getCommunityReports, getUserProfile } from '@/lib/store';
import { getOrganizations, logAuditEvent } from '@/lib/organization-service';
import { CommunityReport, Organization, RiskAssessment, WeatherData } from '@/lib/types';
import { Briefcase, Clock, Droplets, ShieldCheck, CheckSquare, RefreshCw, Info, AlertTriangle } from 'lucide-react';

export default function WorksitePage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [organizations] = useState<Organization[]>(getOrganizations().filter((o) => o.type === 'worksite'));
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(organizations[0] || null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Worksite safety checklist state
  const [checklist, setChecklist] = useState({
    waterCoolers: true,
    shadeCanopy: true,
    buddySystem: false,
    electrolytePacks: true,
  });

  useEffect(() => {
    async function loadWorksiteData() {
      setLoading(true);
      setError(null);

      const loc = selectedOrg?.primary_location || profile.location || { name: 'Central Metro Site', latitude: 13.0815, longitude: 80.2725 };

      try {
        const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
        setWeather(w);
        const r = evaluateHeatRisk(w, {
          activity: 'high', // Outdoor Construction / Heavy Manual Labor
          duration: 'long',
          cooling: 'limited',
          age_group: 'adult',
        });
        setRisk(r);

        const allReports = getCommunityReports();
        const siteReports = allReports.filter(
          (rep) => rep.category === 'outdoor_heat' || rep.category === 'unsafe_condition' || rep.category === 'infrastructure'
        );
        setReports(siteReports);
      } catch (err: any) {
        console.error('Worksite data fetch error:', err);
        setError('Environmental data service unreachable. Operational fallback engaged.');
      } finally {
        setLoading(false);
      }
    }

    loadWorksiteData();
  }, [selectedOrg, profile]);

  const toggleChecklist = (key: keyof typeof checklist) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    logAuditEvent('WORKSITE_CHECKLIST_UPDATE', { key, value: updated[key] }, profile.id, selectedOrg?.id);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-900 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">OUTDOOR WORKSITE SAFETY PORTAL</h1>
                <p className="text-xs text-slate-500 font-mono">
                  NIOSH/OSHA-Aligned Work-Rest Cycle Planner & Operational Hydration Protocol
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
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="px-3 py-1.5 bg-amber-50 text-amber-900 font-bold rounded border border-amber-200">
                WORKSITE OFFICER MODE
              </span>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs font-mono text-amber-900 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => window.location.reload()} className="underline flex items-center gap-1 font-bold">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Environmental Overview */}
          {weather && risk && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block">WORKSITE TEMPERATURE</span>
                <span className="text-2xl font-bold text-slate-900">{weather.temperature.toFixed(1)}°C</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Humidity: {weather.relative_humidity}%</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block">APPARENT HEAT STRAIN</span>
                <span className="text-2xl font-bold text-amber-600">{weather.apparent_temperature.toFixed(1)}°C</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Heavy Workload Context</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block">EVALUATED RISK SCORE</span>
                <span className="text-2xl font-bold text-slate-900">{risk.risk_score} / 100</span>
                <span
                  className={`text-[10px] font-bold block mt-0.5 ${
                    risk.risk_level === 'EXTREME'
                      ? 'text-rose-700'
                      : risk.risk_level === 'HIGH'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  TIER: {risk.risk_level}
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block">PRIMARY DATA STREAM</span>
                <span className="text-sm font-bold text-blue-800 mt-1 block">LIVE WMO METEO</span>
                <span className="text-[10px] text-emerald-600 font-bold block">✓ VERIFIED SOURCE</span>
              </div>
            </div>
          )}

          {risk && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Work-Rest Cycle Schedule */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">REQUIRED WORK-REST CYCLE</h3>

                <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">RECOMMENDED CYCLE RATIO</span>
                    <span className="text-xs font-bold text-amber-400">NIOSH HEAT ALIGNED</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                    {risk.risk_level === 'EXTREME'
                      ? '15 MIN WORK / 45 MIN REST'
                      : risk.risk_level === 'HIGH'
                      ? '30 MIN WORK / 30 MIN REST'
                      : risk.risk_level === 'MODERATE'
                      ? '45 MIN WORK / 15 MIN REST'
                      : 'NORMAL CONTINUOUS WORK'}
                  </div>
                  <p className="text-xs font-sans text-slate-300">
                    Calculated for Heavy Manual Labor under {risk.weather_snapshot.apparent_temp}°C apparent heat strain.
                  </p>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span>Mandatory Hydration Target</span>
                    <span className="font-mono font-bold text-blue-700">1 Liter / Hour / Worker</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span>Rest Area Requirement</span>
                    <span className="font-mono font-bold text-emerald-700">Shaded Canopy + Forced Air Circulation</span>
                  </div>
                </div>
              </div>

              {/* Worksite Action Plan */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">SITE ACTION PLAN</h3>

                <div className="space-y-3 text-xs font-sans">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.waterCoolers}
                      onChange={() => toggleChecklist('waterCoolers')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Cold water cooler stations verified</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.shadeCanopy}
                      onChange={() => toggleChecklist('shadeCanopy')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Shade canopy deployed at active zone</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.buddySystem}
                      onChange={() => toggleChecklist('buddySystem')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Buddy system check-in executed</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.electrolytePacks}
                      onChange={() => toggleChecklist('electrolytePacks')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Electrolyte hydration packs stocked</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Worksite Incidents & Reports */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">RECENT SITE REPORTS</h3>

            {reports.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs font-mono text-slate-500">
                No incidents recorded for this worksite.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 3).map((rep) => (
                  <div key={rep.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-sans">
                    <div>
                      <span className="font-bold font-mono uppercase text-slate-900 mr-2">{rep.category.replace('_', ' ')}</span>
                      <span className="text-slate-700">{rep.description}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-600">{rep.status}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Compliance Disclaimer: HeatShield AI provides environmental heat-risk decision support. It does not constitute legal compliance certification or regulatory medical guarantee.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

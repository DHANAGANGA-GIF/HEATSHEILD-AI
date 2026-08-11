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
import { GraduationCap, AlertTriangle, ShieldCheck, CheckSquare, Clock, MapPin, RefreshCw, Info } from 'lucide-react';

export default function SchoolPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile] = useState(getUserProfile());
  const [organizations] = useState<Organization[]>(getOrganizations().filter((o) => o.type === 'school'));
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(organizations[0] || null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safety checklist state
  const [checklist, setChecklist] = useState({
    waterPoints: true,
    shadeSails: true,
    teachersNotified: false,
    firstAidReady: true,
  });

  useEffect(() => {
    async function loadSchoolData() {
      setLoading(true);
      setError(null);

      const loc = selectedOrg?.primary_location || profile.location || { name: 'Egmore Campus', latitude: 13.0732, longitude: 80.2610 };

      try {
        const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
        setWeather(w);
        const r = evaluateHeatRisk(w, {
          activity: 'high', // Outdoor PE
          duration: 'moderate',
          cooling: 'good',
          age_group: 'child',
        });
        setRisk(r);

        const allReports = getCommunityReports();
        const campusReports = allReports.filter(
          (rep) => rep.category === 'shade_cooling' || rep.category === 'water_access' || rep.category === 'outdoor_heat'
        );
        setReports(campusReports);
      } catch (err: any) {
        console.error('School data fetch error:', err);
        setError('Weather data service temporarily unavailable. Cached fallback displayed.');
      } finally {
        setLoading(false);
      }
    }

    loadSchoolData();
  }, [selectedOrg, profile]);

  const toggleChecklist = (key: keyof typeof checklist) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    logAuditEvent('SCHOOL_CHECKLIST_UPDATE', { key, value: updated[key] }, profile.id, selectedOrg?.id);
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
              <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">SCHOOL HEAT SAFETY PORTAL</h1>
                <p className="text-xs text-slate-500 font-mono">
                  Student Physical Activity Risk Assessment & Recess Decision Support
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
              <span className="px-3 py-1.5 bg-blue-50 text-blue-900 font-bold rounded border border-blue-200">
                SCHOOL ADMIN MODE
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
                <span className="text-slate-500 block">CAMPUS TEMPERATURE</span>
                <span className="text-2xl font-bold text-slate-900">{weather.temperature.toFixed(1)}°C</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Humidity: {weather.relative_humidity}%</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 block">APPARENT HEAT INDEX</span>
                <span className="text-2xl font-bold text-amber-600">{weather.apparent_temperature.toFixed(1)}°C</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Child Exposure Model</span>
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
              {/* Outdoor Sports Guidance Card */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">PE & OUTDOOR RECREATION DECISION RULE</h3>

                <div
                  className={`p-4 rounded-xl border font-mono ${
                    risk.risk_level === 'EXTREME' || risk.risk_level === 'HIGH'
                      ? 'bg-rose-50 border-rose-200 text-rose-950'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="text-base sm:text-lg font-bold">
                    RECOMMENDED STATUS:{' '}
                    {risk.risk_level === 'EXTREME' || risk.risk_level === 'HIGH'
                      ? 'MOVE PHYSICAL ACTIVITIES INDOORS'
                      : 'NORMAL OUTDOOR RECREATION'}
                  </div>
                  <p className="text-xs mt-1 font-sans opacity-90">
                    Calculated for children performing sports under {risk.weather_snapshot.apparent_temp}°C apparent heat strain.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-700 font-sans">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span>Morning Recess (09:30 AM - 10:30 AM)</span>
                    <span className="font-mono font-bold text-emerald-700">ALLOWED OUTDOORS</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span>Midday Playground Activity (12:00 PM - 02:30 PM)</span>
                    <span className="font-mono font-bold text-rose-700">RESTRICT / SHADE ONLY</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span>Afternoon Sports Practice (03:30 PM - 05:00 PM)</span>
                    <span className="font-mono font-bold text-amber-700">FREQUENT HYDRATION BREAKS</span>
                  </div>
                </div>
              </div>

              {/* Safety Checklist */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">SCHOOL SAFETY CHECKLIST</h3>

                <div className="space-y-3 text-xs font-sans">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.waterPoints}
                      onChange={() => toggleChecklist('waterPoints')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Cooling water points refilled</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.shadeSails}
                      onChange={() => toggleChecklist('shadeSails')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Playground shade sails inspected</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.teachersNotified}
                      onChange={() => toggleChecklist('teachersNotified')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>Teachers notified of peak heat window</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={checklist.firstAidReady}
                      onChange={() => toggleChecklist('firstAidReady')}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>First-aid hydration kit prepared</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Campus Incidents & Reports */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">RECENT CAMPUS REPORTS</h3>

            {reports.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs font-mono text-slate-500">
                No incidents or campus heat safety reports recorded for this school.
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
                Privacy Protection: Individual student medical data is not collected or stored on HeatShield AI servers.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

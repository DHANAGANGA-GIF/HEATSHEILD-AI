'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { HeatGauge } from '@/components/HeatGauge';
import { WeatherCard } from '@/components/WeatherCard';
import { RiskDrivers } from '@/components/RiskDrivers';
import { GuidanceList } from '@/components/GuidanceList';
import { AiAssistant } from '@/components/AiAssistant';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile } from '@/lib/store';
import { RiskAssessment, TechMode, WeatherData } from '@/lib/types';
import Link from 'next/link';
import { Clock, Sliders, MessageSquare, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

export default function DashboardPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [techMode, setTechMode] = useState<TechMode>('technical');
  const [profile, setProfile] = useState(getUserProfile());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);

  const loadDashboardData = async () => {
    setLoading(true);
    const p = getUserProfile();
    setProfile(p);

    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    const wData = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
    setWeather(wData);

    const rData = evaluateHeatRisk(wData, {
      activity: p.activity_level,
      duration: p.exposure_duration,
      cooling: p.cooling_access,
      age_group: p.age_group,
    });
    setRisk(rData);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        techMode={techMode}
        onToggleTechMode={setTechMode}
      />

      <div className="flex-1 flex">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Dashboard Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                OPERATIONAL HEAT RISK DASHBOARD
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                Contextual Heat Strain Model for {profile.name || 'User'} ({profile.role.toUpperCase()} MODE)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/timeline"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Forecast Timeline</span>
              </Link>
              <button
                onClick={() => setShowAssistant(!showAssistant)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showAssistant ? 'Hide AI Assistant' : 'Ask AI Assistant'}</span>
                {showAssistant ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Embedded AI Assistant (when toggled on Dashboard) */}
          {showAssistant && (
            <div className="h-[480px]">
              <AiAssistant
                weather={weather}
                risk={risk}
                mode={techMode}
                onModeChange={setTechMode}
              />
            </div>
          )}

          {loading || !weather || !risk ? (
            <div className="p-12 bg-white rounded-xl border border-slate-200 text-center font-mono text-xs text-slate-500 animate-pulse">
              Fetching real-time environmental data & computing heat risk factors...
            </div>
          ) : (
            <>
              {/* Primary Gauge */}
              <HeatGauge
                score={risk.risk_score}
                level={risk.risk_level}
                lastUpdated={new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                dataQuality={risk.data_quality}
              />

              {/* Grid: Current Weather & Explainable Factors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeatherCard
                  weather={weather}
                  onRefresh={loadDashboardData}
                  isLoading={loading}
                />
                <RiskDrivers
                  factors={risk.factors}
                  mode={techMode}
                  onToggleMode={setTechMode}
                />
              </div>

              {/* Personalized Guidance */}
              <GuidanceList
                guidance={risk.recommendations}
                mode={techMode}
              />

              {/* Quick Actions & Shortcut Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <Link
                  href="/simulator"
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-700">WHAT-IF SIMULATOR</span>
                    <Sliders className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500">Test different activity, exposure, or cooling scenarios.</p>
                </Link>

                <Link
                  href="/community/map"
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-700">COMMUNITY MAP</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500">View water points, shade reports, and cluster hotspots.</p>
                </Link>

                <Link
                  href="/reports"
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-700">AUDIT REPORTS</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500">Export CSV or PDF heat audit logs for compliance.</p>
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

'use client';

export const dynamic = 'force-dynamic';


import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile } from '@/lib/store';
import { RiskAssessment, WeatherData } from '@/lib/types';
import { Flame, ShieldCheck, Info, BarChart } from 'lucide-react';

export default function RiskPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);

  useEffect(() => {
    const p = getUserProfile();
    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    fetchWeatherData(loc.latitude, loc.longitude, loc.name).then((w) => {
      setWeather(w);
      setRisk(evaluateHeatRisk(w, {
        activity: p.activity_level,
        duration: p.exposure_duration,
        cooling: p.cooling_access,
        age_group: p.age_group,
      }));
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Flame className="w-5 h-5" />
              <h1 className="text-xl font-bold text-slate-900">HEAT RISK METHODOLOGY & FACTOR ANALYSIS</h1>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              In-depth breakdown of Steadman equations, humidity adjustments, and contextual workload multipliers
            </p>
          </div>

          {risk && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">STEADMAN HEAT INDEX CALCULATION</h3>
                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    Heat Index (HI) measures perceived temperature derived from combined dry-bulb temperature (T) and relative humidity (RH).
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]">
                    HI = -42.379 + 2.049*T + 10.143*RH - 0.224*T*RH - ...
                  </div>
                  <p>
                    Current Observed Ambient Temp: <strong>{risk.weather_snapshot.temp}Â°C</strong><br />
                    Current Relative Humidity: <strong>{risk.weather_snapshot.humidity}%</strong><br />
                    Resulting Apparent Temperature: <strong>{risk.weather_snapshot.apparent_temp}Â°C</strong>
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">CONTEXTUAL WORKLOAD & RECOVERY</h3>
                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    Physical workload increases internal metabolic heat generation, magnifying environmental risk.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                    <li>Activity Level: {risk.context_snapshot.activity.toUpperCase()}</li>
                    <li>Exposure Duration: {risk.context_snapshot.duration.toUpperCase()}</li>
                    <li>Cooling Access: {risk.context_snapshot.cooling.toUpperCase()}</li>
                    <li>Age Group: {risk.context_snapshot.age_group.toUpperCase()}</li>
                  </ul>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-semibold text-xs mt-2">
                    Evaluated Risk Score: {risk.risk_score} / 100 ({risk.risk_level})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Model Transparency & Disclaimer Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>MODEL TRANSPARENCY & DATA GOVERNANCE</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Model Version: <strong>{risk?.model_version || 'HeatShield-XAI v1.2'}</strong> | Data Source: <strong>{risk?.data_source || 'Open-Meteo API'}</strong>
            </p>
            <p className="text-xs text-slate-500 font-mono">
              Limitation: Local microclimates (e.g., radiant heat from unshaded asphalt, direct sunlight exposure) may cause localized temperatures to exceed regional meteorological readings.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

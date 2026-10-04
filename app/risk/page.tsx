'use client';

export const dynamic = 'force-dynamic';


import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile } from '@/lib/store';
import { Language, RiskAssessment, WeatherData } from '@/lib/types';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import { Flame, ShieldCheck, Info, BarChart, ArrowRight, BookOpen, FileCheck } from 'lucide-react';

export default function RiskPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [lang, setLang] = useState<Language>(() => getUserProfile().language || 'en');

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} lang={lang} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <Flame className="w-5 h-5" />
              <h1 className="text-xl font-bold text-slate-100">HEAT RISK METHODOLOGY & FACTOR ANALYSIS</h1>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              In-depth breakdown of Steadman equations, humidity adjustments, and contextual workload multipliers
            </p>
          </div>

          {risk && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">STEADMAN HEAT INDEX CALCULATION</h3>
                <div className="text-xs text-slate-300 leading-relaxed space-y-2">
                  <p>
                    Heat Index (HI) measures perceived temperature derived from combined dry-bulb temperature (T) and relative humidity (RH).
                  </p>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-emerald-400">
                    HI = -42.379 + 2.049*T + 10.143*RH - 0.224*T*RH - ...
                  </div>
                  <p className="text-slate-400">
                    Current Observed Ambient Temp: <strong className="text-slate-200">{risk.weather_snapshot.temp}°C</strong><br />
                    Current Relative Humidity: <strong className="text-slate-200">{risk.weather_snapshot.humidity}%</strong><br />
                    Resulting Apparent Temperature: <strong className="text-slate-200">{risk.weather_snapshot.apparent_temp}°C</strong>
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">CONTEXTUAL WORKLOAD & RECOVERY</h3>
                <div className="text-xs text-slate-300 leading-relaxed space-y-2">
                  <p>
                    Physical workload increases internal metabolic heat generation, magnifying environmental risk.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-slate-400">
                    <li>Activity Level: <span className="text-slate-200">{risk.context_snapshot.activity.toUpperCase()}</span></li>
                    <li>Exposure Duration: <span className="text-slate-200">{risk.context_snapshot.duration.toUpperCase()}</span></li>
                    <li>Cooling Access: <span className="text-slate-200">{risk.context_snapshot.cooling.toUpperCase()}</span></li>
                    <li>Age Group: <span className="text-slate-200">{risk.context_snapshot.age_group.toUpperCase()}</span></li>
                  </ul>
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded text-emerald-300 font-semibold text-xs mt-2">
                    Evaluated Risk Score: {risk.risk_score} / 100 ({risk.risk_level})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Directional XAI Attribution Breakdown */}
          {risk?.explanation && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-100">
                <BarChart className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold">DIRECTIONAL EXPLAINABLE AI (XAI) ATTRIBUTION</h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {risk.explanation.human_readable_summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>RISK ESCALATORS (+)</span>
                  </h4>
                  <div className="space-y-1.5">
                    {risk.explanation.escalating_factors.map((f, i) => (
                      <div key={i} className="text-xs flex justify-between items-center text-slate-300">
                        <span>{f.name}</span>
                        <span className="font-mono font-semibold text-amber-400">+{f.weight_percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>RISK MITIGATORS (-)</span>
                  </h4>
                  <div className="space-y-1.5">
                    {risk.explanation.mitigating_factors.length > 0 ? (
                      risk.explanation.mitigating_factors.map((f, i) => (
                        <div key={i} className="text-xs flex justify-between items-center text-slate-300">
                          <span>{f.name}</span>
                          <span className="font-mono font-semibold text-emerald-400">-{f.weight_percent}%</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No significant mitigating factors detected.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                <div className="font-bold text-slate-200">Operational Decision Support Recommendation:</div>
                <div className="text-slate-400">{risk.explanation.recommended_action}</div>
              </div>
            </div>
          )}

          {/* Model Transparency & Disclaimer Card */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>MODEL TRANSPARENCY & DATA GOVERNANCE</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Model Version: <strong className="text-slate-100">{risk?.model_version || 'Rule-Based Heat Risk Engine v1.3'}</strong> | Data Source: <strong className="text-slate-100">{risk?.data_source || 'Open-Meteo API'}</strong>
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Limitation: Local microclimates (e.g., radiant heat from unshaded asphalt, direct sunlight exposure) may cause localized temperatures to exceed regional meteorological readings.
            </p>
          </div>

          {/* Links to Full Methodology & Evidence */}
          <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                CSE-AIML Academic Review Resources
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore the formal mathematical derivations, interactive lab, and verification test matrices.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/methodology"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Full Methodology &amp; Math</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/evidence"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Verification Evidence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

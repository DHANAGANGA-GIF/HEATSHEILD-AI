'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AiAssistant } from '@/components/AiAssistant';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile } from '@/lib/store';
import { Language, RiskAssessment, TechMode, WeatherData } from '@/lib/types';
import { t } from '@/lib/i18n';
import { MessageSquare } from 'lucide-react';

export default function AssistantPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [techMode, setTechMode] = useState<TechMode>('technical');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>(() => getUserProfile().language || 'en');

  const loadData = () => {
    setLoading(true);
    const p = getUserProfile();
    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    fetchWeatherData(loc.latitude, loc.longitude, loc.name).then((w) => {
      setWeather(w);
      const r = evaluateHeatRisk(w, {
        activity: p.activity_level,
        duration: p.exposure_duration,
        cooling: p.cooling_access,
        age_group: p.age_group,
      });
      setRisk(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        techMode={techMode}
        onToggleTechMode={setTechMode}
      />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} lang={lang} />

        <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col h-[calc(100vh-4rem)]">
          {/* Header */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <div>
                <h1 className="text-base font-bold text-slate-100 uppercase">{t('assistant', lang)}</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Contextual Risk Explanation & Preventive Safety Guidance ({techMode.toUpperCase()} MODE)
                </p>
              </div>
            </div>

            <div className="text-[11px] font-mono bg-amber-950/40 text-amber-300 px-2.5 py-1 rounded border border-amber-800/60 font-semibold">
              Decision Support System • Not Medical Diagnosis
            </div>
          </div>

          {/* AI Assistant Component */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="h-full bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-slate-200">Loading environmental context...</p>
                <p className="text-xs text-slate-400">Retrieving live weather and risk data for the assistant.</p>
              </div>
            ) : !weather ? (
              <div className="h-full bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center p-8">
                <p className="text-sm font-semibold text-slate-200">We couldn&apos;t retrieve current weather data.</p>
                <p className="text-xs text-slate-400 max-w-xs">The assistant can still answer general heat safety questions. Contextual risk information will be unavailable.</p>
                <button onClick={loadData} className="mt-1 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition">{t('try_again', lang)}</button>
                <AiAssistant weather={null} risk={null} mode={techMode} onModeChange={setTechMode} lang={lang} />
              </div>
            ) : (
              <AiAssistant weather={weather} risk={risk} mode={techMode} onModeChange={setTechMode} lang={lang} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

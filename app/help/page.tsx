'use client';

export const dynamic = 'force-dynamic';


import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { HelpCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function HelpPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h1 className="text-xl font-bold text-slate-900">HELP CENTER & SAFETY GUIDELINES</h1>
            <p className="text-xs text-slate-500 font-mono">
              Heat safety protocols, system operation guides, & emergency referrals
            </p>
          </div>

          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-950 font-mono font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>EMERGENCY MEDICAL PROTOCOL</span>
            </div>
            <p className="text-xs text-rose-950 leading-relaxed font-sans">
              If someone presents severe hyperthermia signs (confusion, hot dry skin, cessation of sweating, fainting, or vomiting), call emergency services (108 / 112 / 911) immediately. HeatShield AI is decision support software and DOES NOT diagnose or treat illness.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">HEAT SAFETY FAQ & GUIDELINES</h3>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="font-bold text-slate-900 mb-1">What does the 0 - 100 Heat Risk Score mean?</h4>
                <p className="text-slate-600 leading-relaxed">
                  0-35 (LOW): Normal conditions. 36-60 (MODERATE): Elevated stress, take regular water breaks. 61-80 (HIGH): High strain, reduce heavy work. 81-100 (EXTREME): Critical heat hazard, avoid physical exposure.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="font-bold text-slate-900 mb-1">How often is Open-Meteo weather data updated?</h4>
                <p className="text-slate-600 leading-relaxed">
                  Weather observations are fetched in real-time and cached client-side for 15 minutes to optimize network requests and maintain offline operation.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

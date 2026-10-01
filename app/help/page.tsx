'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { HelpCircle, AlertTriangle, ShieldCheck, Phone } from 'lucide-react';

export default function HelpPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Help Center &amp; Safety Guidelines</h1>
              <p className="text-xs text-slate-400 font-mono">
                Heat safety protocols, system operation guides &amp; emergency referrals
              </p>
            </div>
          </div>

          {/* Emergency Protocol */}
          <div className="p-4 bg-rose-950/40 border border-rose-800/70 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-mono font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>EMERGENCY MEDICAL PROTOCOL</span>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed font-sans">
              If someone presents severe hyperthermia signs (confusion, hot dry skin, cessation of sweating, fainting, or vomiting), call emergency services (<strong>108 / 112 / 911</strong>) immediately. HeatShield AI is decision support software and DOES NOT diagnose or treat illness.
            </p>
          </div>

          {/* FAQ Card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-800">
              HEAT SAFETY FAQ &amp; GUIDELINES
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <h4 className="font-bold text-slate-100 mb-1.5">What does the 0–100 Heat Risk Score mean?</h4>
                <p className="text-slate-400 leading-relaxed">
                  <span className="text-emerald-400 font-bold">0–35 (LOW):</span> Normal conditions. &nbsp;
                  <span className="text-amber-400 font-bold">36–60 (MODERATE):</span> Elevated stress, take regular water breaks. &nbsp;
                  <span className="text-orange-400 font-bold">61–80 (HIGH):</span> High strain, reduce heavy outdoor work. &nbsp;
                  <span className="text-rose-400 font-bold">81–100 (EXTREME):</span> Critical heat hazard, avoid physical exposure.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <h4 className="font-bold text-slate-100 mb-1.5">How often is Open-Meteo weather data updated?</h4>
                <p className="text-slate-400 leading-relaxed">
                  Weather observations are fetched in real-time and cached client-side for 15 minutes to optimize network requests and maintain offline operation.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <h4 className="font-bold text-slate-100 mb-1.5">Is this a medical tool?</h4>
                <p className="text-slate-400 leading-relaxed">
                  No. HeatShield AI is strictly an environmental decision-support and awareness platform. It does not diagnose heat stroke, prescribe medication, or replace healthcare professionals.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

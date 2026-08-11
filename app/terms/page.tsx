'use client';

export const dynamic = 'force-dynamic';


import React from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-4">
          <Shield className="w-4 h-4" /> HEATSHIELD AI
        </Link>

        <h1 className="text-3xl font-extrabold text-white">Terms of Service & Medical Disclaimer</h1>
        <p className="text-xs text-slate-400 font-mono">Last Updated: August 2026</p>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-xl text-amber-200 font-mono">
            <strong>CRITICAL LEGAL & SAFETY DISCLAIMER:</strong> HeatShield AI is a software decision support system designed to assist in evaluating heat risk based on meteorological and contextual data. It is NOT a medical diagnosis tool. It DOES NOT diagnose heatstroke, disease, or medical conditions, prescribe treatment, or guarantee safety.
          </div>

          <h3 className="text-sm font-bold text-white mt-4 font-mono">1. Software Decision Support</h3>
          <p>
            Users and organization administrators must exercise independent judgment when managing outdoor work, sports practices, or community events during heat waves.
          </p>

          <h3 className="text-sm font-bold text-white mt-4 font-mono">2. Zero-Budget Prototype Scope</h3>
          <p>
            This application is provided as an open-source software project built on free-tier APIs (Open-Meteo, Leaflet, Supabase). Service availability depends on public third-party endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}

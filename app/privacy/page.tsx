'use client';

export const dynamic = 'force-dynamic';


import React from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-4">
          <Shield className="w-4 h-4" /> HEATSHIELD AI
        </Link>

        <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="text-xs text-slate-400 font-mono">Last Updated: August 2026</p>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <p>
            HeatShield AI respects your privacy. This policy outlines how location coordinates and contextual information are handled within our software platform.
          </p>

          <h3 className="text-sm font-bold text-white mt-4 font-mono">1. Data Collection & Location Usage</h3>
          <p>
            We collect location coordinates solely to query environmental meteorological observations from the free Open-Meteo API. We never publicly expose exact user coordinates or sell location data to third parties.
          </p>

          <h3 className="text-sm font-bold text-white mt-4 font-mono">2. Health & Medical Data</h3>
          <p>
            HeatShield AI collects general contextual preferences (e.g. age category, workload intensity, cooling access) to calibrate software decision support algorithms. We do not request or store private medical records.
          </p>

          <h3 className="text-sm font-bold text-white mt-4 font-mono">3. Open-Source & Local Storage</h3>
          <p>
            All user preferences and cached weather data are stored locally in your browser session or in secure Supabase PostgreSQL instances with Row Level Security (RLS).
          </p>
        </div>
      </div>
    </div>
  );
}

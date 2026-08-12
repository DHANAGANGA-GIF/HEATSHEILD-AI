'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import { Shield, Lock, MapPin, Eye, Server, Bell, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Operational Dashboard
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Privacy & Data Governance Center</h1>
            <p className="text-xs text-slate-400 font-mono">HEATSHIELD AI — DATA DISCLOSURE & SECURITY POLICY</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-xs text-slate-300 leading-relaxed">
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              1. Location Data Collection & Handling
            </h2>
            <p>
              HeatShield AI requests browser GPS coordinates solely to query real-time meteorological observations (temperature, relative humidity, apparent temperature, and wind speed) from the open Open-Meteo API. Your exact GPS coordinates are rounded for display privacy and are never sold, tracked for ad targeting, or shared with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase mb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              2. Weather Data Sources & Accuracy
            </h2>
            <p>
              Environmental data is retrieved directly from Open-Meteo API (non-commercial open license). Data status is explicitly classified as <code className="font-mono bg-slate-800 px-1 rounded text-emerald-300">LIVE</code>, <code className="font-mono bg-slate-800 px-1 rounded text-amber-300">CACHED</code>, <code className="font-mono bg-slate-800 px-1 rounded text-amber-300">FALLBACK</code>, or <code className="font-mono bg-slate-800 px-1 rounded text-slate-400">UNAVAILABLE</code>. Stale data is never represented as live observations.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              3. Community Reports & RLS Protection
            </h2>
            <p>
              Community hazard reports (e.g. water access or shaded cooling zones) are sanitized to remove HTML scripts and stored in Supabase PostgreSQL with strict Row Level Security (RLS) policies. Users retain ownership and can only edit or delete their own submitted reports.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              4. Notification Controls
            </h2>
            <p>
              Browser notifications require explicit user permission gesture. You can adjust your notification settings or revoke browser permissions at any time via the Alert Center or site settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

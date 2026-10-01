'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { Settings, Save, CheckCircle, Globe, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(getUserProfile());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Application Settings</h1>
                <p className="text-xs text-slate-400 font-mono">
                  Manage notifications, language defaults &amp; operational preferences
                </p>
              </div>
            </div>
            {saved && (
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          {/* Preferences Card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-5">
            <h2 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest pb-3 border-b border-slate-800 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              PREFERENCES
            </h2>

            <div className="space-y-3 text-xs">
              {/* Language */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <div>
                  <span className="font-semibold text-slate-100 block">Preferred Language</span>
                  <span className="text-slate-500 text-[11px] mt-0.5 block">Select your default interface language.</span>
                </div>
                <select
                  value={profile.language || 'en'}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value as any })}
                  className="bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
                  aria-label="Preferred Language"
                >
                  <option value="en" className="bg-slate-900">English</option>
                  <option value="te" className="bg-slate-900">తెలుగు (Telugu)</option>
                  <option value="ta" className="bg-slate-900">தமிழ் (Tamil)</option>
                  <option value="hi" className="bg-slate-900">हिन्दी (Hindi)</option>
                </select>
              </div>

              {/* Safety escalation alerts */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <div>
                  <span className="font-semibold text-slate-100 block">In-App Safety Escalation Alerts</span>
                  <span className="text-slate-500 text-[11px] mt-0.5 block">Receive in-app alerts when heat risk score crosses HIGH (61+) threshold.</span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Safety escalation alerts"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Community notifications */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <div>
                  <span className="font-semibold text-slate-100 block">Community Cluster Notifications</span>
                  <span className="text-slate-500 text-[11px] mt-0.5 block">Notify when multiple water or shade reports cluster in your locality.</span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Community cluster notifications"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Offline cache */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition">
                <div>
                  <span className="font-semibold text-slate-100 block">Automatic Offline Cache Fallback</span>
                  <span className="text-slate-500 text-[11px] mt-0.5 block">Store weather stream locally for low-connectivity offline operation.</span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  aria-label="Automatic offline cache fallback"
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

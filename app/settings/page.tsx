'use client';

export const dynamic = 'force-dynamic';


import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { Settings, Save, CheckCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">APPLICATION SETTINGS</h1>
              <p className="text-xs text-slate-500 font-mono">
                Manage notifications, language defaults, & operational preferences
              </p>
            </div>
            {saved && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-xs font-bold font-mono text-slate-500 uppercase pb-2 border-b">PREFERENCES</h2>

            <div className="space-y-4 text-xs font-sans">
              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
                <div>
                  <span className="font-bold text-slate-900 block">In-App Safety Escalation Alerts</span>
                  <span className="text-slate-500 text-[11px]">Receive in-app alerts when heat risk score crosses HIGH (61+) threshold.</span>
                </div>
                <input type="checkbox" defaultChecked className="rounded text-emerald-600 focus:ring-0 w-4 h-4" />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
                <div>
                  <span className="font-bold text-slate-900 block">Community Cluster Notifications</span>
                  <span className="text-slate-500 text-[11px]">Notify when multiple water or shade reports cluster in your locality.</span>
                </div>
                <input type="checkbox" defaultChecked className="rounded text-emerald-600 focus:ring-0 w-4 h-4" />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
                <div>
                  <span className="font-bold text-slate-900 block">Automatic Offline Cache Fallback</span>
                  <span className="text-slate-500 text-[11px]">Store weather stream locally for low-connectivity offline operation.</span>
                </div>
                <input type="checkbox" defaultChecked className="rounded text-emerald-600 focus:ring-0 w-4 h-4" />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

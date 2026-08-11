'use client';

export const dynamic = 'force-dynamic';


import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { UserProfile } from '@/lib/types';
import { User, Save, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center text-xl font-bold font-mono">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profile.name || 'User Profile'}</h1>
                <p className="text-xs text-slate-500 font-mono">Role: {profile.role.toUpperCase()}</p>
              </div>
            </div>

            {saved && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Profile Updated
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              CONTEXT & HEALTH PARAMETERS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Role Type</label>
                <select
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value as any })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="user">Standard User</option>
                  <option value="school">School Administrator</option>
                  <option value="worksite">Worksite Safety Officer</option>
                  <option value="ngo">NGO Community Lead</option>
                  <option value="admin">Platform Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Age Group</label>
                <select
                  value={profile.age_group}
                  onChange={(e) => setProfile({ ...profile, age_group: e.target.value as any })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="adult">Adult (18-64)</option>
                  <option value="older_adult">Older Adult (65+)</option>
                  <option value="child">Child / Youth</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Activity Level</label>
                <select
                  value={profile.activity_level}
                  onChange={(e) => setProfile({ ...profile, activity_level: e.target.value as any })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="low">Low Activity</option>
                  <option value="moderate">Moderate Work</option>
                  <option value="high">High Physical Exercise / Heavy Labor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Cooling Access</label>
                <select
                  value={profile.cooling_access}
                  onChange={(e) => setProfile({ ...profile, cooling_access: e.target.value as any })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="good">Good (AC / Shade)</option>
                  <option value="limited">Limited Cooling</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

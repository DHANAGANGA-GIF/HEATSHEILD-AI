'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, saveUserProfile, logoutUser } from '@/lib/store';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { User, Save, CheckCircle, ShieldCheck, Key, Lock, Bell, MapPin, LogOut, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [saved, setSaved] = useState(false);
  const [authSession, setAuthSession] = useState<{
    provider: string;
    emailConfirmed: boolean;
    phoneConfirmed: boolean;
    lastSignIn: string;
  }>({
    provider: 'Supabase Auth',
    emailConfirmed: true,
    phoneConfirmed: false,
    lastSignIn: new Date().toLocaleString(),
  });

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setAuthSession({
            provider: session.user.app_metadata?.provider || 'Email/Password',
            emailConfirmed: Boolean(session.user.email_confirmed_at),
            phoneConfirmed: Boolean(session.user.phone_confirmed_at),
            lastSignIn: session.user.last_sign_in_at
              ? new Date(session.user.last_sign_in_at).toLocaleString()
              : new Date().toLocaleString(),
          });
        }
      });
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = async () => {
    await logoutUser();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Account Overview Bar */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center text-xl font-bold font-mono shadow-sm">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profile.name || 'User Profile'}</h1>
                <p className="text-xs text-slate-500 font-mono">
                  {profile.email} • Role: <span className="font-semibold text-slate-700">{profile.role.toUpperCase()}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Profile Updated
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Session & Security Center */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-tight">
                SESSION & SECURITY CENTER
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">AUTH PROVIDER</span>
                <span className="font-bold text-slate-900">{authSession.provider}</span>
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">EMAIL STATUS</span>
                <span className={`font-semibold ${authSession.emailConfirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {authSession.emailConfirmed ? 'VERIFIED' : 'PENDING'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">PHONE STATUS</span>
                <span className="font-semibold text-slate-500">NOT CONFIGURED</span>
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">SESSION STATUS</span>
                <span className="font-bold text-emerald-600 font-mono">ACTIVE (Supabase)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/settings"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition flex items-center gap-1"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notification Preferences</span>
              </Link>
              <Link
                href="/privacy"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Privacy Settings</span>
              </Link>
              <Link
                href="/locations"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Location Settings</span>
              </Link>
            </div>
          </div>

          {/* Profile & Risk Context Form */}
          <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 uppercase font-mono">
              CONTEXT & HEALTH PARAMETERS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 uppercase mb-1">Role Type</label>
                <select
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value as any })}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500"
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

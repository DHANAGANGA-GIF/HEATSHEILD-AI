'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Shield, Bell, User, Globe, Menu, LogOut, LogIn,
  CheckCircle2, Loader2, ChevronDown, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAlerts, saveUserProfile } from '@/lib/store';
import { Language, TechMode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
  techMode?: TechMode;
  onToggleTechMode?: (mode: TechMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileSidebar,
  techMode = 'technical',
  onToggleTechMode,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { firebaseUser, appProfile, isAuthenticated, isAdmin, signOut, actionLoading, loading } = useAuth();

  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    const alerts = getAlerts();
    setUnreadAlerts(alerts.filter(a => !a.read).length);
  }, [pathname]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = () => setProfileMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    setSignOutLoading(true);
    try {
      await signOut();
      router.push('/login');
    } finally {
      setSignOutLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    saveUserProfile({ language: lang });
    window.location.reload();
  };

  const displayName = firebaseUser?.displayName || appProfile?.name || 'User';
  const displayEmail = firebaseUser?.email || appProfile?.email || '';
  const emailVerified = firebaseUser?.emailVerified ?? false;
  const userInitial = displayName.charAt(0).toUpperCase() || 'U';
  const userLanguage = appProfile?.language || 'en';
  const userRole = appProfile?.role || 'user';

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Mobile Menu */}
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 text-slate-300 hover:text-white rounded-md hover:bg-slate-800"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold group-hover:bg-emerald-500 transition">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-lg text-white font-sans">
                HEATSHIELD <span className="text-emerald-400 font-mono">AI</span>
              </span>
              <span className="hidden sm:block text-[10px] text-slate-400 font-mono -mt-1">
                DECISION SUPPORT PLATFORM
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Live Radar Link */}
          <Link
            href="/notifications"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-mono font-bold transition"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE RADAR & DISPATCH
          </Link>

          {/* Tech/Simple Mode Toggle */}
          {onToggleTechMode && (
            <div className="hidden sm:flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700">
              <button
                onClick={() => onToggleTechMode('technical')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${techMode === 'technical' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Technical
              </button>
              <button
                onClick={() => onToggleTechMode('simple')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${techMode === 'simple' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                Simple
              </button>
            </div>
          )}

          {/* Language Selector */}
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 text-slate-400 mr-1 hidden sm:inline" />
            <select
              value={userLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-emerald-500 font-sans"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          {/* Alerts Bell */}
          <Link
            href="/alerts"
            className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Bell className="w-5 h-5" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center font-mono">
                {unreadAlerts}
              </span>
            )}
          </Link>

          {/* Auth: Loading state */}
          {loading && (
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            </div>
          )}

          {/* Auth: Not authenticated → Sign In button */}
          {!loading && !isAuthenticated && (
            <Link
              href="/login"
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Auth: Authenticated → Profile Dropdown */}
          {!loading && isAuthenticated && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                aria-label="User menu"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold font-mono">
                  {userInitial}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-200 leading-tight">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight font-mono">
                    {isAdmin ? '⬡ ADMIN' : userRole.toUpperCase()}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </button>

              {/* Dropdown Menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                  {/* User identity */}
                  <div className="px-4 py-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{displayName}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 truncate">
                          {emailVerified && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                          <span className="truncate">{displayEmail}</span>
                        </div>
                        <div className="mt-0.5">
                          <span className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${isAdmin ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                            {isAdmin ? '⬡ ADMIN' : userRole.toUpperCase()}
                          </span>
                          {emailVerified && (
                            <span className="ml-1 inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-400">
                              VERIFIED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition"
                    >
                      <User className="w-4 h-4" />Profile & Settings
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition"
                    >
                      <Bell className="w-4 h-4" />Notifications
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-950/30 transition"
                      >
                        <ShieldCheck className="w-4 h-4" />Admin Console
                      </Link>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={handleLogout}
                      disabled={signOutLoading || actionLoading}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition disabled:opacity-50"
                    >
                      {signOutLoading || actionLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Signing out...</>
                      ) : (
                        <><LogOut className="w-4 h-4" />Sign Out</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

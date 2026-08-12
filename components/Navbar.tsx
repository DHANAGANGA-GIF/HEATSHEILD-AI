'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Shield, Bell, User, Globe, AlertTriangle, Menu, X, Sun, LogOut } from 'lucide-react';
import { getUserProfile, getAlerts, getSmartAlerts, saveUserProfile, logoutUser } from '@/lib/store';
import { Language, TechMode, UserProfile } from '@/lib/types';
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
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    const smartAlerts = getSmartAlerts();
    const legacyAlerts = getAlerts();
    const smartUnread = smartAlerts.filter(a => !a.read && !a.dismissed).length;
    const legacyUnread = legacyAlerts.filter(a => !a.read).length;
    setUnreadAlerts(smartUnread > 0 ? smartUnread : legacyUnread);
  }, [pathname]);

  const handleLanguageChange = (lang: Language) => {
    const updated = saveUserProfile({ language: lang });
    setProfile(updated);
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Mobile Menu button */}
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

        {/* Center/Right Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Tech/Simple Mode Toggle */}
          {onToggleTechMode && (
            <div className="hidden sm:flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700">
              <button
                onClick={() => onToggleTechMode('technical')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  techMode === 'technical' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Technical
              </button>
              <button
                onClick={() => onToggleTechMode('simple')}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  techMode === 'simple' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Simple
              </button>
            </div>
          )}

          {/* Language Selector */}
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 text-slate-400 mr-1 hidden sm:inline" />
            <select
              value={profile.language || 'en'}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:border-emerald-500 font-sans"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          {/* Notifications Bell */}
          <Link
            href="/notifications"
            className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Notification Center"
          >
            <Bell className="w-5 h-5" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center font-mono">
                {unreadAlerts}
              </span>
            )}
          </Link>

          {/* Profile Quick Access */}
          <Link
            href="/profile"
            className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold font-mono">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden md:inline text-xs font-medium text-slate-200">
              {profile.name || 'User Profile'}
            </span>
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

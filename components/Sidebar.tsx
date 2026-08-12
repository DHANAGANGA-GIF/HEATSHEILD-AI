'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Flame,
  Clock,
  MessageSquare,
  Sliders,
  Users,
  MapPin,
  AlertCircle,
  GraduationCap,
  Briefcase,
  HeartHandshake,
  ShieldCheck,
  FileText,
  Bookmark,
  Bell,
  Settings,
  HelpCircle,
  X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const pathname = usePathname();

  const navGroups = [
    {
      title: 'CORE PLATFORM',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Notifications', href: '/notifications', icon: Bell },
        { label: 'Risk Analysis', href: '/risk', icon: Flame },
        { label: 'Risk Timeline', href: '/timeline', icon: Clock },
        { label: 'Ask AI Assistant', href: '/assistant', icon: MessageSquare },
        { label: 'What-If Simulator', href: '/simulator', icon: Sliders },
        { label: 'Saved Locations', href: '/locations', icon: Bookmark },
      ],
    },
    {
      title: 'COMMUNITY & MAP',
      items: [
        { label: 'Community Hub', href: '/community', icon: Users },
        { label: 'Community Map', href: '/community/map', icon: MapPin },
        { label: 'Report Issue', href: '/community/report', icon: AlertCircle },
      ],
    },
    {
      title: 'ORGANIZATIONS',
      items: [
        { label: 'School Dashboard', href: '/school', icon: GraduationCap },
        { label: 'Worksite Safety', href: '/worksite', icon: Briefcase },
        { label: 'NGO Portal', href: '/ngo', icon: HeartHandshake },
      ],
    },
    {
      title: 'MANAGEMENT & UTILS',
      items: [
        { label: 'Admin Console', href: '/admin', icon: ShieldCheck },
        { label: 'Reports & Exports', href: '/reports', icon: FileText },
        { label: 'Settings', href: '/settings', icon: Settings },
        { label: 'Help & Safety', href: '/help', icon: HelpCircle },
      ],
    },
  ];

  const content = (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 font-sans">
      <div className="p-4 flex items-center justify-between border-b border-slate-800 lg:hidden">
        <span className="font-bold text-sm text-white font-mono">NAVIGATION MENU</span>
        <button onClick={onCloseMobile} className="p-1 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">
              {group.title}
            </h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition ${
                      active
                        ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Disclaimer Notice */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="text-[11px] text-slate-500 leading-tight">
          <span className="font-bold text-amber-500 font-mono">NOT MEDICAL ADVICE</span>
          <p className="mt-1 opacity-80">
            HeatShield AI provides operational decision support. Does not diagnose disease or heatstroke.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-[calc(100vh-4rem)] sticky top-16">
        {content}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 max-w-xs bg-slate-900 h-full shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

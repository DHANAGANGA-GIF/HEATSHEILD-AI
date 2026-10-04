'use client';

import React from 'react';
import {
  MapPin, Cloud, Cpu, TrendingUp, Bell, MessageSquare, ShieldCheck,
} from 'lucide-react';

import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';

export type SystemStatusValue =
  | 'LIVE'
  | 'CACHED'
  | 'FALLBACK'
  | 'MANUAL'
  | 'CAMPUS'
  | 'GPS'
  | 'UNAVAILABLE'
  | 'READY'
  | 'ACTIVE'
  | 'DISABLED'
  | 'AUTHENTICATED'
  | 'SIGNED OUT'
  | 'LOADING';

interface StatusItem {
  label: string;
  value: SystemStatusValue | string;
  icon: React.ReactNode;
}

interface SystemStatusPanelProps {
  locationStatus: SystemStatusValue;   // GPS | MANUAL | CAMPUS | UNAVAILABLE
  weatherStatus: SystemStatusValue;    // LIVE | CACHED | FALLBACK | UNAVAILABLE | LOADING
  forecastStatus: SystemStatusValue;   // LIVE | CACHED | UNAVAILABLE | LOADING
  alertsStatus: SystemStatusValue;     // ACTIVE | DISABLED | UNAVAILABLE
  aiStatus: SystemStatusValue;         // READY | UNAVAILABLE
  authStatus?: SystemStatusValue;      // AUTHENTICATED | SIGNED OUT
  lang?: Language;
  className?: string;
}

function statusConfig(value: SystemStatusValue | string) {
  switch (value) {
    case 'LIVE':
    case 'READY':
    case 'ACTIVE':
    case 'GPS':
    case 'AUTHENTICATED':
      return {
        dot: 'bg-emerald-400 animate-pulse',
        text: 'text-emerald-400',
        bg: 'bg-emerald-950/60',
        border: 'border-emerald-800/60',
      };
    case 'CACHED':
    case 'FALLBACK':
    case 'MANUAL':
    case 'CAMPUS':
      return {
        dot: 'bg-amber-400',
        text: 'text-amber-400',
        bg: 'bg-amber-950/60',
        border: 'border-amber-800/60',
      };
    case 'LOADING':
      return {
        dot: 'bg-blue-400 animate-pulse',
        text: 'text-blue-400',
        bg: 'bg-blue-950/60',
        border: 'border-blue-800/60',
      };
    case 'DISABLED':
    case 'SIGNED OUT':
    case 'UNAVAILABLE':
    default:
      return {
        dot: 'bg-slate-400',
        text: 'text-slate-400',
        bg: 'bg-slate-800/60',
        border: 'border-slate-700/60',
      };
  }
}

function StatusBadge({ value }: { value: SystemStatusValue | string }) {
  const cfg = statusConfig(value);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {value}
    </span>
  );
}

export const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  locationStatus,
  weatherStatus,
  forecastStatus,
  alertsStatus,
  aiStatus,
  authStatus = 'AUTHENTICATED',
  lang = 'en',
  className = '',
}) => {
  const items: StatusItem[] = [
    { label: t('location', lang).toUpperCase(),     value: locationStatus, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: t('temperature', lang).toUpperCase(),  value: weatherStatus,  icon: <Cloud className="w-3.5 h-3.5" /> },
    { label: 'RISK ENGINE',                         value: 'READY',        icon: <Cpu className="w-3.5 h-3.5" /> },
    { label: t('forecast_timeline', lang).toUpperCase(), value: forecastStatus, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: t('alerts', lang).toUpperCase(),       value: alertsStatus,   icon: <Bell className="w-3.5 h-3.5" /> },
    { label: t('assistant', lang).toUpperCase(),    value: aiStatus,       icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { label: t('authenticated', lang).toUpperCase(), value: authStatus,    icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">System Status Panel</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-slate-500">
              {item.icon}
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide truncate">{item.label}</span>
            </div>
            <StatusBadge value={item.value} />
          </div>
        ))}
      </div>
    </div>
  );
};

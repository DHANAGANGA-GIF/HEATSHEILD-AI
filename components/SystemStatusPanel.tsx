'use client';

import React from 'react';
import {
  MapPin, Cloud, Cpu, TrendingUp, Bell, MessageSquare,
  CheckCircle2, AlertTriangle, WifiOff, Loader2,
} from 'lucide-react';

export type SystemStatusValue =
  | 'LIVE'
  | 'CACHED'
  | 'MANUAL'
  | 'CAMPUS'
  | 'GPS'
  | 'UNAVAILABLE'
  | 'READY'
  | 'ACTIVE'
  | 'LOADING';

interface StatusItem {
  label: string;
  value: SystemStatusValue | string;
  icon: React.ReactNode;
}

interface SystemStatusPanelProps {
  locationStatus: SystemStatusValue;   // GPS | MANUAL | CAMPUS | UNAVAILABLE
  weatherStatus: SystemStatusValue;    // LIVE | CACHED | UNAVAILABLE | LOADING
  forecastStatus: SystemStatusValue;   // LIVE | CACHED | UNAVAILABLE | LOADING
  alertsStatus: SystemStatusValue;     // ACTIVE | UNAVAILABLE
  aiStatus: SystemStatusValue;         // READY | UNAVAILABLE
  className?: string;
}

// Visual config per status value
function statusConfig(value: SystemStatusValue | string) {
  switch (value) {
    case 'LIVE':
    case 'READY':
    case 'ACTIVE':
    case 'GPS':
      return {
        dot: 'bg-emerald-500 animate-pulse',
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    case 'CACHED':
    case 'MANUAL':
    case 'CAMPUS':
      return {
        dot: 'bg-amber-400',
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    case 'LOADING':
      return {
        dot: 'bg-blue-400 animate-pulse',
        text: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
      };
    case 'UNAVAILABLE':
    default:
      return {
        dot: 'bg-slate-400',
        text: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
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
  className = '',
}) => {
  const items: StatusItem[] = [
    { label: 'LOCATION',     value: locationStatus, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: 'WEATHER',      value: weatherStatus,  icon: <Cloud className="w-3.5 h-3.5" /> },
    { label: 'RISK ENGINE',  value: 'READY',        icon: <Cpu className="w-3.5 h-3.5" /> },
    { label: 'FORECAST',     value: forecastStatus, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: 'ALERTS',       value: alertsStatus,   icon: <Bell className="w-3.5 h-3.5" /> },
    { label: 'AI ASSISTANT', value: aiStatus,       icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">System Status</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-slate-500">
              {item.icon}
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide">{item.label}</span>
            </div>
            <StatusBadge value={item.value} />
          </div>
        ))}
      </div>
    </div>
  );
};

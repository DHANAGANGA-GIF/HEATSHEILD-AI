'use client';

import React from 'react';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';
import { LocationData } from '@/lib/types';
import { LocationSource } from '@/lib/constants';

interface LocationStatusBarProps {
  location: LocationData;
  locationSource: LocationSource;
  dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'FALLBACK';
  lastUpdated?: string;
  onChangeLocation?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

const SOURCE_CONFIG: Record<LocationSource, { label: string; color: string; dotColor: string }> = {
  GPS:     { label: 'GPS Location',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200',  dotColor: 'bg-emerald-500' },
  MANUAL:  { label: 'Manual Location',  color: 'text-blue-700 bg-blue-50 border-blue-200',           dotColor: 'bg-blue-500' },
  CAMPUS:  { label: 'Campus Location',  color: 'text-teal-700 bg-teal-50 border-teal-200',           dotColor: 'bg-teal-500' },
  SAVED:   { label: 'Saved Location',   color: 'text-purple-700 bg-purple-50 border-purple-200',     dotColor: 'bg-purple-500' },
  DEFAULT: { label: 'Default Location', color: 'text-slate-600 bg-slate-50 border-slate-200',        dotColor: 'bg-slate-400' },
};

const STATUS_CONFIG: Record<'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'FALLBACK', { label: string; color: string; dotColor: string }> = {
  LIVE:        { label: 'LIVE',        color: 'text-emerald-700',  dotColor: 'bg-emerald-500 animate-pulse' },
  CACHED:      { label: 'CACHED',      color: 'text-amber-700',    dotColor: 'bg-amber-400' },
  UNAVAILABLE: { label: 'UNAVAILABLE', color: 'text-red-600',      dotColor: 'bg-red-500' },
  FALLBACK:    { label: 'UNAVAILABLE', color: 'text-red-600',      dotColor: 'bg-red-500' },
};

export const LocationStatusBar: React.FC<LocationStatusBarProps> = ({
  location,
  locationSource,
  dataStatus,
  lastUpdated,
  onChangeLocation,
  onRefresh,
  isLoading = false,
  className = '',
}) => {
  const src = SOURCE_CONFIG[locationSource];
  const status = STATUS_CONFIG[dataStatus] ?? STATUS_CONFIG['UNAVAILABLE'];

  // Show city/locality only — never raw GPS coordinates in normal UI
  const displayName = location.name;
  const displayLocality = location.locality || location.country || '';

  // GPS accuracy badge — only shown when source is GPS and accuracy is known
  const gpsAccuracyLabel = locationSource === 'GPS' && location.gps_accuracy
    ? `±${location.gps_accuracy < 1000
        ? `${location.gps_accuracy}m`
        : `${(location.gps_accuracy / 1000).toFixed(1)}km`}`
    : null;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${className}`}>
      {/* Left: Location Name + Source Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-slate-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm truncate">{displayName}</span>
            {displayLocality && (
              <span className="text-xs text-slate-500 truncate hidden sm:inline">{displayLocality}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {/* Source badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${src.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${src.dotColor}`} />
              {src.label}
            </span>
            {/* GPS accuracy — only when real GPS and accuracy is known */}
            {gpsAccuracyLabel && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200">
                {gpsAccuracyLabel}
              </span>
            )}
            {/* Data status */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
              {status.label}
            </span>
            {lastUpdated && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">· {lastUpdated}</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh environmental data"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? 'Updating...' : 'Refresh'}</span>
          </button>
        )}
        {onChangeLocation && (
          <button
            onClick={onChangeLocation}
            aria-label="Change location"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
          >
            <Navigation className="w-3 h-3" />
            <span>Change</span>
          </button>
        )}
      </div>
    </div>
  );
};

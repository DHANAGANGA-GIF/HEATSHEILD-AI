'use client';

import React from 'react';
import { WeatherData } from '@/lib/types';
import { Thermometer, Droplets, Wind, Gauge, CloudSun, MapPin } from 'lucide-react';

interface WeatherCardProps {
  weather: WeatherData;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, onRefresh, isLoading }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-base">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>{weather.location.name}</span>
            {weather.location.locality && (
              <span className="text-slate-500 text-xs font-normal">({weather.location.locality})</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {weather.location.latitude.toFixed(3)}°N, {weather.location.longitude.toFixed(3)}°E
          </p>
        </div>

        <div className="flex items-center gap-3">
          {weather.is_cached && (
            <span className="text-[11px] font-mono px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded">
              Cached: {weather.cache_timestamp || 'Offline'}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
          >
            {isLoading ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Air Temperature */}
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Thermometer className="w-3.5 h-3.5 text-amber-600" />
            <span>Temperature</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {weather.temperature}°C
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Apparent: {weather.apparent_temperature}°C
          </span>
        </div>

        {/* Relative Humidity */}
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            <span>Humidity</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {weather.relative_humidity}%
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Moisture load
          </span>
        </div>

        {/* Wind Speed */}
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Wind className="w-3.5 h-3.5 text-teal-600" />
            <span>Wind Speed</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {weather.wind_speed} <span className="text-xs font-normal">km/h</span>
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Surface ventilation
          </span>
        </div>

        {/* Pressure */}
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Gauge className="w-3.5 h-3.5 text-purple-600" />
            <span>Pressure</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {weather.pressure} <span className="text-xs font-normal">hPa</span>
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Atmospheric load
          </span>
        </div>
      </div>
    </div>
  );
};

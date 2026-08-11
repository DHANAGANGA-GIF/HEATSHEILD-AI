'use client';

import React from 'react';
import { RiskLevel } from '@/lib/types';
import { AlertTriangle, ShieldCheck, Flame, AlertOctagon } from 'lucide-react';

interface HeatGaugeProps {
  score: number;
  level: RiskLevel;
  lastUpdated?: string;
  dataQuality?: string;
}

export const HeatGauge: React.FC<HeatGaugeProps> = ({
  score,
  level,
  lastUpdated,
  dataQuality = 'Good',
}) => {
  const getLevelDetails = (l: RiskLevel) => {
    switch (l) {
      case 'LOW':
        return {
          color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
          badgeColor: 'bg-emerald-600 text-white',
          barColor: 'bg-emerald-500',
          icon: ShieldCheck,
          label: 'LOW RISK',
          desc: 'Conditions are within normal safety thresholds for typical outdoor activities.',
        };
      case 'MODERATE':
        return {
          color: 'text-amber-800 bg-amber-50 border-amber-300',
          badgeColor: 'bg-amber-600 text-white',
          barColor: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'MODERATE RISK',
          desc: 'Elevated heat stress. Prolonged exposure or strenuous exercise may lead to fatigue.',
        };
      case 'HIGH':
        return {
          color: 'text-orange-900 bg-orange-50 border-orange-300',
          badgeColor: 'bg-orange-600 text-white',
          barColor: 'bg-orange-600',
          icon: Flame,
          label: 'HIGH RISK',
          desc: 'High thermal strain. Heat cramps and heat exhaustion possible with physical exposure.',
        };
      case 'EXTREME':
        return {
          color: 'text-rose-950 bg-rose-50 border-rose-300',
          badgeColor: 'bg-rose-700 text-white',
          barColor: 'bg-rose-600',
          icon: AlertOctagon,
          label: 'EXTREME RISK',
          desc: 'Critical heat stress hazard. Avoid unnecessary outdoor physical exposure.',
        };
    }
  };

  const details = getLevelDetails(level);
  const IconComponent = details.icon;

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${details.color} transition-all duration-200`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <IconComponent className="w-6 h-6" />
            <h2 className="text-xs font-semibold tracking-wider uppercase opacity-80">
              HEAT RISK ASSESSMENT
            </h2>
          </div>
          <p className="text-xs mt-0.5 opacity-75">
            Real-Time Environmental & Contextual Thermal Stress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-bold tracking-wider rounded-md uppercase ${details.badgeColor}`}>
            {details.label}
          </span>
          <span className="text-xs px-2 py-0.5 bg-black/5 rounded font-mono">
            Quality: {dataQuality}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Score Display */}
        <div className="md:col-span-5 flex items-baseline gap-3">
          <div className="text-5xl font-extrabold tracking-tight font-mono">
            {score}
          </div>
          <div className="text-sm font-semibold opacity-70">
            / 100
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="md:col-span-7 space-y-2">
          <div className="flex justify-between text-xs font-mono font-medium opacity-80">
            <span>0 (Low)</span>
            <span>35</span>
            <span>60</span>
            <span>80</span>
            <span>100 (Extreme)</span>
          </div>
          <div className="w-full h-3 bg-black/10 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${details.barColor}`}
              style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
            />
          </div>
          <p className="text-xs opacity-90 leading-relaxed font-normal">
            {details.desc}
          </p>
        </div>
      </div>

      {lastUpdated && (
        <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between text-[11px] opacity-75 font-mono">
          <span>Data Timestamp: {lastUpdated}</span>
          <span>Engine: HeatShield-XAI v1.2</span>
        </div>
      )}
    </div>
  );
};

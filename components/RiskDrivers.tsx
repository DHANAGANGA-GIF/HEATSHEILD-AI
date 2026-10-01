'use client';

import React from 'react';
import { RiskFactor, TechMode } from '@/lib/types';
import { BarChart3, Thermometer, Droplets, Activity, Clock, ShieldCheck, Wind, HelpCircle } from 'lucide-react';

interface RiskDriversProps {
  factors: RiskFactor[];
  mode: TechMode;
  onToggleMode: (mode: TechMode) => void;
}

export const RiskDrivers: React.FC<RiskDriversProps> = ({ factors, mode, onToggleMode }) => {
  const getFactorIcon = (category: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wind') || lowerName.includes('convect')) return <Wind className="w-4 h-4 text-emerald-600" />;
    if (category === 'temperature' || lowerName.includes('temperature')) return <Thermometer className="w-4 h-4 text-orange-600" />;
    if (category === 'humidity' || lowerName.includes('humidity')) return <Droplets className="w-4 h-4 text-blue-600" />;
    if (category === 'activity' || lowerName.includes('activity')) return <Activity className="w-4 h-4 text-amber-600" />;
    if (category === 'exposure' && lowerName.includes('duration')) return <Clock className="w-4 h-4 text-purple-600" />;
    return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
  };

  const getImpactBadge = (impact: string, direction?: string) => {
    if (direction === 'mitigating') {
      return (
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800">
          COOLING RELIEF (-)
        </span>
      );
    }
    switch (impact) {
      case 'critical':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-800">
            CRITICAL (+)
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-orange-300 bg-orange-50 text-orange-800">
            HIGH (+)
          </span>
        );
      case 'moderate':
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
            MODERATE
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-700">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">
              WHY IS MY RISK AT THIS LEVEL?
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Key environmental and personal factors influencing your heat-risk calculation
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start sm:self-auto" role="group" aria-label="Explanation detail level">
          <button
            onClick={() => onToggleMode('technical')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
              mode === 'technical'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Technical
          </button>
          <button
            onClick={() => onToggleMode('simple')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
              mode === 'simple'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Simple
          </button>
        </div>
      </div>

      {/* Understandable Factor Summary */}
      <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Assessment Breakdown: </span>
          <span>These environmental and contextual factors combine to determine your current heat-risk level and actionable safety guidance.</span>
        </div>
      </div>

      <div className="space-y-3">
        {factors.map((factor, idx) => (
          <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {getFactorIcon(factor.category, factor.name)}
                <span className="text-sm font-semibold text-slate-900">
                  {factor.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getImpactBadge(factor.impact, factor.direction)}
                {mode === 'technical' && (
                  <span className="text-xs font-mono font-bold text-slate-600">
                    {factor.weight_percent}% relative weight
                  </span>
                )}
              </div>
            </div>

            {mode === 'technical' && (
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    factor.direction === 'mitigating' ? 'bg-emerald-600' : 'bg-orange-600'
                  }`}
                  style={{ width: `${Math.max(8, factor.weight_percent)}%` }}
                />
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed">
              {mode === 'technical' ? factor.description_technical : factor.description_simple}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

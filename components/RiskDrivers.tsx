'use client';

import React from 'react';
import { RiskFactor, TechMode } from '@/lib/types';
import { HelpCircle, BarChart3 } from 'lucide-react';

interface RiskDriversProps {
  factors: RiskFactor[];
  mode: TechMode;
  onToggleMode: (mode: TechMode) => void;
}

export const RiskDrivers: React.FC<RiskDriversProps> = ({ factors, mode, onToggleMode }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-semibold text-slate-900">
              WHY IS MY RISK AT THIS LEVEL?
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Model-derived explainable feature contributions (XAI factor weights)
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start sm:self-auto">
          <button
            onClick={() => onToggleMode('technical')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              mode === 'technical'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Technical
          </button>
          <button
            onClick={() => onToggleMode('simple')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              mode === 'simple'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Simple
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {factors.map((factor, idx) => (
          <div key={idx} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {factor.name}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    factor.impact === 'critical'
                      ? 'bg-rose-100 text-rose-800'
                      : factor.impact === 'high'
                      ? 'bg-orange-100 text-orange-800'
                      : factor.impact === 'moderate'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {factor.impact}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                {factor.weight_percent}% impact
              </span>
            </div>

            {/* Feature Weight Progress */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-emerald-700 h-full rounded-full transition-all duration-300"
                style={{ width: `${factor.weight_percent}%` }}
              />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {mode === 'technical' ? factor.description_technical : factor.description_simple}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { SafetyGuidance, TechMode } from '@/lib/types';
import { ShieldCheck, Droplet, Sun, Clock, Heart } from 'lucide-react';

interface GuidanceListProps {
  guidance: SafetyGuidance[];
  mode: TechMode;
}

export const GuidanceList: React.FC<GuidanceListProps> = ({ guidance, mode }) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'hydration': return Droplet;
      case 'cooling': return Sun;
      case 'exposure': return Sun;
      case 'rest': return Clock;
      case 'community': return Heart;
      default: return ShieldCheck;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="pb-4 border-b border-slate-100 mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          RECOMMENDED PREVENTIVE ACTIONS
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Contextually calibrated heat safety protocols for current risk level
        </p>
      </div>

      <div className="space-y-3">
        {guidance.map((item) => {
          const IconComponent = getIcon(item.category);
          return (
            <div
              key={item.id}
              className={`p-4 rounded-lg border flex gap-3 items-start transition ${
                item.priority === 'urgent'
                  ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                  : item.priority === 'high'
                  ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                  : 'bg-slate-50/50 border-slate-200 text-slate-900'
              }`}
            >
              <div
                className={`p-2 rounded-md shrink-0 mt-0.5 ${
                  item.priority === 'urgent'
                    ? 'bg-rose-600 text-white'
                    : item.priority === 'high'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold">
                    {item.title}
                  </h4>
                  <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-black/5 opacity-80">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed font-normal">
                  {mode === 'technical' ? item.technical_text : item.simple_text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-mono">
        <span>Source: HeatShield AI Protocol Engine</span>
        <span>Not a medical diagnosis</span>
      </div>
    </div>
  );
};

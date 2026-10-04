'use client';

import React from 'react';
import { Language, RiskLevel } from '@/lib/types';
import { t } from '@/lib/i18n';
import { AlertTriangle, ShieldCheck, Flame, AlertOctagon } from 'lucide-react';

interface HeatGaugeProps {
  score: number;
  level: RiskLevel;
  lastUpdated?: string;
  dataQuality?: string;
  lang?: Language;
}

export const HeatGauge: React.FC<HeatGaugeProps> = ({
  score,
  level,
  lastUpdated,
  dataQuality = 'Good',
  lang = 'en',
}) => {
  const getLevelDetails = (l: RiskLevel) => {
    switch (l) {
      case 'LOW':
        return {
          color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
          badgeColor: 'bg-emerald-600 text-white',
          barColor: 'bg-emerald-500',
          icon: ShieldCheck,
          label: t('low', lang),
          desc: t('risk_level_low_desc', lang),
        };
      case 'MODERATE':
        return {
          color: 'text-amber-800 bg-amber-50 border-amber-300',
          badgeColor: 'bg-amber-600 text-white',
          barColor: 'bg-amber-500',
          icon: AlertTriangle,
          label: t('moderate', lang),
          desc: t('risk_level_moderate_desc', lang),
        };
      case 'HIGH':
        return {
          color: 'text-orange-900 bg-orange-50 border-orange-300',
          badgeColor: 'bg-orange-600 text-white',
          barColor: 'bg-orange-600',
          icon: Flame,
          label: t('high', lang),
          desc: t('risk_level_high_desc', lang),
        };
      case 'EXTREME':
        return {
          color: 'text-rose-950 bg-rose-50 border-rose-300',
          badgeColor: 'bg-rose-700 text-white',
          barColor: 'bg-rose-600',
          icon: AlertOctagon,
          label: t('extreme', lang),
          desc: t('risk_level_extreme_desc', lang),
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
              {t('heat_risk_score', lang)}
            </h2>
          </div>
          <p className="text-xs mt-0.5 opacity-75">
            {t('rule_engine_title', lang)}
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
            <span>0 ({t('low', lang)})</span>
            <span>35</span>
            <span>60</span>
            <span>80</span>
            <span>100 ({t('extreme', lang)})</span>
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
          <span>{t('updated_local_time', lang)}: {lastUpdated}</span>
          <span>{t('rule_engine_title', lang)}</span>
        </div>
      )}
    </div>
  );
};

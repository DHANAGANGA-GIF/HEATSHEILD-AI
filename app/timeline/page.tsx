'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { getUserProfile } from '@/lib/store';
import { scoreForecast, analyzeForecastTrend, ForecastContext } from '@/lib/forecast-engine';
import { HourlyForecastRisk, RiskLevel, WeatherData, ForecastTrend } from '@/lib/types';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, MapPin, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadge(level: RiskLevel) {
  const cls: Record<RiskLevel, string> = {
    EXTREME: 'bg-rose-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MODERATE: 'bg-amber-400 text-slate-900',
    LOW: 'bg-emerald-500 text-white',
  };
  return cls[level];
}

function riskBorder(level: RiskLevel) {
  const cls: Record<RiskLevel, string> = {
    EXTREME: 'border-rose-400',
    HIGH: 'border-orange-400',
    MODERATE: 'border-amber-300',
    LOW: 'border-emerald-300',
  };
  return cls[level];
}

function riskBg(level: RiskLevel) {
  const cls: Record<RiskLevel, string> = {
    EXTREME: 'bg-rose-50',
    HIGH: 'bg-orange-50',
    MODERATE: 'bg-amber-50',
    LOW: 'bg-emerald-50',
  };
  return cls[level];
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function TrendIcon({ dir }: { dir: HourlyForecastRisk['trend_direction'] }) {
  if (dir === 'RISING') return <TrendingUp className="w-3 h-3 text-rose-500" />;
  if (dir === 'FALLING') return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [scoredForecast, setScoredForecast] = useState<HourlyForecastRisk[]>([]);
  const [trend, setTrend] = useState<ForecastTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const p = getUserProfile();
    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    const ctx: ForecastContext = {
      activity: p.activity_level,
      duration: p.exposure_duration,
      cooling: p.cooling_access,
      age_group: p.age_group,
    };

    setLoading(true);
    fetchWeatherData(loc.latitude, loc.longitude, loc.name)
      .then((w) => {
        setWeather(w);
        if (w.hourly_forecast && w.hourly_forecast.length > 0) {
          const scored = scoreForecast(w, w.hourly_forecast.slice(0, 24), ctx, !!w.is_cached);
          setScoredForecast(scored);
          setTrend(analyzeForecastTrend(scored));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const dataStatus = !weather
    ? 'UNAVAILABLE'
    : weather.is_cached
    ? 'CACHED'
    : 'LIVE';

  const peak = trend?.peak;
  const trough = trend?.trough;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

          {/* Header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-slate-500" />
                <h1 className="text-xl font-bold text-slate-900">HEAT RISK FORECAST TIMELINE</h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                <MapPin className="w-3.5 h-3.5" />
                <span>24-Hour Thermal Stress Trajectory — {weather?.location?.name || 'Loading...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded border ${
                dataStatus === 'LIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : dataStatus === 'CACHED' ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                DATA: {dataStatus}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200">
                SOURCE: Open-Meteo
              </span>
              {weather?.timestamp && (
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Retrieved: {formatDateTime(weather.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
            <span>
              <strong>FORECAST NOTICE:</strong> Values labelled <code className="font-mono bg-blue-100 px-1 rounded">FORECAST</code> represent estimated future conditions from Open-Meteo. They are not current measurements and carry inherent uncertainty. Never treat forecast risk scores as guarantees of health outcomes.
            </span>
          </div>

          {loading ? (
            <div className="bg-white p-10 rounded-xl border border-slate-200 text-center font-mono text-sm text-slate-400 animate-pulse">
              Loading live forecast data from Open-Meteo...
            </div>
          ) : !weather || scoredForecast.length === 0 ? (
            <div className="bg-white p-10 rounded-xl border border-rose-200 text-center font-mono text-sm text-rose-700">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-rose-400" />
              <div className="font-bold text-base mb-1">FORECAST UNAVAILABLE</div>
              <div className="text-xs text-slate-500">Environmental forecast data could not be retrieved. Retain current conditions data if available. Do not invent forecast values.</div>
            </div>
          ) : (
            <>
              {/* Trend Summary Row */}
              {trend?.data_available && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {peak && (
                    <div className={`p-4 rounded-xl border ${riskBorder(peak.level)} ${riskBg(peak.level)} space-y-1`}>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">PEAK RISK PERIOD</div>
                      <div className="font-bold text-slate-900 font-mono text-lg">{formatTime(peak.time)}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase font-mono ${riskBadge(peak.level)}`}>{peak.level}</span>
                        <span className="text-xs font-mono text-slate-600">Score {peak.score}</span>
                      </div>
                    </div>
                  )}
                  {trough && (
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">LOWEST RISK PERIOD</div>
                      <div className="font-bold text-slate-900 font-mono text-lg">{formatTime(trough.time)}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase font-mono ${riskBadge(trough.level)}`}>{trough.level}</span>
                        <span className="text-xs font-mono text-slate-600">Score {trough.score}</span>
                      </div>
                    </div>
                  )}
                  {trend.rising_periods.length > 0 && (
                    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">MAIN RISING PERIOD</div>
                      <div className="font-bold text-slate-900 font-mono text-sm">
                        {formatTime(trend.rising_periods[0].start_time)} → {formatTime(trend.rising_periods[0].end_time)}
                      </div>
                      <div className="text-xs font-mono text-rose-700">+{trend.rising_periods[0].delta} pts</div>
                    </div>
                  )}
                  {trend.falling_periods.length > 0 && (
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">MAIN FALLING PERIOD</div>
                      <div className="font-bold text-slate-900 font-mono text-sm">
                        {formatTime(trend.falling_periods[0].start_time)} → {formatTime(trend.falling_periods[0].end_time)}
                      </div>
                      <div className="text-xs font-mono text-emerald-700">{trend.falling_periods[0].delta} pts</div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline Card Grid */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">EXPECTED RISK TRAJECTORY</h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {scoredForecast.length} hourly data points — Open-Meteo forecast stream
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {scoredForecast.map((item, idx) => {
                    const isPeak = item.is_peak;
                    return (
                      <div
                        key={idx}
                        className={`relative p-3 rounded-lg border text-center font-mono space-y-1.5 transition ${
                          item.data_label === 'CURRENT OBSERVATION'
                            ? 'bg-slate-900 text-white border-slate-700 ring-2 ring-emerald-400'
                            : isPeak
                            ? `${riskBg(item.risk_level)} ${riskBorder(item.risk_level)} border-2`
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {item.data_label === 'CURRENT OBSERVATION' && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">NOW</div>
                        )}
                        {isPeak && item.data_label !== 'CURRENT OBSERVATION' && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">PEAK</div>
                        )}

                        <div className={`text-[11px] font-bold ${item.data_label === 'CURRENT OBSERVATION' ? 'text-slate-300' : 'text-slate-600'}`}>
                          {formatTime(item.forecast.time)}
                        </div>
                        <div className={`text-xl font-extrabold ${item.data_label === 'CURRENT OBSERVATION' ? 'text-emerald-400' : 'text-slate-900'}`}>
                          {item.risk_score}
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${riskBadge(item.risk_level)}`}>
                          {item.risk_level}
                        </span>
                        <div className={`text-[10px] ${item.data_label === 'CURRENT OBSERVATION' ? 'text-slate-400' : 'text-slate-500'} pt-1 border-t ${item.data_label === 'CURRENT OBSERVATION' ? 'border-slate-700' : 'border-slate-200'} flex items-center justify-center gap-1`}>
                          <span>{item.forecast.temperature}°C</span>
                          <TrendIcon dir={item.trend_direction} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Data label legend */}
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block"></span>
                    CURRENT OBSERVATION
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300 inline-block"></span>
                    FORECAST
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-rose-500" />
                    RISING
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3 text-emerald-500" />
                    FALLING
                  </div>
                </div>
              </div>

              {/* Hourly Detail Table — collapsible */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="w-full flex items-center justify-between p-5 text-xs font-bold font-mono text-slate-500 uppercase hover:bg-slate-50 transition"
                >
                  <span>HOURLY ENVIRONMENTAL CONDITIONS TABLE</span>
                  {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTable && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-left text-xs font-sans min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono uppercase text-[11px]">
                          <th className="py-2.5 px-3">Time</th>
                          <th className="py-2.5 px-3">Label</th>
                          <th className="py-2.5 px-3">Air Temp</th>
                          <th className="py-2.5 px-3">Apparent</th>
                          <th className="py-2.5 px-3">Humidity</th>
                          <th className="py-2.5 px-3">Wind</th>
                          <th className="py-2.5 px-3">Risk Score</th>
                          <th className="py-2.5 px-3">Tier</th>
                          <th className="py-2.5 px-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scoredForecast.map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50 ${item.is_peak ? 'bg-rose-50' : ''} ${item.data_label === 'CURRENT OBSERVATION' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}>
                            <td className="py-2.5 px-3 font-mono font-bold text-xs">{formatTime(item.forecast.time)}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                item.data_label === 'CURRENT OBSERVATION'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {item.data_label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{item.forecast.temperature}°C</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-amber-700">{item.forecast.apparent_temperature}°C</td>
                            <td className="py-2.5 px-3 font-mono text-blue-700">{item.forecast.relative_humidity}%</td>
                            <td className="py-2.5 px-3 font-mono">{item.forecast.wind_speed} km/h</td>
                            <td className="py-2.5 px-3 font-mono font-bold">{item.risk_score}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${riskBadge(item.risk_level)}`}>
                                {item.risk_level}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                <TrendIcon dir={item.trend_direction} />
                                <span className="text-[10px] font-mono">{item.trend_direction}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

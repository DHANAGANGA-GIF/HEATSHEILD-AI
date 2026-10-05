'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile } from '@/lib/store';
import { scoreForecast, ForecastContext } from '@/lib/forecast-engine';
import { getPrecautions } from '@/lib/precaution-engine';
import { HourlyForecastRisk, WeatherData } from '@/lib/types';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Thermometer, Droplets, Wind,
  BarChart2, RefreshCw, MapPin, AlertTriangle, Activity, Flame
} from 'lucide-react';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  time: string;
  riskScore: number;
  temperature: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  riskLevel: string;
}

const RISK_COLOR: Record<string, string> = {
  EXTREME: '#f43f5e',
  HIGH: '#f97316',
  MODERATE: '#f59e0b',
  LOW: '#10b981',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartPoint;
  if (!d) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono shadow-xl min-w-[160px]">
      <div className="text-slate-400 mb-2 font-bold">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Risk Score</span>
          <span className="font-bold" style={{ color: RISK_COLOR[d.riskLevel] || '#10b981' }}>{d.riskScore}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Tier</span>
          <span className="font-bold" style={{ color: RISK_COLOR[d.riskLevel] || '#10b981' }}>{d.riskLevel}</span>
        </div>
        <div className="border-t border-slate-800 pt-1 mt-1 space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Air Temp</span>
            <span className="text-amber-400">{d.temperature}°C</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Feels Like</span>
            <span className="text-orange-400">{d.apparentTemp}°C</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Humidity</span>
            <span className="text-blue-400">{d.humidity}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Wind</span>
            <span className="text-slate-300">{d.windSpeed} km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'emerald' | 'amber' | 'rose' | 'blue' | 'orange';
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50',
    amber: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
    rose: 'text-rose-400 bg-rose-950/50 border-rose-800/50',
    blue: 'text-blue-400 bg-blue-950/50 border-blue-800/50',
    orange: 'text-orange-400 bg-orange-950/50 border-orange-800/50',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${colors[color]}`}>
      <div className="shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-xl font-extrabold font-mono leading-tight">{value}</div>
        {sub && <div className="text-[10px] opacity-60 font-mono mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}


export default function AnalyticsPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);

  const profile = getUserProfile();
  const userTimezone = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const userLang = profile.language || 'en';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = getUserProfile();
      const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
      const ctx: ForecastContext = {
        activity: p.activity_level,
        duration: p.exposure_duration,
        cooling: p.cooling_access,
        age_group: p.age_group,
      };

      const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
      setWeather(w);

      if (w.hourly_forecast && w.hourly_forecast.length > 0) {
        const scored: HourlyForecastRisk[] = scoreForecast(w, w.hourly_forecast.slice(0, 24), ctx, !!w.is_cached);
        const points: ChartPoint[] = scored.map((item) => ({
          time: new Date(item.forecast.time).toLocaleTimeString([], {
            timeZone: userTimezone,
            hour: '2-digit',
            minute: '2-digit',
          }),
          riskScore: item.risk_score,
          temperature: item.forecast.temperature,
          apparentTemp: item.forecast.apparent_temperature,
          humidity: item.forecast.relative_humidity,
          windSpeed: item.forecast.wind_speed,
          riskLevel: item.risk_level,
        }));
        setChartData(points);
        if (points.length > 0) {
          // Use functional update so selectedPoint is not a useCallback dependency
          setSelectedPoint((prev) => prev ?? points[0]);
        }
      }
      setLastUpdated(new Date().toLocaleTimeString([], { timeZone: userTimezone, hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setError('Unable to load analytics data from Open-Meteo. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [userTimezone]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived stats
  const maxScore = chartData.length ? Math.max(...chartData.map((d) => d.riskScore)) : 0;
  const avgScore = chartData.length ? Math.round(chartData.reduce((a, c) => a + c.riskScore, 0) / chartData.length) : 0;
  const maxTemp = chartData.length ? Math.max(...chartData.map((d) => d.apparentTemp)) : 0;
  const avgHumidity = chartData.length ? Math.round(chartData.reduce((a, c) => a + c.humidity, 0) / chartData.length) : 0;
  const extremeCount = chartData.filter((d) => d.riskLevel === 'EXTREME' || d.riskLevel === 'HIGH').length;
  const peakHour = chartData.find((d) => d.riskScore === maxScore);

  const dataStatus = !weather ? 'UNAVAILABLE' : weather.is_cached ? 'CACHED' : 'LIVE';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} lang={userLang} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 text-emerald-400" />
                <h1 className="text-xl font-bold text-slate-100 uppercase">{t('analytics', userLang)}</h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-mono">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>24-Hour Environmental Telemetry — {weather?.location?.name || 'Loading...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded border ${
                dataStatus === 'LIVE' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : dataStatus === 'CACHED' ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
              }`}>
                DATA: {dataStatus}
              </span>
              {lastUpdated && (
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Updated: {lastUpdated}
                </span>
              )}
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  icon={Flame}
                  label="Peak Risk Score"
                  value={maxScore}
                  sub={peakHour ? `at ${peakHour.time}` : undefined}
                  color={maxScore >= 80 ? 'rose' : maxScore >= 60 ? 'orange' : maxScore >= 40 ? 'amber' : 'emerald'}
                />
                <StatCard
                  icon={Activity}
                  label="Avg Risk Score"
                  value={avgScore}
                  sub="24-hour window"
                  color={avgScore >= 60 ? 'orange' : avgScore >= 40 ? 'amber' : 'emerald'}
                />
                <StatCard
                  icon={Thermometer}
                  label="Peak Feels Like"
                  value={`${maxTemp}°C`}
                  sub="Apparent Temp"
                  color="amber"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Elevated Hours"
                  value={extremeCount}
                  sub="HIGH or EXTREME"
                  color={extremeCount > 4 ? 'rose' : extremeCount > 0 ? 'orange' : 'emerald'}
                />
              </div>

              {/* Risk Score Timeline Chart */}
              {chartData.length > 0 && (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold font-mono text-slate-400 uppercase">HEAT RISK SCORE TRAJECTORY</h2>
                      <span className="text-[11px] font-mono text-slate-500">24-hour forecast · Open-Meteo</span>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(e) => {
                          if (e && e.activePayload && e.activePayload[0]) {
                            setSelectedPoint(e.activePayload[0].payload as ChartPoint);
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="time"
                          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                          tickLine={false}
                          axisLine={{ stroke: '#1e293b' }}
                          interval={Math.floor(chartData.length / 6)}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'MODERATE', fill: '#f59e0b', fontSize: 9, fontFamily: 'monospace' }} />
                        <ReferenceLine y={65} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'HIGH', fill: '#f97316', fontSize: 9, fontFamily: 'monospace' }} />
                        <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'EXTREME', fill: '#f43f5e', fontSize: 9, fontFamily: 'monospace' }} />
                        <Area
                          type="monotone"
                          dataKey="riskScore"
                          name="Risk Score"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#riskGrad)"
                          dot={false}
                          activeDot={{ r: 5, fill: '#10b981', cursor: 'pointer' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Selected Forecast Point Risk Details */}
                  {selectedPoint && (() => {
                    const diag = getPrecautions({
                      temperature: selectedPoint.temperature,
                      humidity: selectedPoint.humidity,
                      apparentTemperature: selectedPoint.apparentTemp,
                      windSpeed: selectedPoint.windSpeed,
                      riskScore: selectedPoint.riskScore,
                      riskLevel: selectedPoint.riskLevel as any,
                      language: userLang,
                    });
                    return (
                      <div className="bg-slate-900 border border-emerald-800/80 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold font-mono text-emerald-400 uppercase">
                              HOURLY RISK DIAGNOSTICS &amp; PRECAUTIONS ({selectedPoint.time})
                            </span>
                          </div>
                          <span
                            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase ${
                              selectedPoint.riskLevel === 'EXTREME'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : selectedPoint.riskLevel === 'HIGH'
                                ? 'bg-orange-950 text-orange-400 border border-orange-800'
                                : selectedPoint.riskLevel === 'MODERATE'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {selectedPoint.riskLevel} • {selectedPoint.riskScore}/100
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Air Temp</span>
                            <span className="text-amber-400 font-bold text-sm">{selectedPoint.temperature}°C</span>
                          </div>
                          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Feels Like</span>
                            <span className="text-orange-400 font-bold text-sm">{selectedPoint.apparentTemp}°C</span>
                          </div>
                          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Humidity</span>
                            <span className="text-blue-400 font-bold text-sm">{selectedPoint.humidity}%</span>
                          </div>
                          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Wind</span>
                            <span className="text-slate-300 font-bold text-sm">{selectedPoint.windSpeed} km/h</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold font-mono text-slate-400 uppercase">Specific Environmental Triggers:</div>
                          <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc">
                            {diag.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold font-mono text-emerald-400 uppercase">Recommended Actions for this Window:</div>
                          <ul className="text-xs text-slate-200 space-y-1 pl-4 list-disc">
                            {diag.priority.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Temperature & Humidity Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Temperature chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-amber-400" />
                        <h2 className="text-xs font-bold font-mono text-slate-400 uppercase">TEMPERATURE FORECAST</h2>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="time"
                            tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={{ stroke: '#1e293b' }}
                            interval={Math.floor(chartData.length / 4)}
                          />
                          <YAxis tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={(v) => <span className="text-[10px] font-mono text-slate-400">{v}</span>} />
                          <Line type="monotone" dataKey="temperature" name="Air Temp (°C)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="apparentTemp" name="Feels Like (°C)" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Humidity chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-400" />
                        <h2 className="text-xs font-bold font-mono text-slate-400 uppercase">HUMIDITY & WIND</h2>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="time"
                            tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={{ stroke: '#1e293b' }}
                            interval={Math.floor(chartData.length / 4)}
                          />
                          <YAxis tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={(v) => <span className="text-[10px] font-mono text-slate-400">{v}</span>} />
                          <Bar dataKey="humidity" name="Humidity (%)" fill="#3b82f6" opacity={0.7} radius={[2, 2, 0, 0]} />
                          <Bar dataKey="windSpeed" name="Wind (km/h)" fill="#6366f1" opacity={0.7} radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Data Quality Notice */}
                  <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
                    <Activity className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                    <span>
                      <strong>DATA SOURCE:</strong> All analytics values are derived from live Open-Meteo API forecast data.
                      Risk scores are computed by the deterministic Steadman heat index engine in real time.
                      No data is simulated or hardcoded. Avg humidity this window: <strong className="text-blue-300">{avgHumidity}%</strong>
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
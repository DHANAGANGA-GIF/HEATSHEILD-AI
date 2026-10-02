'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import {
  BookOpen,
  Calculator,
  Flame,
  ShieldCheck,
  BarChart2,
  Cpu,
  Layers,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Sliders,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { calculateHeatIndex, evaluateHeatRisk } from '@/lib/risk-engine';
import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, WeatherData } from '@/lib/types';

export default function MethodologyPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Interactive Live Calculation State for Demonstration
  const [ambientTemp, setAmbientTemp] = useState<number>(36);
  const [humidity, setHumidity] = useState<number>(65);
  const [windSpeed, setWindSpeed] = useState<number>(10);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [duration, setDuration] = useState<ExposureDuration>('moderate');
  const [cooling, setCooling] = useState<CoolingAccess>('limited');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adult');

  // Compute live values using actual risk engine
  const calculationResult = useMemo(() => {
    const heatIndex = calculateHeatIndex(ambientTemp, humidity);
    const mockWeather: WeatherData = {
      location: { name: 'Methodology Interactive Lab', latitude: 13.0827, longitude: 80.2707 },
      temperature: ambientTemp,
      apparent_temperature: Math.round(heatIndex * 10) / 10,
      relative_humidity: humidity,
      wind_speed: windSpeed,
      weather_code: 0,
      pressure: 1012,
      timestamp: new Date().toISOString(),
      is_cached: false,
    };

    const risk = evaluateHeatRisk(mockWeather, {
      activity,
      duration,
      cooling,
      age_group: ageGroup,
    });

    return { heatIndex, risk };
  }, [ambientTemp, humidity, windSpeed, activity, duration, cooling, ageGroup]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-8">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <BookOpen className="w-64 h-64 text-emerald-400" />
            </div>
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold mb-3">
                <Cpu className="w-3.5 h-3.5" />
                ACADEMIC SPECIFICATION & FORMALISMS • V2.0
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Heat Risk Engine Methodology & Mathematical Foundations
              </h1>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Comprehensive architectural specification of HeatShield AI&apos;s two-layer thermal strain model:
                physical Steadman-Rothfusz atmospheric thermodynamics fused with contextual occupational multipliers
                and Directional Explainable AI (XAI).
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-800 text-xs font-mono text-slate-400">
                <span>Model: <strong className="text-emerald-400">Deterministic TypeScript Engine v1.3</strong></span>
                <span>•</span>
                <span>Inference Latency: <strong className="text-slate-200">&lt; 2 ms (Client-Side)</strong></span>
                <span>•</span>
                <span>Availability: <strong className="text-emerald-400">100% Offline Capable</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Navigation Anchor Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <a href="#interactive-lab" className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition text-center group">
              <Calculator className="w-5 h-5 mx-auto text-emerald-400 group-hover:scale-110 transition" />
              <div className="text-xs font-bold text-slate-200 mt-1.5">Interactive Lab</div>
              <div className="text-[10px] text-slate-500 font-mono">Live Parameter Test</div>
            </a>
            <a href="#physical-model" className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition text-center group">
              <Flame className="w-5 h-5 mx-auto text-amber-400 group-hover:scale-110 transition" />
              <div className="text-xs font-bold text-slate-200 mt-1.5">Physical Equations</div>
              <div className="text-[10px] text-slate-500 font-mono">Steadman & Rothfusz</div>
            </a>
            <a href="#context-multipliers" className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition text-center group">
              <Layers className="w-5 h-5 mx-auto text-cyan-400 group-hover:scale-110 transition" />
              <div className="text-xs font-bold text-slate-200 mt-1.5">Context Multipliers</div>
              <div className="text-[10px] text-slate-500 font-mono">NIOSH / OSHA Model</div>
            </a>
            <a href="#ml-reconciliation" className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition text-center group">
              <BarChart2 className="w-5 h-5 mx-auto text-purple-400 group-hover:scale-110 transition" />
              <div className="text-xs font-bold text-slate-200 mt-1.5">ML Reconciliation</div>
              <div className="text-[10px] text-slate-500 font-mono">ERA5-Land vs Runtime</div>
            </a>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 1: INTERACTIVE METHODOLOGY LAB
          ───────────────────────────────────────────────────────────── */}
          <section id="interactive-lab" className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                  <span>Interactive Live Engine Execution & Parameter Lab</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct evaluation of the live production TypeScript engine with full intermediate mathematical trace.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono font-bold rounded">
                LIVE PRODUCTION CODE
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls Column */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    Layer 1: Atmospheric Inputs
                  </h3>

                  {/* Ambient Temp Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Dry-Bulb Ambient Temp (T)</span>
                      <span className="font-mono font-bold text-emerald-400">{ambientTemp}°C ({(ambientTemp * 9/5 + 32).toFixed(1)}°F)</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={50}
                      step={0.5}
                      value={ambientTemp}
                      onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Humidity Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Relative Humidity (RH)</span>
                      <span className="font-mono font-bold text-blue-400">{humidity}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={95}
                      step={1}
                      value={humidity}
                      onChange={(e) => setHumidity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Wind Speed Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Surface Wind Speed (W)</span>
                      <span className="font-mono font-bold text-teal-400">{windSpeed} km/h</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={windSpeed}
                      onChange={(e) => setWindSpeed(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Layer 2: Contextual Multipliers
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Activity Exertion</label>
                      <select
                        value={activity}
                        onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="low">Low (Rest / Light) [×1.00]</option>
                        <option value="moderate">Moderate (Walking / Chores) [×1.15]</option>
                        <option value="high">High (Manual Labor / Athletics) [×1.30]</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Exposure Duration</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value as ExposureDuration)}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="short">&lt; 30 min [×1.00]</option>
                        <option value="moderate">30 min – 2 hrs [×1.10]</option>
                        <option value="long">&gt; 2 hrs [×1.25]</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Cooling Access</label>
                      <select
                        value={cooling}
                        onChange={(e) => setCooling(e.target.value as CoolingAccess)}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="good">Good (AC / Frequent Shade) [×0.85]</option>
                        <option value="limited">Limited (No AC / Direct Sun) [×1.18]</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Age Group</label>
                      <select
                        value={ageGroup}
                        onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="child">Child (&lt; 15 yrs) [×1.10]</option>
                        <option value="adult">Adult (15–64 yrs) [×1.00]</option>
                        <option value="older_adult">Older Adult (65+ yrs) [×1.22]</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Output & Trace Column */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase">Live Evaluation Output</span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded ${
                      calculationResult.risk.risk_level === 'EXTREME' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      calculationResult.risk.risk_level === 'HIGH' ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                      calculationResult.risk.risk_level === 'MODERATE' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {calculationResult.risk.risk_level} RISK
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <div className="text-5xl font-black font-mono text-white">
                      {calculationResult.risk.risk_score}
                    </div>
                    <div className="text-sm font-semibold text-slate-400">/ 100 Composite Score</div>
                  </div>

                  {/* Mathematical Trace Table */}
                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Atmospheric Heat Index (Rothfusz):</span>
                      <span className="text-white font-bold">{calculationResult.heatIndex.toFixed(1)}°C</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Effective Thermal Temperature:</span>
                      <span className="text-white font-bold">{Math.max(ambientTemp, calculationResult.heatIndex).toFixed(1)}°C</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Contextual Compound Multiplier:</span>
                      <span className="text-emerald-400 font-bold">
                        {(
                          (activity === 'high' ? 1.3 : activity === 'moderate' ? 1.15 : 1.0) *
                          (duration === 'long' ? 1.25 : duration === 'moderate' ? 1.1 : 1.0) *
                          (cooling === 'limited' ? 1.18 : 0.85) *
                          (ageGroup === 'older_adult' ? 1.22 : ageGroup === 'child' ? 1.1 : 1.0)
                        ).toFixed(3)}×
                      </span>
                    </div>
                  </div>

                  {/* Directional XAI Attribution Breakdown */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 uppercase font-mono flex items-center justify-between">
                      <span>Directional XAI Factor Drivers</span>
                      <span className="text-slate-500 font-normal">Sum ≈ 100%</span>
                    </div>
                    <div className="space-y-1.5">
                      {calculationResult.risk.explanation?.escalating_factors?.map((f, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {f.name}
                          </span>
                          <span className="text-amber-400 font-mono font-semibold">+{f.weight_percent}%</span>
                        </div>
                      ))}
                      {calculationResult.risk.explanation?.mitigating_factors?.map((f, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {f.name}
                          </span>
                          <span className="text-emerald-400 font-mono font-semibold">-{f.weight_percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300 leading-relaxed">
                    <strong className="text-emerald-400">XAI Summary: </strong>
                    {calculationResult.risk.explanation?.human_readable_summary || 'Analysis computed.'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: PHYSICAL ATMOSPHERIC EQUATIONS
          ───────────────────────────────────────────────────────────── */}
          <section id="physical-model" className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>Layer 1: Atmospheric Thermodynamics & Rothfusz Regression</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mathematical modeling of perceived temperature derived from ambient dry-bulb temperature and relative humidity.
              </p>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-4">
              <p>
                HeatShield AI employs the <strong>National Weather Service (NWS) Rothfusz regression equation</strong>,
                which is an empirical multivariate polynomial approximating Robert G. Steadman&apos;s biometeorological
                model (Steadman, 1979). In temperatures below 20°C, apparent thermal stress equals ambient dry-bulb temperature.
                For higher temperatures, the 16-variable empirical regression is evaluated:
              </p>

              {/* Equation Box */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] sm:text-xs text-emerald-400 overflow-x-auto space-y-1.5 shadow-inner">
                <div className="text-slate-500">{'# Standard NWS Rothfusz Multi-Order Polynomial (Fahrenheit basis)'}</div>
                <div>HI = -42.379 + 2.04901523·T + 10.14333127·RH - 0.22475541·T·RH</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- 0.00683783·T² - 0.05481717·RH² + 0.00122874·T²·RH</div>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.00085282·T·RH² - 0.00000199·T²·RH²</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Arid Atmosphere Adjustment (RH &lt; 13%)
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    When relative humidity drops below 13% with temperatures between 80°F (26.7°C) and 112°F (44.4°C),
                    rapid evaporative sweating alleviates perceived heat:
                  </p>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-cyan-300">
                    ADJ = ((13 - RH) / 4) · √((17 - |T - 95|) / 17)
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Tropical Moisture Barrier Adjustment (RH &gt; 85%)
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    When relative humidity exceeds 85% with temperatures between 80°F (26.7°C) and 87°F (30.6°C),
                    sweat evaporation halts completely, compounding thermal stress:
                  </p>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-blue-300">
                    ADJ = ((RH - 85) / 10) · ((87 - T) / 5)
                  </div>
                </div>
              </div>

              {/* Environmental Score Formula */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-200 text-xs">Base Environmental Stress Score (0–70 Scale)</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The computed effective temperature is mapped non-linearly to an environmental thermal stress baseline,
                  augmented by moisture saturation penalties and attenuated by convective wind ventilation:
                </p>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-emerald-300 space-y-1">
                  <div>BaseScore = envScore(T_effective) + Δ_humidity - Δ_wind</div>
                  <div className="text-slate-500 text-[10px]">{'// Δ_humidity = (RH - 70) · 0.15 (if RH > 70)'}</div>
                  <div className="text-slate-500 text-[10px]">{'// Δ_wind = min(6, (Wind_kmh - 15) · 0.2) (if Wind > 15 km/h)'}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: CONTEXTUAL PHYSIOLOGICAL MULTIPLIERS
          ───────────────────────────────────────────────────────────── */}
          <section id="context-multipliers" className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Layer 2: Contextual Physiological Multipliers (NIOSH / OSHA Aligned)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic mathematical multipliers adjusting atmospheric heat index by metabolic workload and thermoregulatory capacity.
              </p>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-4">
              <p>
                Regional weather stations record ambient shade conditions. However, an individual&apos;s actual heat strain
                is dominated by internal metabolic heat generation, cumulative sun exposure, hydration, and thermoregulatory age.
                HeatShield AI fuses four orthogonal multiplier dimensions:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Multiplier 1 */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-emerald-400 font-mono">1. METABOLIC ACTIVITY</div>
                  <ul className="text-[11px] space-y-1 text-slate-400 font-mono">
                    <li className="flex justify-between"><span>Low (Rest):</span> <span className="text-slate-200">1.00×</span></li>
                    <li className="flex justify-between"><span>Moderate (Walk):</span> <span className="text-slate-200">1.15×</span></li>
                    <li className="flex justify-between"><span>High (Labor):</span> <span className="text-amber-400 font-bold">1.30×</span></li>
                  </ul>
                  <p className="text-[10px] text-slate-500">Accounts for internal heat generation up to 400 W/m².</p>
                </div>

                {/* Multiplier 2 */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-cyan-400 font-mono">2. EXPOSURE DURATION</div>
                  <ul className="text-[11px] space-y-1 text-slate-400 font-mono">
                    <li className="flex justify-between"><span>&lt; 30 min:</span> <span className="text-slate-200">1.00×</span></li>
                    <li className="flex justify-between"><span>30 min – 2h:</span> <span className="text-slate-200">1.10×</span></li>
                    <li className="flex justify-between"><span>&gt; 2 hours:</span> <span className="text-amber-400 font-bold">1.25×</span></li>
                  </ul>
                  <p className="text-[10px] text-slate-500">Accounts for core body heat storage and dehydration.</p>
                </div>

                {/* Multiplier 3 */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-blue-400 font-mono">3. COOLING ACCESS</div>
                  <ul className="text-[11px] space-y-1 text-slate-400 font-mono">
                    <li className="flex justify-between"><span>Good (AC/Shade):</span> <span className="text-emerald-400 font-bold">0.85×</span></li>
                    <li className="flex justify-between"><span>Limited (Direct):</span> <span className="text-rose-400 font-bold">1.18×</span></li>
                  </ul>
                  <p className="text-[10px] text-slate-500">Reflects active recovery facilities and radiant solar shielding.</p>
                </div>

                {/* Multiplier 4 */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-purple-400 font-mono">4. AGE VULNERABILITY</div>
                  <ul className="text-[11px] space-y-1 text-slate-400 font-mono">
                    <li className="flex justify-between"><span>Child (&lt;15):</span> <span className="text-slate-200">1.10×</span></li>
                    <li className="flex justify-between"><span>Adult (15–64):</span> <span className="text-slate-200">1.00×</span></li>
                    <li className="flex justify-between"><span>Senior (65+):</span> <span className="text-rose-400 font-bold">1.22×</span></li>
                  </ul>
                  <p className="text-[10px] text-slate-500">Adjusts for diminished sweat gland function & cardiac workload.</p>
                </div>
              </div>

              {/* Total Calculation Equation */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 text-center">
                TotalScore = clamp(5, round(BaseScore × M_activity × D_duration × C_cooling × A_age), 100)
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: RISK CLASSIFICATION & DECISION TIERS
          ───────────────────────────────────────────────────────────── */}
          <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Risk Classification Tiers & Actionable Operational Guidance</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Standardized 4-tier decision support thresholds aligned with international occupational safety criteria.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Risk Tier</th>
                    <th className="p-3">Score Range</th>
                    <th className="p-3">Physiological Impact</th>
                    <th className="p-3">Recommended Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr className="hover:bg-slate-950/40">
                    <td className="p-3 font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      LOW
                    </td>
                    <td className="p-3 font-mono">0 – 35</td>
                    <td className="p-3">Minimal thermoregulatory strain. Normal perspiration maintains thermal equilibrium.</td>
                    <td className="p-3 text-slate-400">Standard hydration: 250ml/hr. No operational restrictions.</td>
                  </tr>
                  <tr className="hover:bg-slate-950/40">
                    <td className="p-3 font-bold text-amber-400 font-mono flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      MODERATE
                    </td>
                    <td className="p-3 font-mono">36 – 60</td>
                    <td className="p-3">Noticeable fatigue after prolonged exertion. Profuse sweating increases electrolyte depletion.</td>
                    <td className="p-3 text-slate-400">Drink 500ml water/electrolytes hourly. 10-minute shade break every 50 minutes.</td>
                  </tr>
                  <tr className="hover:bg-slate-950/40">
                    <td className="p-3 font-bold text-orange-400 font-mono flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      HIGH
                    </td>
                    <td className="p-3 font-mono">61 – 80</td>
                    <td className="p-3">Severe heat strain. Heat cramps and heat exhaustion probable with continued physical labor.</td>
                    <td className="p-3 text-slate-400">Implement mandatory 15-minute cooling rest cycles every 45 minutes. Shift strenuous activity to morning/evening.</td>
                  </tr>
                  <tr className="hover:bg-slate-950/40">
                    <td className="p-3 font-bold text-rose-400 font-mono flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      EXTREME
                    </td>
                    <td className="p-3 font-mono">81 – 100</td>
                    <td className="p-3">Critical medical emergency risk. Heatstroke imminent with unmitigated outdoor exertion.</td>
                    <td className="p-3 text-slate-400">Halt all non-essential outdoor physical labor. Seek immediate air-conditioned shelter. Monitor for confusion/cessation of sweating.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 5: ML RECONCILIATION & SCIENTIFIC INTEGRITY
          ───────────────────────────────────────────────────────────── */}
          <section id="ml-reconciliation" className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-400" />
                <span>Machine Learning Architecture Reconciliation & Scientific Integrity</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent academic disclosure regarding offline ML research models versus production deterministic runtime.
              </p>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-4">
              <p>
                In strict accordance with academic integrity guidelines for the CSE-AIML 2nd Review, HeatShield AI explicitly
                distinguishes its <strong>offline machine learning research benchmarks</strong> from its <strong>live production runtime</strong>:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-purple-400 font-mono flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Offline Research Pipeline (/ai-engine)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Evaluated against 74,440 ECMWF ERA5-Land reanalysis samples (2021–2024) across 7 atmospheric features.
                    Trained Gradient Boosting, Random Forest, and Decision Tree classifiers with spatial and temporal holdout splits.
                  </p>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                    <div>• GB Temporal Accuracy: <strong className="text-emerald-400">97.86%</strong></div>
                    <div>• Macro F1-Score: <strong className="text-emerald-400">0.8176</strong></div>
                    <div>• Purpose: Offline climate baseline validation</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Production Runtime Engine (Client TypeScript)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Evaluates live Open-Meteo REST atmospheric telemetry fused with user profile parameters using deterministic
                    Steadman-Rothfusz physics and NIOSH occupational multipliers.
                  </p>
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                    <div>• Latency: <strong className="text-emerald-400">&lt; 2 ms</strong> (Instant in-browser)</div>
                    <div>• Privacy: <strong className="text-emerald-400">100% On-Device</strong> (No health data leakage)</div>
                    <div>• Availability: <strong className="text-emerald-400">Offline Capable</strong> via LocalStorage</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-950/30 border border-purple-800/40 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-purple-300">Why Production Does Not Execute Black-Box ML</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Executing a Python ML model server requires constant server round-trips, creating a single point of failure during
                  climate disasters or cellular network brownouts. Furthermore, physical heat index equations are deterministic laws of
                  thermodynamics; replacing well-validated biophysical formulas with an opaque regression would degrade explainability and
                  occupational safety compliance.
                </p>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 6: ACADEMIC & REGULATORY CITATIONS
          ───────────────────────────────────────────────────────────── */}
          <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <span>Academic References & Regulatory Citations</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-300 font-mono">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-emerald-400 font-bold">[1]</span> Steadman, R. G. (1979). <em>The assessment of human heat sensation</em>. Journal of Applied Meteorology and Climatology, 18(7), 861–873.
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-emerald-400 font-bold">[2]</span> Rothfusz, L. P. (1990). <em>The heat index equation (or, more than you ever wanted to know about heat index)</em>. National Oceanic and Atmospheric Administration (NOAA) Technical Attachment SR 90-23.
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-emerald-400 font-bold">[3]</span> National Institute for Occupational Safety and Health (NIOSH). (2016). <em>Criteria for a recommended standard: Occupational exposure to heat and hot environments</em>. DHHS (NIOSH) Publication No. 2016-106.
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-emerald-400 font-bold">[4]</span> Occupational Safety and Health Administration (OSHA). (2021). <em>OSHA Technical Manual (OTM) Section III: Chapter 4 — Heat Stress</em>. U.S. Department of Labor.
              </div>
            </div>
          </section>

          {/* Bottom Action Card */}
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Review System Evidence & Architecture</h3>
              <p className="text-xs text-slate-400 mt-0.5">Inspect automated test reports, security proofs, and live subsystem telemetry.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/evidence"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
              >
                <span>Verification Evidence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/system"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>System Health & Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

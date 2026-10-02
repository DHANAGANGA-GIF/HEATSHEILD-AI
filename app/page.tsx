'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Sun,
  Flame,
  Activity,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BarChart2,
  Globe,
  Database,
  Lock,
  Radio,
  Mail,
  Send,
  Navigation,
  CheckCheck,
  Thermometer,
  Droplets,
  Wind,
  Clock,
  HelpCircle,
  AlertOctagon,
  Sliders,
  MapPin,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';
import { Language, RiskAssessment, RiskLevel, WeatherData } from '@/lib/types';
import { t } from '@/lib/i18n';
import { fetchWeatherData, DEFAULT_LOCATIONS } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { saveUserProfile, getUserProfile } from '@/lib/store';

const PRESET_CITIES = [
  { name: 'Vijayawada', locality: 'Andhra Pradesh, India', latitude: 16.5062, longitude: 80.6480 },
  { name: 'Hyderabad', locality: 'Telangana, India', latitude: 17.3850, longitude: 78.4867 },
  { name: 'Chennai', locality: 'Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707 },
  { name: 'New Delhi', locality: 'Delhi, India', latitude: 28.6139, longitude: 77.2090 },
  { name: 'Mumbai', locality: 'Maharashtra, India', latitude: 19.0760, longitude: 72.8777 },
  { name: 'Bengaluru', locality: 'Karnataka, India', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Kolkata', locality: 'West Bengal, India', latitude: 22.5726, longitude: 88.3639 },
];

export default function LandingPage() {
  const [lang, setLang] = useState<Language>('en');

  // Interactive Risk Check state
  const [selectedCityIndex, setSelectedCityIndex] = useState(0);
  const [activity, setActivity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [duration, setDuration] = useState<'short' | 'moderate' | 'long'>('moderate');
  const [cooling, setCooling] = useState<'good' | 'limited'>('good');
  const [isCustomCoords, setIsCustomCoords] = useState(false);
  const [customLocName, setCustomLocName] = useState('');
  const [customCoords, setCustomCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [calcLoading, setCalcLoading] = useState(false);
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [calculatedRisk, setCalculatedRisk] = useState<RiskAssessment | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [lastCalculatedTime, setLastCalculatedTime] = useState<string | null>(null);

  // Initialize language from stored profile
  useEffect(() => {
    const profile = getUserProfile();
    if (profile.language) {
      setLang(profile.language);
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    saveUserProfile({ language: newLang });
  };

  // Perform public risk calculation using the live rule-based engine
  const handleCalculateRisk = async (useCurrentGeo = false) => {
    setCalcLoading(true);
    setCalcError(null);

    let lat = PRESET_CITIES[selectedCityIndex].latitude;
    let lon = PRESET_CITIES[selectedCityIndex].longitude;
    let locName = PRESET_CITIES[selectedCityIndex].name;

    if (useCurrentGeo && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        locName = 'Approximate Browser Location';
        setIsCustomCoords(true);
        setCustomLocName(locName);
        setCustomCoords({ lat, lon });
      } catch (err: any) {
        // Fall back gracefully to selected preset city
        setCalcError('Could not access device location. Using selected preset city.');
      }
    } else if (isCustomCoords && customCoords) {
      lat = customCoords.lat;
      lon = customCoords.lon;
      locName = customLocName || 'Selected Location';
    }

    try {
      const weather = await fetchWeatherData(lat, lon, locName);
      setLiveWeather(weather);

      const assessment = evaluateHeatRisk(weather, {
        activity,
        duration,
        cooling,
        age_group: 'adult',
      });

      setCalculatedRisk(assessment);
      setLastCalculatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setCalcError('Unable to retrieve current weather from Open-Meteo. Please try again.');
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          STICKY NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <nav className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white font-sans">
              HEATSHIELD <span className="text-emerald-400 font-mono">AI</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
            <a href="#check-risk" className="hover:text-emerald-400 transition">Check Risk</a>
            <a href="#how-it-works" className="hover:text-emerald-400 transition">How It Works</a>
            <Link href="/methodology" className="hover:text-emerald-400 text-emerald-400/90 font-semibold transition">Methodology</Link>
            <Link href="/evidence" className="hover:text-emerald-400 text-emerald-400/90 font-semibold transition">Evidence</Link>
            <Link href="/system" className="hover:text-emerald-400 text-emerald-400/90 font-semibold transition">System</Link>
            <a href="#risk-levels" className="hover:text-emerald-400 transition">Risk Levels</a>
            <a href="#guidance" className="hover:text-emerald-400 transition">Safety Guidance</a>
            <a href="#faq" className="hover:text-emerald-400 transition">FAQ</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5 hidden sm:inline" />
              <select
                value={lang}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
                aria-label="Select Interface Language"
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-slate-900 text-white">English</option>
                <option value="te" className="bg-slate-900 text-white">తెలుగు (Telugu)</option>
                <option value="ta" className="bg-slate-900 text-white">தமிழ் (Tamil)</option>
                <option value="hi" className="bg-slate-900 text-white">हिन्दी (Hindi)</option>
              </select>
            </div>

            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              {t('login', lang)}
            </Link>

            <Link
              href="/dashboard"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5"
            >
              <span>{t('dashboard', lang)}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-mono mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Rule-Based Heat Risk Engine &bull; Non-Clinical Decision Support</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          {t('tagline', lang)}
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          {t('subtitle', lang)}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <a
            href="#check-risk"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{t('check_risk', lang)}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-800 transition flex items-center justify-center gap-2"
          >
            <span>{t('explore_app', lang)}</span>
          </Link>
        </div>

        {/* Operational Highlights */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3.5 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-left font-mono">
          <div className="p-2">
            <div className="text-2xl font-extrabold text-emerald-400">0 – 100</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Consistent Risk Index</div>
          </div>
          <div className="p-2">
            <div className="text-2xl font-extrabold text-amber-400">Open-Meteo</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Public Meteorological Data</div>
          </div>
          <div className="p-2">
            <div className="text-2xl font-extrabold text-sky-400">Rule-Based</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Transparent Calculation</div>
          </div>
          <div className="p-2">
            <div className="text-2xl font-extrabold text-purple-400">Non-Clinical</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Awareness & Support</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. CHECK YOUR HEAT RISK (LIVE INTERACTIVE CALCULATOR)
      ───────────────────────────────────────────────────────────── */}
      <section id="check-risk" className="py-16 bg-slate-900/50 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-mono mb-2">
              <Thermometer className="w-3.5 h-3.5" />
              <span>Public Live Calculation</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Check Your Current Heat Risk
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              Select your location and contextual factors below to compute an immediate heat-risk assessment using real Open-Meteo weather.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            {/* Input Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Location Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase font-mono tracking-wider">
                  Location
                </label>
                <select
                  value={selectedCityIndex}
                  onChange={(e) => {
                    setSelectedCityIndex(Number(e.target.value));
                    setIsCustomCoords(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                >
                  {PRESET_CITIES.map((c, idx) => (
                    <option key={c.name} value={idx}>
                      {c.name} ({c.locality.split(',')[0]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity Level */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase font-mono tracking-wider">
                  Activity Level
                </label>
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="low">Light (Sitting / Resting)</option>
                  <option value="moderate">Moderate (Walking / Commute)</option>
                  <option value="high">Heavy (Manual Work / Sports)</option>
                </select>
              </div>

              {/* Exposure Duration */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase font-mono tracking-wider">
                  Exposure Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="short">Short (&lt; 1 hour)</option>
                  <option value="moderate">Moderate (1 – 3 hours)</option>
                  <option value="long">Long (&gt; 3 hours)</option>
                </select>
              </div>

              {/* Cooling Access */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase font-mono tracking-wider">
                  Cooling Access
                </label>
                <select
                  value={cooling}
                  onChange={(e) => setCooling(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="good">Good (Air Conditioning / Deep Shade)</option>
                  <option value="limited">Limited (Open Sun / Fans only)</option>
                </select>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleCalculateRisk(true)}
                className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 py-1 transition cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Use My Approximate Location</span>
              </button>

              <button
                type="button"
                onClick={() => handleCalculateRisk(false)}
                disabled={calcLoading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
              >
                {calcLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Querying Open-Meteo & Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Thermometer className="w-4 h-4" />
                    <span>Calculate Heat Risk</span>
                  </>
                )}
              </button>
            </div>

            {calcError && (
              <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{calcError}</span>
              </div>
            )}

            {/* Results Display */}
            {calculatedRisk && liveWeather ? (
              <div className="mt-4 p-5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                      LIVE CALCULATION RESULT
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {liveWeather.location.name} &bull; Risk Level: {calculatedRisk.risk_level}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Data Source: Open-Meteo Weather API &bull; Retrieved: {lastCalculatedTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold font-mono text-white">
                      {calculatedRisk.risk_score} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                      calculatedRisk.risk_level === 'EXTREME'
                        ? 'bg-rose-900 text-rose-200'
                        : calculatedRisk.risk_level === 'HIGH'
                        ? 'bg-orange-900 text-orange-200'
                        : calculatedRisk.risk_level === 'MODERATE'
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-emerald-900 text-emerald-200'
                    }`}>
                      {calculatedRisk.risk_level} RISK
                    </span>
                  </div>
                </div>

                {/* Weather Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Air Temp</span>
                    <span className="text-base font-bold text-white">{liveWeather.temperature}°C</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Feels Like</span>
                    <span className="text-base font-bold text-white">{liveWeather.apparent_temperature}°C</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Humidity</span>
                    <span className="text-base font-bold text-white">{liveWeather.relative_humidity}%</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Wind Speed</span>
                    <span className="text-base font-bold text-white">{liveWeather.wind_speed} km/h</span>
                  </div>
                </div>

                {/* Why This Risk Explanation */}
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Why is the risk at this level?</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {calculatedRisk.explanation?.human_readable_summary ?? 'Risk calculated from live weather data and your activity context.'}
                  </p>
                </div>

                {/* Primary Recommendation */}
                <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs">
                  <span className="font-bold text-emerald-300 block mb-0.5">Recommended Immediate Action:</span>
                  <p className="text-slate-200">{calculatedRisk.explanation?.recommended_action ?? 'Take appropriate precautions based on the risk level shown above.'}</p>
                </div>
              </div>
            ) : (
              /* Clearly labeled Sample Preview (Instruction 5: Never claim live risk for static demo) */
              <div className="mt-4 p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      Sample Demonstration Preview
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">&bull; Click &ldquo;Calculate Heat Risk&rdquo; above for live conditions</span>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-semibold">Example Output</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px] block">Sample Conditions</span>
                    <span className="text-sm font-bold text-white font-mono">34.0°C &bull; 65% Humidity</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px] block">Calculated Level</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">MODERATE RISK (54/100)</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px] block">Key Driver</span>
                    <span className="text-sm font-bold text-slate-200">High Humidity + Moderate Work</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. HOW IT WORKS (SIMPLE & HONEST 5 STEPS)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              HOW IT WORKS
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Weather Data &rarr; User Context &rarr; Rule Engine &rarr; Safety Guidance
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              HeatShield AI evaluates real environmental stress alongside what you are actually doing to deliver practical precautions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-left">
            {[
              {
                step: '01',
                title: 'Weather Data',
                desc: 'Retrieves current air temperature, relative humidity, apparent temperature, and wind speed from the open Open-Meteo API.',
              },
              {
                step: '02',
                title: 'User Context',
                desc: 'Considers your physical activity level, outdoor exposure duration, cooling infrastructure access, and age category.',
              },
              {
                step: '03',
                title: 'Rule-Based Engine',
                desc: 'Applies atmospheric Steadman Heat Index equations together with calibrated physiological workload multipliers.',
              },
              {
                step: '04',
                title: 'Transparent Factors',
                desc: 'Identifies which conditions increase risk (such as high humidity) and which provide relief (such as wind breeze).',
              },
              {
                step: '05',
                title: 'Preventive Guidance',
                desc: 'Provides specific hydration goals, shade break intervals, work-rest cycles, and emergency symptom checks.',
              },
            ].map((st, i) => (
              <div key={i} className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition">
                <div className="text-xl font-bold font-mono text-emerald-400 mb-3">{st.step}</div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. RISK LEVEL MEANING (ACTUAL IMPLEMENTED THRESHOLDS)
      ───────────────────────────────────────────────────────────── */}
      <section id="risk-levels" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              RISK SCALE
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Understanding Your Heat Risk Level
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              The 0–100 index uses the actual implemented thresholds of the Rule-Based Heat Risk Engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* LOW */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  SCORE 0 – 35
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase font-mono">LOW</span>
              </div>
              <h3 className="text-base font-bold text-white">Normal Precautions</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Conditions are within typical comfort limits for daily activity. Maintain standard hydration and stay mindful of midday sun.
              </p>
            </div>

            {/* MODERATE */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800">
                  SCORE 36 – 60
                </span>
                <span className="text-xs font-bold text-amber-400 uppercase font-mono">MODERATE</span>
              </div>
              <h3 className="text-base font-bold text-white">Take Additional Precautions</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Elevated thermal strain. Drink water regularly (250–500ml per hour) and take recovery breaks if working outdoors.
              </p>
            </div>

            {/* HIGH */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-orange-950 text-orange-400 border border-orange-800">
                  SCORE 61 – 80
                </span>
                <span className="text-xs font-bold text-orange-400 uppercase font-mono">HIGH</span>
              </div>
              <h3 className="text-base font-bold text-white">Reduce Heat Exposure</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                High heat stress. Reschedule heavy physical labor away from midday hours, rest in shade, and increase electrolyte fluid intake.
              </p>
            </div>

            {/* VERY HIGH / EXTREME */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  SCORE 81 – 100
                </span>
                <span className="text-xs font-bold text-rose-400 uppercase font-mono">VERY HIGH / EXTREME</span>
              </div>
              <h3 className="text-base font-bold text-white">Strong Safety Actions</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Severe thermal strain. Avoid strenuous outdoor activities. Stay in cooled or shaded spaces and check on vulnerable individuals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. WHY THIS RISK? (CLEAR FACTORS)
      ───────────────────────────────────────────────────────────── */}
      <section id="why-this-risk" className="py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              EXPLANATION
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Why Does Heat Risk Increase?
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Heat strain is never just ambient temperature. These specific conditions contribute to a higher heat-risk assessment:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
                <Thermometer className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Air &amp; Apparent Temperature</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                High ambient temperatures transfer external thermal energy to your body, forcing your heart to work harder to circulate blood to the skin.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">High Relative Humidity</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                High humidity prevents sweat from evaporating into the air. When sweat cannot evaporate, your body cannot cool itself effectively.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Physical Workload &amp; Duration</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Strenuous muscular work generates large amounts of internal body heat. Prolonged hours in heat accumulate cardiovascular strain over time.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center max-w-2xl mx-auto">
            <p className="text-xs text-emerald-300">
              <strong>Key takeaway:</strong> When temperature is high, humidity is elevated, and exposure is long, these conditions combine to produce a significantly higher heat-risk assessment.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. PREVENTIVE GUIDANCE (ACTIONABLE & ACCESSIBLE)
      ───────────────────────────────────────────────────────────── */}
      <section id="guidance" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              SAFETY ACTIONS
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Practical Steps to Protect Yourself
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Simple, effective actions based on regional heat awareness practices:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">01</span>
              <h3 className="text-sm font-bold text-white">Consistent Hydration</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Drink 250–500ml of clean water regularly before you feel thirsty. Avoid sugary, highly caffeinated, or alcoholic beverages.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">02</span>
              <h3 className="text-sm font-bold text-white">Regular Shade Rest</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Take periodic recovery breaks in shaded, well-ventilated, or air-conditioned spaces to allow your body temperature to normalize.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">03</span>
              <h3 className="text-sm font-bold text-white">Reschedule Exertion</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Shift heavy outdoor exercise or manual tasks to early morning or late evening when ambient heat and solar radiation are lower.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">04</span>
              <h3 className="text-sm font-bold text-white">Community Check-ins</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Check in on elderly family members, young children, and pets who have less ability to regulate body temperature.
              </p>
            </div>
          </div>

          {/* Emergency Warning Card */}
          <div className="mt-8 p-5 rounded-xl bg-rose-950/30 border border-rose-800/60 max-w-3xl mx-auto flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 leading-relaxed space-y-1">
              <strong className="block font-semibold">Recognize Heat Emergencies:</strong>
              <span>Confusion, fainting, very hot skin, or severe weakness can be signs of a serious heat-related emergency. Move the person to shade immediately, cool with water, and dial local emergency services (108 / 112).</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. REAL PRODUCT PROOF / WORKING APP PREVIEWS
      ───────────────────────────────────────────────────────────── */}
      <section id="product-proof" className="py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              WORKING MODULES
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Real Features in the Working Application
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Explore the actual components available in the logged-in HeatShield AI application:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dashboard Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">MODULE 01</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Active</span>
              </div>
              <h3 className="text-base font-bold text-white">Operational Dashboard</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live heat-risk gauge, weather observation cards, breakdown of driving factors, and personalized preventive action checklists.
              </p>
              <Link href="/dashboard" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                <span>Open Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* What-If Simulator Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">MODULE 02</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Active</span>
              </div>
              <h3 className="text-base font-bold text-white">What-If Risk Simulator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Test how adjusting your workload, exposure time, or cooling availability changes your risk level. Clearly labeled scenario estimates.
              </p>
              <Link href="/simulator" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                <span>Try Simulator</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Forecast Timeline Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">MODULE 03</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Active</span>
              </div>
              <h3 className="text-base font-bold text-white">Forecast Timeline</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                24–48 hour hourly risk projection identifying expected peak heat hours so outdoor activities can be scheduled safely.
              </p>
              <Link href="/timeline" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                <span>View Timeline</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. ALERT / EMAIL FEATURE
      ───────────────────────────────────────────────────────────── */}
      <section id="alerts" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Transactional Alerts</span>
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight leading-snug">
                Personal Email Advisory Dispatch
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                HeatShield AI includes a working transactional email dispatch system that delivers point-in-time heat-risk summaries and precautions directly to your verified inbox.
              </p>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Verified Recipient Only:</strong> Dispatched strictly to the logged-in user&apos;s verified email address to prevent unauthorized relay.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Authoritative Snapshot:</strong> Email contains the exact same weather metrics and risk calculation displayed on your dashboard.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Privacy-by-Design:</strong> Raw GPS coordinates are never exposed in email bodies; only city / locality names are shown.</span>
                </li>
              </ul>
            </div>

            {/* Email Preview Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-[11px] font-mono text-emerald-400 font-bold">EMAIL NOTIFICATION SAMPLE</span>
                <span className="text-[10px] font-mono text-slate-500">HTML Transactional</span>
              </div>
              <div className="text-xs text-slate-300 space-y-2">
                <p><strong>From:</strong> HeatShield AI Advisory &lt;verified-sender&gt;</p>
                <p><strong>Subject:</strong> HeatShield AI &mdash; Moderate Heat Risk Advisory for Vijayawada</p>
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
                  <div className="text-amber-400 font-bold">MODERATE HEAT-RISK ADVISORY (54 / 100)</div>
                  <div className="text-slate-400">Air: 34.2°C &bull; Feels Like: 38.6°C &bull; Humidity: 62%</div>
                  <div className="text-slate-300 font-sans text-xs pt-1 border-t border-slate-800">
                    Hydrate regularly (250–500ml per hour) and rest in shade during peak afternoon hours.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. TECHNOLOGY STACK
      ───────────────────────────────────────────────────────────── */}
      <section id="technology" className="py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              ARCHITECTURE
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Technology Stack
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Built entirely with modern web engineering and open-source tools:
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-emerald-400 block font-bold mb-1">FRONTEND &amp; SSR</span>
              <span className="text-white font-sans font-semibold">Next.js 14 (App Router)</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">React 18 &bull; TypeScript &bull; Tailwind CSS</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-emerald-400 block font-bold mb-1">WEATHER STREAM</span>
              <span className="text-white font-sans font-semibold">Open-Meteo REST API</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">Non-commercial open atmospheric models</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-emerald-400 block font-bold mb-1">AUTH &amp; STORAGE</span>
              <span className="text-white font-sans font-semibold">Firebase + Supabase</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">Secure session cookies &amp; PostgreSQL RLS</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-emerald-400 block font-bold mb-1">EMAIL GATEWAY</span>
              <span className="text-white font-sans font-semibold">Gmail OAuth 2.0</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">Authenticated transactional delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. LIMITATIONS & FUTURE SCOPE
      ───────────────────────────────────────────────────────────── */}
      <section id="limitations" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              HONEST DISCLOSURE
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Current Limitations &amp; Future Scope
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              Scientific honesty is paramount. We explicitly outline what is implemented today and what represents future research:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Current Limitations */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-base font-bold text-amber-400 font-mono">Current Limitations</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                <li><strong>Regional Weather Data:</strong> Weather metrics represent regional grid observations from Open-Meteo, which may not capture hyper-local asphalt radiation or enclosed microclimates.</li>
                <li><strong>Rule-Based Engine:</strong> The active runtime uses mathematical equations (Steadman Heat Index) with contextual multipliers rather than an in-browser live neural network.</li>
                <li><strong>Non-Clinical Scope:</strong> Assessments are for general awareness and decision support. The system does not diagnose heat stroke or medical conditions.</li>
              </ul>
            </div>

            {/* Future Scope */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-base font-bold text-emerald-400 font-mono">Future Scope</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
                <li><strong>Machine Learning-Based Predictive Risk Assessment:</strong> Incorporating verified scikit-learn models (evaluated offline on benchmark datasets) into production runtime once clinical validation data is available.</li>
                <li><strong>Wearable Sensor Integration:</strong> Pairing with consumer smartwatches for continuous heart rate and skin temperature telemetry.</li>
                <li><strong>Wet-Bulb Globe Temperature (WBGT):</strong> Integrating direct black-globe radiation sensors for formal sports and occupational standard compliance.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. FAQ SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white tracking-tight text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4 text-left">
            {[
              {
                q: 'What is HeatShield AI?',
                a: 'HeatShield AI is an open-source heat-risk awareness and decision-support web application designed to help individuals, students, and organizations understand environmental heat stress and take timely preventive actions.',
              },
              {
                q: 'How is heat risk calculated?',
                a: 'Risk is calculated using a Rule-Based Heat Risk Engine. It computes atmospheric Steadman Heat Index equations from ambient temperature and relative humidity, then applies calibrated multipliers for physical activity level, exposure duration, cooling availability, and age vulnerability.',
              },
              {
                q: 'What weather data is used?',
                a: 'HeatShield AI queries current atmospheric weather data from the open-source Open-Meteo API. Observations include air temperature, apparent temperature, relative humidity, and wind speed.',
              },
              {
                q: 'Is HeatShield AI a medical diagnosis tool?',
                a: 'No. HeatShield AI is strictly an environmental decision-support and awareness platform. It does not diagnose heat stroke, prescribe medication, or replace healthcare professionals. In any medical emergency, call 108 or 112 immediately.',
              },
              {
                q: 'How is my location handled?',
                a: 'Location is handled following privacy-by-design principles. You can choose a preset city or permit your browser to provide approximate coordinates. Exact coordinates are rounded for privacy, never sold, and never exposed in email advisory bodies.',
              },
              {
                q: 'Does the application use machine learning?',
                a: 'The active production application utilizes the Rule-Based Heat Risk Engine for transparent, deterministic calculations. Machine learning models (including Gradient Boosting and Random Forest) have been trained and evaluated offline on benchmark data in the development repository as part of our academic future scope research.',
              },
              {
                q: 'Can organizations use HeatShield AI?',
                a: 'Specialized portals for Schools, Worksites, and NGOs are included in the application architecture to support activity guidelines and community hazard reports.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white">{faq.q}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. PRIVACY & SAFETY GOVERNANCE
      ───────────────────────────────────────────────────────────── */}
      <section id="privacy-safety" className="py-16 bg-slate-900/60 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
              <Shield className="w-5 h-5 shrink-0" />
              <span>PRIVACY &amp; SAFETY COMMITMENT</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              HeatShield AI is committed to student and user safety. We collect minimal location data strictly required to fetch meteorological observations. We do not engage in ad tracking or selling user data.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-2 font-mono">
              Non-clinical disclaimer: HeatShield AI provides decision support only. Severe hyperthermic symptoms (fainting, confusion, very hot dry skin) require immediate professional emergency medical care.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          13. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-300 font-sans">HEATSHIELD AI</span>
            <span>&mdash; College Engineering Project</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-sans">
            <Link href="/methodology" className="text-emerald-400 hover:text-emerald-300">Methodology &amp; Math</Link>
            <Link href="/evidence" className="text-emerald-400 hover:text-emerald-300">Evidence &amp; QA</Link>
            <Link href="/system" className="text-emerald-400 hover:text-emerald-300">System Architecture</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms &amp; Disclaimer</Link>
            <Link href="/dashboard" className="hover:text-slate-300">Dashboard</Link>
            <Link href="/help" className="hover:text-slate-300">Help Center</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

/**
 * HeatShield AI V2.2 — Public Landing Page (Client Component)
 *
 * Fully working no-login heat risk checker:
 * - Open-Meteo geocoding search
 * - Browser geolocation with fallback
 * - Real weather fetch via fetchWeatherData()
 * - Real risk calculation via evaluateHeatRisk()
 * - Real forecast scoring via scoreForecast()
 * - Real peak detection via detectPeakRisk()
 * - Data freshness via freshnessFor() / formatAsOf()
 * - Emergency box via emergencyNumber()
 * - Text-to-speech (Listen button, if supported)
 *
 * Rules enforced:
 * - No mock / hardcoded weather values in any user-visible path
 * - "LIVE" label only when freshness === 'fresh'
 * - Risk levels always shown with icon + text (never color-only)
 * - Location not persisted between sessions
 * - Coordinates rounded to DISPLAY_COORD_PRECISION before display
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Thermometer, Droplets, Wind, Navigation, Search,
  RefreshCw, Loader2, AlertTriangle, AlertOctagon, CheckCircle2,
  ChevronDown, ChevronUp, Volume2, VolumeX, MapPin, Clock,
  ArrowRight, Info, Activity, BarChart2, Mail, Globe, HelpCircle,
  Building, Users, X,
} from 'lucide-react';

import {
  fetchWeatherData, searchLocations, reverseGeocode,
  getWeatherConditionText,
} from '@/lib/weather-api';
import { evaluateHeatRisk, calculateHeatIndex } from '@/lib/risk-engine';
import {
  scoreForecast, detectPeakRisk, analyzeForecastTrend,
} from '@/lib/forecast-engine';
import { generatePersonalizedGuidance } from '@/lib/guidance-engine';
import {
  emergencyNumber, freshnessFor, formatAsOf, PILOT_REQUEST_URL,
  DISPLAY_COORD_PRECISION,
} from '@/lib/constants';
import { t } from '@/lib/i18n';
import {
  LocationData, WeatherData, RiskAssessment, RiskLevel,
  HourlyForecastRisk, ForecastTrend, Language,
  ActivityLevel, ExposureDuration, CoolingAccess,
} from '@/lib/types';

// ─── Risk visual config (color + shape + text — never color-only) ─────────────

interface RiskConfig {
  icon: string;        // Unicode shape
  label: string;       // Text label
  color: string;       // CSS hex — for inline style only
  bgClass: string;     // Tailwind bg for badges
  borderClass: string; // Tailwind border for cards
  textClass: string;   // Tailwind text
  scoreRange: string;
  description: string;
}

const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  LOW: {
    icon: '●',
    label: 'LOW',
    color: '#0072B2',
    bgClass: 'bg-blue-950',
    borderClass: 'border-blue-600/40',
    textClass: 'text-blue-300',
    scoreRange: '0 – 35',
    description: 'Normal precautions. Stay hydrated and monitor conditions.',
  },
  MODERATE: {
    icon: '●',
    label: 'MODERATE',
    color: '#E69F00',
    bgClass: 'bg-amber-950',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-300',
    scoreRange: '36 – 60',
    description: 'Take additional precautions. Drink fluids and take rest breaks.',
  },
  HIGH: {
    icon: '▲',
    label: 'HIGH',
    color: '#B84A00',
    bgClass: 'bg-orange-950',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-300',
    scoreRange: '61 – 80',
    description: 'Reduce heat exposure and take preventive action.',
  },
  EXTREME: {
    icon: '◆',
    label: 'EXTREME',
    color: '#8E1B4C',
    bgClass: 'bg-rose-950',
    borderClass: 'border-rose-500/40',
    textClass: 'text-rose-300',
    scoreRange: '81 – 100',
    description: 'Take strong precautions. Limit outdoor exertion immediately.',
  },
};

// ─── Freshness badge ──────────────────────────────────────────────────────────

function FreshnessBadge({ timestamp }: { timestamp?: string | null }) {
  const f = freshnessFor(timestamp);
  const cls =
    f.status === 'fresh'
      ? 'bg-emerald-950 border-emerald-700/60 text-emerald-300'
      : f.status === 'aging'
      ? 'bg-amber-950 border-amber-700/60 text-amber-300'
      : f.status === 'stale'
      ? 'bg-rose-950 border-rose-700/60 text-rose-300'
      : 'bg-slate-800 border-slate-700 text-slate-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${cls}`}
      aria-label={`Data freshness: ${f.label}`}
    >
      <Clock className="w-3 h-3" />
      {f.status === 'fresh' ? 'Current' : f.label}
    </span>
  );
}

// ─── Heat scale ribbon ────────────────────────────────────────────────────────

function HeatScaleRibbon({ heatIndex }: { heatIndex?: number }) {
  // Engine thresholds: LOW≤35, MODERATE 36-60, HIGH 61-80, EXTREME >80 (score-based)
  // We map Heat Index (°C) to a visual position. Approx scale: 20°C = score ~10, 50°C = score ~100
  // Simple linear map: clamp HI to [20, 55] → [0%, 100%]
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const segments = [
    { label: '● LOW', color: '#0072B2', flex: 4 },
    { label: '● MOD', color: '#E69F00', flex: 3 },
    { label: '▲ HIGH', color: '#B84A00', flex: 2 },
    { label: '◆ EXT', color: '#8E1B4C', flex: 1 },
  ];

  let markerPct: number | null = null;
  if (heatIndex !== undefined && !isNaN(heatIndex)) {
    const hi = clamp(heatIndex, 20, 55);
    markerPct = ((hi - 20) / 35) * 100;
  }

  return (
    <div className="space-y-2" aria-label="Heat scale ribbon showing current position">
      <div className="relative h-8 rounded-lg overflow-hidden flex" role="img" aria-label={`Heat scale. ${heatIndex !== undefined ? `Current heat index: ${heatIndex.toFixed(1)}°C` : 'No data yet'}`}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ flex: seg.flex, background: seg.color }}
            className="relative flex items-center justify-center"
          >
            <span className="text-white text-[9px] font-bold font-mono drop-shadow hidden sm:block select-none">
              {seg.label}
            </span>
          </div>
        ))}
        {markerPct !== null && (
          <div
            className="absolute top-0 h-full w-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] z-10 transition-all duration-500"
            style={{ left: `${markerPct}%`, transform: 'translateX(-50%)' }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>Lower Heat Index</span>
        {heatIndex !== undefined && !isNaN(heatIndex) ? (
          <span className="text-slate-300 font-semibold">
            Heat Index: {heatIndex.toFixed(1)}°C
          </span>
        ) : (
          <span className="text-slate-600 italic">Search to see your position</span>
        )}
        <span>Higher Heat Index</span>
      </div>
    </div>
  );
}

// ─── 24-hour forecast strip ───────────────────────────────────────────────────

function ForecastStrip({
  scored,
  peakIdx,
}: {
  scored: HourlyForecastRisk[];
  peakIdx: number;
}) {
  const hourLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: 'numeric', hour12: true });

  return (
    <div className="overflow-x-auto pb-2" role="region" aria-label="24-hour forecast strip">
      <div className="flex gap-2 min-w-max">
        {scored.map((h, i) => {
          const cfg = RISK_CONFIG[h.risk_level];
          const isPeak = i === peakIdx;
          return (
            <div
              key={h.forecast.time}
              className={`flex-shrink-0 w-16 text-center p-2 rounded-lg border transition
                ${isPeak ? 'ring-2 ring-white/30' : ''}
                ${cfg.bgClass} ${cfg.borderClass}`}
              aria-label={`${hourLabel(h.forecast.time)}: ${cfg.icon} ${cfg.label} risk, score ${h.risk_score}`}
            >
              <div className="text-[10px] font-mono text-slate-400">{hourLabel(h.forecast.time)}</div>
              <div
                className="text-base leading-none mt-1 select-none"
                style={{ color: cfg.color }}
                aria-hidden="true"
              >
                {cfg.icon}
              </div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: cfg.color }}>
                {h.risk_score}
              </div>
              <div className="text-[9px] text-slate-500 font-mono">{h.forecast.temperature.toFixed(1)}°</div>
              {isPeak && (
                <div className="text-[9px] text-white font-bold mt-0.5 bg-white/10 rounded px-1">
                  PEAK
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicLanding() {
  const [lang, setLang] = useState<Language>('en');

  // Location search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'requesting' | 'denied' | 'success'>('idle');

  // Context inputs
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [duration, setDuration] = useState<ExposureDuration>('moderate');
  const [cooling, setCooling] = useState<CoolingAccess>('good');

  // Data
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [scored, setScored] = useState<HourlyForecastRisk[]>([]);
  const [trend, setTrend] = useState<ForecastTrend | null>(null);
  const [heatIndex, setHeatIndex] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForecastTable, setShowForecastTable] = useState(false);

  // Speech
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const speakRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Search debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true);
    }
  }, []);

  // ── Core data fetch + calculation ──────────────────────────────────────────

  const runWeatherAndRisk = useCallback(
    async (loc: LocationData, skipCache = false) => {
      setLoading(true);
      setError(null);
      try {
        const w = await fetchWeatherData(loc.latitude, loc.longitude, loc.name, skipCache);
        setWeather(w);

        const hi = calculateHeatIndex(w.temperature, w.relative_humidity);
        setHeatIndex(hi);

        const assessment = evaluateHeatRisk(w, {
          activity,
          duration,
          cooling,
          age_group: 'adult',
        });
        setRisk(assessment);

        const forecasts = w.hourly_forecast || [];
        const scoredForecast = scoreForecast(
          w,
          forecasts,
          { activity, duration, cooling, age_group: 'adult' },
          !!w.is_cached
        );
        setScored(scoredForecast);
        setTrend(analyzeForecastTrend(scoredForecast));
      } catch (err: any) {
        setError(
          'Unable to fetch weather data from Open-Meteo. Please check your connection and try again.'
        );
      } finally {
        setLoading(false);
      }
    },
    [activity, duration, cooling]
  );

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      setNoResults(false);
      return;
    }
    setSearchLoading(true);
    setNoResults(false);
    try {
      const results = await searchLocations(q);
      setSearchResults(results);
      setNoResults(results.length === 0);
    } catch {
      setSearchResults([]);
      setNoResults(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(q), 350);
  };

  const handleSelectLocation = (loc: LocationData) => {
    setSelectedLocation(loc);
    setSearchQuery(`${loc.name}${loc.locality ? ', ' + loc.locality : ''}`);
    setSearchResults([]);
    setNoResults(false);
    runWeatherAndRisk(loc, false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setNoResults(false);
  };

  // ── Geolocation ────────────────────────────────────────────────────────────

  const handleGeolocate = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setError('Browser location is not available on this device.');
      return;
    }
    setGeoState('requesting');
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      setGeoState('success');
      // Round to DISPLAY_COORD_PRECISION before any further use
      const lat = parseFloat(pos.coords.latitude.toFixed(DISPLAY_COORD_PRECISION));
      const lon = parseFloat(pos.coords.longitude.toFixed(DISPLAY_COORD_PRECISION));

      // Reverse geocode to get a proper place name
      let loc: LocationData;
      try {
        loc = await reverseGeocode(lat, lon);
      } catch {
        loc = {
          name: 'Your approximate location',
          latitude: lat,
          longitude: lon,
        };
      }
      setSelectedLocation(loc);
      setSearchQuery(loc.name);
      runWeatherAndRisk(loc, false);
    } catch (err: any) {
      setGeoState('denied');
      if (err?.code === 1) {
        setError(
          'Location permission was denied. You can search for your city manually above.'
        );
      } else {
        setError('Could not determine your location. Please search manually.');
      }
    }
  }, [runWeatherAndRisk]);

  // ── Refresh ────────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    if (!selectedLocation) return;
    runWeatherAndRisk(selectedLocation, true); // skipCache=true forces fresh fetch
  }, [selectedLocation, runWeatherAndRisk]);

  // ── Speech ─────────────────────────────────────────────────────────────────

  const handleListen = useCallback(() => {
    if (!speechSupported || !risk || !weather) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const cfg = RISK_CONFIG[risk.risk_level];
    const guidance = generatePersonalizedGuidance(risk.risk_level, {
      activity, duration, cooling, age_group: 'adult',
    }, weather);
    const topGuidance = guidance.slice(0, 3).map(g => g.simple_text).join('. ');

    const text = [
      `HeatShield AI heat risk assessment for ${weather.location.name}.`,
      `Current risk level: ${cfg.label}. Risk score: ${risk.risk_score} out of 100.`,
      `Air temperature: ${weather.temperature} degrees Celsius.`,
      `Heat index calculated by HeatShield: ${heatIndex?.toFixed(1)} degrees Celsius.`,
      `Relative humidity: ${weather.relative_humidity} percent.`,
      `Recommended actions: ${topGuidance}.`,
      `This is decision support information only. In an emergency, call ${emergencyNumber(weather.location.country)}.`,
    ].join(' ');

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    speakRef.current = utter;
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }, [speechSupported, speaking, risk, weather, heatIndex, activity, duration, cooling]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const freshness = weather ? freshnessFor(weather.timestamp) : null;
  const asOf = weather ? formatAsOf(weather.timestamp) : null;
  const peakRisk = scored.length > 0 ? detectPeakRisk(scored) : null;
  const peakIdx = peakRisk?.index ?? -1;

  // High-or-above risk window
  const highWindow = (() => {
    if (!scored.length) return null;
    const highHours = scored.filter(h => h.risk_level === 'HIGH' || h.risk_level === 'EXTREME');
    if (!highHours.length) return null;
    const firstHigh = highHours[0];
    const lastHigh = highHours[highHours.length - 1];
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (firstHigh.forecast.time === lastHigh.forecast.time) return fmt(firstHigh.forecast.time);
    return `${fmt(firstHigh.forecast.time)} – ${fmt(lastHigh.forecast.time)}`;
  })();

  // Current guidance (3-5 precautions)
  const guidance =
    risk && weather
      ? generatePersonalizedGuidance(risk.risk_level, { activity, duration, cooling, age_group: 'adult' }, weather).slice(0, 5)
      : [];

  const riskCfg = risk ? RISK_CONFIG[risk.risk_level] : null;
  const emergNum = emergencyNumber(weather?.location?.country);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md fixed top-0 w-full z-50"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Shield className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              HEATSHIELD <span className="text-emerald-400 font-mono">AI</span>
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
            <a href="#check-risk" className="hover:text-emerald-400 transition">Check Risk</a>
            <a href="#how-it-works" className="hover:text-emerald-400 transition">How It Works</a>
            <a href="#risk-levels" className="hover:text-emerald-400 transition">Risk Levels</a>
            <a href="#alerts" className="hover:text-emerald-400 transition">Alerts</a>
            <a href="#faq" className="hover:text-emerald-400 transition">FAQ</a>
            <Link href="/methodology" className="hover:text-emerald-400 text-emerald-400/80 font-semibold transition">Methodology</Link>
            <Link href="/evidence" className="hover:text-emerald-400 text-emerald-400/80 font-semibold transition">Evidence</Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5 hidden sm:inline" aria-hidden="true" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                aria-label="Select interface language"
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded cursor-pointer"
              >
                <option value="en" className="bg-slate-900">English</option>
                <option value="te" className="bg-slate-900">తెలుగు</option>
                <option value="ta" className="bg-slate-900">தமிழ்</option>
                <option value="hi" className="bg-slate-900">हिन्दी</option>
              </select>
            </div>
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {t('login', lang)}
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>{t('dashboard', lang)}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-mono mb-6">
          <span>Rule-Based Heat Risk Engine · Open-Meteo Weather · Non-Clinical Decision Support</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          {t('tagline', lang)}
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {t('subtitle', lang)}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <a
            href="#check-risk"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>Check Your Heat Risk — No Login Required</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-800 transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span>{t('explore_app', lang)}</span>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-left font-mono">
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
            <div className="text-xs text-slate-400 mt-1 font-sans">Awareness &amp; Support Only</div>
          </div>
        </div>
      </section>

      {/* ── LIVE CHECKER ────────────────────────────────────────────────── */}
      <section
        id="check-risk"
        className="py-16 bg-slate-900/50 border-t border-slate-800 scroll-mt-20"
        aria-labelledby="checker-heading"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-mono mb-3">
              <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>No login required · Real Open-Meteo data</span>
            </span>
            <h2 id="checker-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Check Your Heat Risk Right Now
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Search for any city, select your situation, and get a real heat-risk assessment — no account needed.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">

            {/* Search row */}
            <div className="space-y-2">
              <label htmlFor="city-search" className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                1. Find Your Location
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="city-search"
                    type="search"
                    role="combobox"
                    value={searchQuery}
                    onChange={handleQueryChange}
                    placeholder="Type a city or town name…"
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 placeholder-slate-600"
                    aria-autocomplete="list"
                    aria-controls="search-results"
                    aria-expanded={searchResults.length > 0}
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" aria-hidden="true" />
                  )}
                </div>
                <button
                  onClick={handleGeolocate}
                  disabled={geoState === 'requesting'}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-sm font-medium transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
                  aria-label="Use my current browser location"
                  title="Use browser location"
                >
                  {geoState === 'requesting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Navigation className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {geoState === 'requesting' ? 'Locating…' : 'Use My Location'}
                  </span>
                </button>
              </div>

              {/* Geo state messages */}
              {geoState === 'denied' && (
                <p className="text-xs text-amber-300 flex items-center gap-1.5" role="alert">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Location permission was denied. Please search manually for your city.
                </p>
              )}

              {/* Search results list */}
              {searchResults.length > 0 && (
                <ul
                  id="search-results"
                  role="listbox"
                  aria-label="Location search results"
                  className="border border-slate-700 rounded-xl bg-slate-950 overflow-hidden divide-y divide-slate-800 shadow-xl"
                >
                  {searchResults.map((loc, i) => (
                    <li key={`${loc.latitude}-${loc.longitude}-${i}`} role="option" aria-selected={false}>
                      <button
                        onClick={() => handleSelectLocation(loc)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-800 transition focus-visible:outline-none focus-visible:bg-slate-800"
                      >
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <div className="text-sm font-semibold text-white">{loc.name}</div>
                          {loc.locality && (
                            <div className="text-xs text-slate-400">{loc.locality}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {noResults && (
                <p className="text-sm text-slate-400 px-1 flex items-center gap-1.5" role="status">
                  <Info className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
                  No matching location found. Try another city or town name.
                </p>
              )}
            </div>

            {/* Context inputs */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                2. Your Situation (Optional — affects risk score)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <label htmlFor="activity-select" className="block text-xs text-slate-400 mb-1.5">Activity Level</label>
                  <select
                    id="activity-select"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="low">Light (sitting / resting)</option>
                    <option value="moderate">Moderate (walking / commute)</option>
                    <option value="high">Heavy (manual work / sports)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="duration-select" className="block text-xs text-slate-400 mb-1.5">Outdoor Duration</label>
                  <select
                    id="duration-select"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as ExposureDuration)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="short">Short (&lt; 1 hour)</option>
                    <option value="moderate">Moderate (1–3 hours)</option>
                    <option value="long">Long (&gt; 3 hours)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cooling-select" className="block text-xs text-slate-400 mb-1.5">Cooling Access</label>
                  <select
                    id="cooling-select"
                    value={cooling}
                    onChange={(e) => setCooling(e.target.value as CoolingAccess)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="good">Good (A/C or deep shade)</option>
                    <option value="limited">Limited (open sun / fans only)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-4 bg-amber-950/60 border border-amber-700/60 rounded-xl text-amber-200 text-sm"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-8 text-slate-400 text-sm" role="status" aria-live="polite">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden="true" />
                <span>Fetching weather from Open-Meteo and calculating heat risk…</span>
              </div>
            )}

            {/* ── RESULTS ─────────────────────────────────────────────── */}
            {!loading && risk && weather && riskCfg && (
              <div className="space-y-5" aria-live="polite" aria-label="Heat risk assessment results">

                {/* Header: location + freshness + refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <span className="text-base font-bold text-white">{weather.location.name}</span>
                      {weather.location.locality && (
                        <span className="text-sm text-slate-400">{weather.location.locality}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
                      <FreshnessBadge timestamp={weather.timestamp} />
                      {asOf && <span>{asOf}</span>}
                      <span>· Source: Open-Meteo</span>
                      {weather.is_fallback && (
                        <span className="text-amber-400 font-semibold">
                          · ⚠ Fallback estimate — weather service unavailable
                        </span>
                      )}
                      {weather.is_cached && !weather.is_fallback && (
                        <span className="text-slate-400">· Cached</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 self-start sm:self-auto"
                    aria-label="Refresh weather data"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Refresh Weather</span>
                  </button>
                </div>

                {/* Risk score display */}
                <div
                  className={`rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${riskCfg.bgClass} ${riskCfg.borderClass}`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Heat Risk Assessment · Rule-Based Engine
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-4xl font-bold select-none leading-none"
                        style={{ color: riskCfg.color }}
                        aria-hidden="true"
                      >
                        {riskCfg.icon}
                      </span>
                      <div>
                        <div
                          className="text-2xl font-extrabold font-mono"
                          style={{ color: riskCfg.color }}
                        >
                          {riskCfg.label} RISK
                        </div>
                        <div className="text-sm text-slate-300">{riskCfg.description}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-4xl font-extrabold font-mono text-white">
                      {risk.risk_score}
                      <span className="text-sm font-normal text-slate-400"> / 100</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Score range: {riskCfg.scoreRange}
                    </div>
                  </div>
                </div>

                {/* Heat Scale */}
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Heat Scale
                  </div>
                  <HeatScaleRibbon heatIndex={heatIndex} />
                </div>

                {/* Weather cards — Heat Index vs Feels-Like clearly separated */}
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Current Conditions
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      {
                        icon: <Thermometer className="w-4 h-4" aria-hidden="true" />,
                        label: 'Air Temperature',
                        value: `${weather.temperature.toFixed(1)}°C`,
                        note: 'From Open-Meteo',
                      },
                      {
                        icon: <Thermometer className="w-4 h-4 text-orange-400" aria-hidden="true" />,
                        label: 'Heat Index',
                        value: heatIndex !== undefined ? `${heatIndex.toFixed(1)}°C` : '—',
                        note: 'Calculated by HeatShield (Steadman/Rothfusz)',
                      },
                      {
                        icon: <Thermometer className="w-4 h-4 text-amber-400" aria-hidden="true" />,
                        label: 'Feels-Like',
                        value: `${weather.apparent_temperature.toFixed(1)}°C`,
                        note: 'Open-Meteo apparent temperature',
                      },
                      {
                        icon: <Droplets className="w-4 h-4 text-sky-400" aria-hidden="true" />,
                        label: 'Humidity',
                        value: `${weather.relative_humidity}%`,
                        note: 'Relative humidity',
                      },
                      {
                        icon: <Wind className="w-4 h-4 text-slate-400" aria-hidden="true" />,
                        label: 'Wind',
                        value: `${weather.wind_speed.toFixed(1)} km/h`,
                        note: 'Wind speed at 10m',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl"
                        title={card.note}
                      >
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          {card.icon}
                          <span className="text-[10px] font-mono uppercase tracking-wide">{card.label}</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-white">{card.value}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{card.note}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 font-mono">
                    Note: Heat Index (HeatShield calculation) and Feels-Like (Open-Meteo apparent temperature) use different formulas and may differ.
                  </p>
                </div>

                {/* Why this risk */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm space-y-1.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Info className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Why is the risk at this level?</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    {risk.explanation?.human_readable_summary ??
                      'Risk calculated from live weather data and your activity context.'}
                  </p>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Engine: {risk.model_version} · Data quality: {risk.data_quality}
                  </div>
                </div>

                {/* Precautions — conditional, 3-5 items */}
                {guidance.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      Recommended Actions
                    </div>
                    <ul className="space-y-2">
                      {guidance.map((g, i) => (
                        <li
                          key={g.id}
                          className="flex items-start gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-sm"
                        >
                          <span
                            className="text-xs font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: riskCfg.color, color: '#fff' }}
                            aria-hidden="true"
                          >
                            {i + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-200 text-xs">{g.title}</div>
                            <div className="text-slate-400 text-xs mt-0.5 leading-relaxed">{g.simple_text}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 24-hour forecast */}
                {scored.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                        24-Hour Forecast
                      </div>
                      {peakRisk && (
                        <div className="text-xs font-mono text-slate-400">
                          Peak:{' '}
                          <span className="font-bold text-white">
                            {new Date(peakRisk.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          {' · '}
                          <span
                            className="font-bold"
                            style={{ color: RISK_CONFIG[peakRisk.level].color }}
                          >
                            {RISK_CONFIG[peakRisk.level].icon} {peakRisk.level} ({peakRisk.score})
                          </span>
                        </div>
                      )}
                    </div>

                    {highWindow && (
                      <div className="text-xs p-2.5 bg-orange-950/40 border border-orange-700/40 rounded-lg text-orange-300 font-mono">
                        ▲ High-or-above risk window: <strong>{highWindow}</strong>
                        <span className="text-orange-500 ml-1">· Avoid prolonged outdoor exposure during this period</span>
                      </div>
                    )}

                    <ForecastStrip scored={scored} peakIdx={peakIdx} />

                    {/* Collapsible full forecast table */}
                    <details>
                      <summary
                        className="cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1.5 list-none select-none py-1"
                        aria-label="Toggle full 24-hour forecast table"
                      >
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        Full forecast table (24 hours)
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-xs font-mono text-left min-w-[500px]" aria-label="Full 24-hour forecast data table">
                          <thead className="bg-slate-900 text-slate-400">
                            <tr>
                              <th scope="col" className="px-3 py-2">Time</th>
                              <th scope="col" className="px-3 py-2">Temp (°C)</th>
                              <th scope="col" className="px-3 py-2">Humidity (%)</th>
                              <th scope="col" className="px-3 py-2">Feels-Like (°C)</th>
                              <th scope="col" className="px-3 py-2">Wind (km/h)</th>
                              <th scope="col" className="px-3 py-2">Risk Score</th>
                              <th scope="col" className="px-3 py-2">Risk Level</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {scored.map((h, i) => {
                              const cfg = RISK_CONFIG[h.risk_level];
                              return (
                                <tr
                                  key={h.forecast.time}
                                  className={i === peakIdx ? 'bg-slate-800/60' : 'hover:bg-slate-900/40'}
                                >
                                  <td className="px-3 py-2 text-slate-300">
                                    {new Date(h.forecast.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    {i === peakIdx && (
                                      <span className="ml-1 text-white font-bold">(Peak)</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-white">{h.forecast.temperature.toFixed(1)}</td>
                                  <td className="px-3 py-2 text-slate-300">{h.forecast.relative_humidity}</td>
                                  <td className="px-3 py-2 text-slate-300">{h.forecast.apparent_temperature.toFixed(1)}</td>
                                  <td className="px-3 py-2 text-slate-300">{h.forecast.wind_speed.toFixed(1)}</td>
                                  <td className="px-3 py-2 font-bold text-white">{h.risk_score}</td>
                                  <td className="px-3 py-2 font-bold" style={{ color: cfg.color }}>
                                    <span aria-label={`${cfg.icon} ${cfg.label}`}>
                                      {cfg.icon} {cfg.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="text-[10px] text-slate-600 font-mono px-3 py-2">
                          All values from Open-Meteo hourly forecast. Risk calculated by HeatShield rule-based engine using same context settings above.
                        </p>
                      </div>
                    </details>
                  </div>
                )}

                {/* Emergency box */}
                <div
                  role="complementary"
                  aria-label="Emergency information"
                  className="flex items-start gap-3 p-4 bg-rose-950/40 border border-rose-700/60 rounded-xl"
                >
                  <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-rose-300">
                      If someone shows signs of heat emergency — confusion, fainting, very hot skin, or severe weakness — seek medical help immediately.
                    </p>
                    <p className="text-rose-400/80 text-xs">
                      Emergency number for {weather.location.country || 'this country'}:{' '}
                      <strong className="text-white text-base font-mono">{emergNum}</strong>
                    </p>
                    <p className="text-rose-600 text-xs">
                      HeatShield AI is decision-support software only. It does not diagnose medical conditions.
                    </p>
                  </div>
                </div>

                {/* Listen button */}
                {speechSupported && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleListen}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label={speaking ? 'Stop reading aloud' : 'Read risk and precautions aloud'}
                      aria-pressed={speaking}
                    >
                      {speaking ? (
                        <>
                          <VolumeX className="w-4 h-4" aria-hidden="true" />
                          <span>Stop Reading</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" aria-hidden="true" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Empty state — before any search */}
            {!loading && !risk && !error && (
              <div className="py-8 text-center space-y-3 border-t border-slate-800">
                <div className="text-3xl select-none" aria-hidden="true">🌡️</div>
                <p className="text-slate-400 text-sm">
                  Search for a city or use your browser location above to get a real heat-risk assessment.
                </p>
                <p className="text-slate-600 text-xs font-mono">
                  No authentication required · Location not stored
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-2">
              HOW IT WORKS
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Four Simple Steps from Weather to Safety Guidance
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: <Globe className="w-5 h-5" aria-hidden="true" />,
                title: 'Get Weather',
                desc: 'Current air temperature, relative humidity, apparent temperature, and wind speed are fetched from Open-Meteo for your selected location.',
              },
              {
                step: '02',
                icon: <Activity className="w-5 h-5" aria-hidden="true" />,
                title: 'Understand Context',
                desc: 'Your physical activity level, outdoor exposure duration, and access to cooling are taken into account, as they change how your body handles heat.',
              },
              {
                step: '03',
                icon: <BarChart2 className="w-5 h-5" aria-hidden="true" />,
                title: 'Calculate Heat Risk',
                desc: 'The rule-based engine computes a Steadman/Rothfusz Heat Index, then applies calibrated multipliers for activity, duration, and cooling to produce a 0–100 risk score.',
              },
              {
                step: '04',
                icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" />,
                title: 'Provide Precautions',
                desc: 'Only the precautions that match the actual risk level and your situation are shown — not a generic paragraph that applies to everyone.',
              },
            ].map((st) => (
              <div
                key={st.step}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold font-mono text-emerald-400">{st.step}</span>
                  <span className="text-emerald-400">{st.icon}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RISK LEVELS TABLE ────────────────────────────────────────────── */}
      <section id="risk-levels" className="py-20 bg-slate-900/40 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-2">
              RISK SCALE
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Understanding Your Heat Risk Level
            </p>
            <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto">
              These thresholds are the actual values used by the HeatShield AI rule-based engine. Direct sunlight, physical condition, and individual health factors can change personal risk.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(Object.entries(RISK_CONFIG) as [RiskLevel, RiskConfig][]).map(([level, cfg]) => (
              <div
                key={level}
                className={`p-6 rounded-2xl bg-slate-900 border space-y-3 ${cfg.borderClass}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-2xl font-bold select-none"
                    style={{ color: cfg.color }}
                    aria-hidden="true"
                  >
                    {cfg.icon}
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: cfg.color + '22', color: cfg.color }}>
                    SCORE {cfg.scoreRange}
                  </span>
                </div>
                <h3 className="text-base font-bold" style={{ color: cfg.color }}>{cfg.label}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{cfg.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-slate-600 font-mono max-w-xl mx-auto">
            These thresholds apply to HeatShield AI&apos;s 0–100 risk score. They are not an official medical classification.
            For official heat advisories, follow your national meteorological authority (e.g. IMD for India).
          </p>
        </div>
      </section>

      {/* ── ALERTS ──────────────────────────────────────────────────────── */}
      <section id="alerts" className="py-20 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                <Mail className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Email Alerts</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Personal Heat-Risk Email Alerts
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Registered users can receive automated email alerts when heat risk reaches their chosen threshold. Alerts contain the same weather metrics and risk calculation shown on the dashboard — nothing invented.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>Email alerts:</strong> Available now for registered users via HeatShield notification service.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>SMS alerts:</strong> <span className="text-slate-500">Planned — not yet implemented.</span></span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span><strong>WhatsApp / Voice:</strong> <span className="text-slate-500">Planned — not yet implemented.</span></span>
                </li>
              </ul>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Sign In to Enable Alerts</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-[11px] font-mono text-emerald-400 font-bold">EMAIL ALERT SAMPLE</span>
                <span className="text-[10px] font-mono text-slate-500">Authenticated users only</span>
              </div>
              <div className="text-xs text-slate-300 space-y-2">
                <p><strong>Subject:</strong> HeatShield AI — Moderate Heat Risk Advisory for Vijayawada</p>
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
                  <div className="text-amber-400 font-bold">● MODERATE HEAT RISK (54 / 100)</div>
                  <div className="text-slate-400">Air: 34.2°C · Heat Index: 38.1°C · Humidity: 62%</div>
                  <div className="text-slate-300 font-sans text-xs pt-2 border-t border-slate-800">
                    Drink water regularly (250–500ml per hour) and take breaks in shaded areas during peak afternoon hours.
                  </div>
                  <div className="text-slate-600 text-[10px]">Source: Open-Meteo · HeatShield rule-based engine</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ORGANISATIONS ───────────────────────────────────────────────── */}
      <section id="organisations" className="py-20 bg-slate-900/40 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-2">
              FOR ORGANISATIONS
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Specialised Portals for Schools, Worksites, and NGOs
            </p>
            <p className="mt-3 text-sm text-slate-400">
              HeatShield AI includes dedicated portals for organisations that manage groups of people in heat-prone environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Building className="w-6 h-6" aria-hidden="true" />,
                title: 'School Portal',
                desc: 'Campus heat-risk monitoring to support student safety during outdoor activities and sports.',
                href: '/school',
                status: 'Active',
              },
              {
                icon: <Activity className="w-6 h-6" aria-hidden="true" />,
                title: 'Worksite Safety',
                desc: 'Heat-risk tracking for outdoor workers with shift scheduling and exposure awareness.',
                href: '/worksite',
                status: 'Active',
              },
              {
                icon: <Users className="w-6 h-6" aria-hidden="true" />,
                title: 'NGO Portal',
                desc: 'Community hazard reporting and broadcast alerts for vulnerable populations.',
                href: '/ngo',
                status: 'Active',
              },
            ].map((org) => (
              <div
                key={org.title}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400">{org.icon}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {org.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{org.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{org.desc}</p>
                <Link
                  href={org.href}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
                >
                  <span>Open Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>

          {/* Pilot request */}
          <div className="mt-10 p-6 rounded-2xl bg-slate-900 border border-slate-700 text-center max-w-xl mx-auto space-y-3">
            <h3 className="text-base font-bold text-white">Want HeatShield AI for your organisation?</h3>
            <p className="text-xs text-slate-400">
              Contact us to discuss a pilot deployment for your school, factory, or community organisation.
            </p>
            {PILOT_REQUEST_URL ? (
              <a
                href={PILOT_REQUEST_URL}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Request a Pilot
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-500 rounded-xl font-semibold text-sm cursor-not-allowed border border-slate-700" aria-disabled="true">
                Request a Pilot — Contact configuration required
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── DATA SOURCES & LIMITATIONS ──────────────────────────────────── */}
      <section id="data-sources" className="py-20 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-2">
              DATA SOURCES &amp; LIMITATIONS
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Honest About What This System Does and Does Not Do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-emerald-400 font-mono">What HeatShield AI does</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  Fetches real meteorological data from Open-Meteo (free, open, non-commercial)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  Calculates a Heat Index using the published Steadman/Rothfusz equations
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  Applies a deterministic rule-based multiplier for activity, duration, and cooling access
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  Shows transparent calculations with a source and timestamp on every result
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  Provides contextual, conditional safety precautions (not a generic paragraph)
                </li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-amber-400 font-mono">What HeatShield AI does NOT do</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  Does not diagnose heat stroke, heat exhaustion, or any medical condition
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  Does not replace official heat advisories from IMD or national weather authorities
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  Does not measure street-level or indoor conditions (uses regional model data)
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  Does not use live neural network inference in production (rule-based only; ML is future scope)
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  Does not account for direct solar radiation or radiant heat from asphalt
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-500 font-mono text-center">
            Weather data source: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-500">open-meteo.com</a> (free, non-commercial, open atmospheric models) ·
            Geocoding: Open-Meteo Geocoding API + OpenStreetMap Nominatim ·
            Risk engine: Steadman/Rothfusz Heat Index + contextual multipliers (v1.4)
          </div>
        </div>
      </section>

      {/* ── PRIVACY ─────────────────────────────────────────────────────── */}
      <section id="privacy" className="py-16 bg-slate-900/60 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
              <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>PRIVACY SUMMARY</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
              <div className="space-y-2">
                <p><strong className="text-white">Public checker:</strong> Your location is used only to fetch weather data for the current session. It is not stored in a database between sessions. Browser location coordinates are rounded to approximately 1 km precision before use.</p>
                <p><strong className="text-white">No advertising:</strong> HeatShield AI does not use advertising networks or sell user data.</p>
              </div>
              <div className="space-y-2">
                <p><strong className="text-white">Authenticated users:</strong> If you create an account, your chosen location is saved to your profile for dashboard use. This is separate from the public checker.</p>
                <p><strong className="text-white">Emails:</strong> Alert emails show your city or locality name — not exact coordinates. Exact GPS coordinates are never included in email bodies.</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-4 text-xs">
              <Link href="/privacy" className="text-emerald-400 hover:underline">Full Privacy Policy</Link>
              <Link href="/terms" className="text-slate-400 hover:underline">Terms of Service</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 border-t border-slate-800 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'What is HeatShield AI?',
                a: 'HeatShield AI is an open-source heat-risk awareness and decision-support application that helps individuals, students, and organisations understand environmental heat stress and take preventive action. It uses real weather data and a transparent rule-based calculation.',
              },
              {
                q: 'Where does the weather data come from?',
                a: 'Weather data (air temperature, apparent temperature, relative humidity, wind speed) is fetched from Open-Meteo, a free, open-source meteorological data service. The data represents regional model output, not a physical street-level sensor.',
              },
              {
                q: 'Is this a medical diagnosis?',
                a: 'No. HeatShield AI is strictly a decision-support and awareness tool. It does not diagnose heat stroke, heat exhaustion, or any medical condition. In any suspected heat emergency, call your local emergency number immediately.',
              },
              {
                q: 'How is heat risk calculated?',
                a: 'The Heat Index is calculated using the Steadman/Rothfusz equations from air temperature and relative humidity. The engine then applies calibrated multipliers for physical activity level, outdoor exposure duration, and access to cooling to produce a 0–100 risk score. The full methodology is documented on the Methodology page.',
              },
              {
                q: 'Does it require login?',
                a: 'No. The public heat risk checker on this page requires no login. Creating a free account gives you access to a personal dashboard, saved location, and email alerts.',
              },
              {
                q: 'Does it store my location?',
                a: 'The public checker does not persist your location between sessions. If you create an account and save a location, it is stored in your profile. Browser GPS coordinates are rounded to approximately 1 km precision before any weather requests.',
              },
              {
                q: 'What happens if weather data is unavailable?',
                a: 'If the Open-Meteo API is unreachable, HeatShield AI will use a cached result if one is available. If no cache exists, it will show an emergency fallback estimate and clearly label it as "Unavailable" so you know the data is not current.',
              },
              {
                q: 'Can I receive email alerts?',
                a: 'Yes. Signed-in users can connect their Gmail account and enable automated hourly heat-risk email alerts. Alerts are sent only to the verified email on your account.',
              },
            ].map((faq, idx) => (
              <details
                key={idx}
                className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
              >
                <summary className="cursor-pointer flex items-center justify-between list-none">
                  <h3 className="text-sm font-bold text-white pr-4">{faq.q}</h3>
                  <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform shrink-0" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-xs text-slate-400 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span className="font-bold text-slate-300 font-sans">HEATSHIELD AI</span>
              <span>— College Engineering Project · Non-Clinical Decision Support</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-sans text-[11px]">
              <Link href="/methodology" className="text-emerald-500 hover:text-emerald-400">Methodology</Link>
              <Link href="/evidence" className="text-emerald-500 hover:text-emerald-400">Evidence</Link>
              <Link href="/system" className="text-emerald-500 hover:text-emerald-400">System</Link>
              <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-300">Terms</Link>
              <Link href="/dashboard" className="hover:text-slate-300">Dashboard</Link>
              <Link href="/help" className="hover:text-slate-300">Help</Link>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-900 text-[10px] text-slate-700 space-y-1">
            <p>Weather data: Open-Meteo (open-meteo.com) · Geocoding: Open-Meteo Geocoding API + OpenStreetMap Nominatim</p>
            <p>HeatShield AI is decision-support software only. It does not constitute medical advice. Follow official IMD or national authority guidance for heat warnings.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

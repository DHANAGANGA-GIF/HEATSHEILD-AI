'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { HeatGauge } from '@/components/HeatGauge';
import { WeatherCard } from '@/components/WeatherCard';
import { RiskDrivers } from '@/components/RiskDrivers';
import { GuidanceList } from '@/components/GuidanceList';
import { AiAssistant } from '@/components/AiAssistant';
import { LocationStatusBar } from '@/components/LocationStatusBar';
import { LocationSelector } from '@/components/LocationSelector';
import { SystemStatusPanel, SystemStatusValue } from '@/components/SystemStatusPanel';
import { fetchWeatherData } from '@/lib/weather-api';
import { evaluateHeatRisk } from '@/lib/risk-engine';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { LocationSource } from '@/lib/constants';
import { Language, LocationData, RiskAssessment, TechMode, WeatherData, UserProfile } from '@/lib/types';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import { Clock, Sliders, MessageSquare, ArrowRight, ChevronDown, ChevronUp, Radio, BookOpen, FileCheck, Cpu } from 'lucide-react';
import { RealtimeLiveLocationTracker } from '@/components/RealtimeLiveLocationTracker';
import { RealtimeBroadcastCommandCenter } from '@/components/RealtimeBroadcastCommandCenter';
import { useAuth } from '@/lib/firebase/auth-context';

export default function DashboardPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [techMode, setTechMode] = useState<TechMode>('technical');
  const { firebaseUser, appProfile, isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => appProfile || getUserProfile());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>('DEFAULT');
  const [authStatus, setAuthStatus] = useState<SystemStatusValue>('AUTHENTICATED');
  
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestSeqRef = useRef<number>(0);

  // Sync profile when Firebase auth resolves
  useEffect(() => {
    if (appProfile) {
      setProfile(appProfile);
    }
  }, [appProfile]);

  // RACE-CONDITION & STALE REQUEST PROTECTED DATA LOADER
  const loadData = useCallback(async (loc: LocationData) => {
    const currentSeq = ++requestSeqRef.current;
    setLoading(true);
    const p = appProfile || getUserProfile();
    setProfile(p);
    
    const wData = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);

    // RACE CONDITION GUARD: Discard out-of-order stale responses
    if (currentSeq !== requestSeqRef.current) {
      return;
    }

    setWeather(wData);
    const rData = evaluateHeatRisk(wData, {
      activity: p.activity_level,
      duration: p.exposure_duration,
      cooling: p.cooling_access,
      age_group: p.age_group,
    });
    setRisk(rData);
    setLoading(false);
  }, [appProfile]);

  const loadDashboardData = useCallback(async () => {
    const p = appProfile || getUserProfile();
    const loc = p.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
    await loadData(loc);
  }, [appProfile, loadData]);

  useEffect(() => {
    if (!authLoading) {
      const isAuthed = isAuthenticated || profile.authenticated;
      setAuthStatus(isAuthed ? 'AUTHENTICATED' : 'SIGNED OUT');
    }
  }, [authLoading, isAuthenticated, profile.authenticated]);

  useEffect(() => {
    loadDashboardData();

    // 15-minute auto-refresh to maintain live data freshness
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
    refreshIntervalRef.current = setInterval(() => {
      loadDashboardData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [loadDashboardData]);

  const handleLocationChange = async (loc: LocationData, source: LocationSource) => {
    setLocationSource(source);
    saveUserProfile({ location: loc });
    await loadData(loc);
  };

  const currentLocation = profile.location || { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };

  // Determine active language from profile (preferred_language wins, then language)
  const lang: Language = (appProfile?.preferred_language || appProfile?.language || profile.preferred_language || profile.language || 'en') as Language;

  // Derive display identity from authenticated user
  const displayUserName = firebaseUser?.displayName || appProfile?.name || (firebaseUser?.email ? firebaseUser.email.split('@')[0] : 'User');
  const displayUserEmail = firebaseUser?.email || appProfile?.email || '';
  const displayRole = (appProfile?.role || profile.role || 'user').toUpperCase();

  // Calculate weather freshness & stale protection
  const weatherAgeMins = weather ? Math.floor((Date.now() - new Date(weather.timestamp).getTime()) / 60000) : 0;
  const isStale = weatherAgeMins > 15;

  const dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'FALLBACK' = weather
    ? weather.is_fallback ? 'FALLBACK'
    : weather.is_cached || isStale ? 'CACHED'
    : 'LIVE'
    : loading ? 'LIVE' : 'UNAVAILABLE';

  const lastUpdatedLabel = weather
    ? isStale
      ? `Stale (Updated ${weatherAgeMins}m ago)`
      : `Updated ${new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  // Derive system status panel values
  const weatherSysStatus: SystemStatusValue = loading
    ? 'LOADING'
    : weather?.is_fallback ? 'FALLBACK'
    : weather?.is_cached || isStale ? 'CACHED'
    : weather ? 'LIVE'
    : 'UNAVAILABLE';
    
  const forecastSysStatus: SystemStatusValue = weather?.hourly_forecast?.length
    ? weather.is_cached || isStale ? 'CACHED' : 'LIVE'
    : 'UNAVAILABLE';

  const alertsSysStatus: SystemStatusValue = 'ACTIVE';
  const aiSysStatus: SystemStatusValue = risk ? 'READY' : 'UNAVAILABLE';
  const locationSysStatus: SystemStatusValue =
    locationSource === 'GPS' ? 'GPS'
    : locationSource === 'CAMPUS' ? 'CAMPUS'
    : locationSource === 'DEFAULT' ? 'LIVE'
    : 'MANUAL';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        techMode={techMode}
        onToggleTechMode={setTechMode}
      />

      <div className="flex-1 flex">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          lang={lang}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Dashboard Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-xl border border-slate-800">
            <div>
              <h1 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                {t('operational_dashboard', lang)}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {t('contextual_assessment_for', lang)} <span className="font-semibold text-slate-200">{displayUserName}</span> {displayUserEmail ? <span className="text-slate-500">({displayUserEmail})</span> : null} • <span className="text-emerald-400 font-bold">{displayRole} {t('mode', lang)}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/timeline"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('forecast_timeline', lang)}</span>
              </Link>
              <button
                onClick={() => setShowAssistant(!showAssistant)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showAssistant ? t('hide_assistant', lang) : t('ask_assistant', lang)}</span>
                {showAssistant ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Location Status Bar */}
          <LocationStatusBar
            location={currentLocation}
            locationSource={locationSource}
            dataStatus={dataStatus}
            lastUpdated={lastUpdatedLabel}
            onChangeLocation={() => setShowLocationSelector(true)}
            onRefresh={loadDashboardData}
            isLoading={loading}
            lang={lang}
          />

          {/* System Status Panel */}
          <SystemStatusPanel
            locationStatus={locationSysStatus}
            weatherStatus={weatherSysStatus}
            forecastStatus={forecastSysStatus}
            alertsStatus={alertsSysStatus}
            aiStatus={aiSysStatus}
            authStatus={authStatus}
          />

          {/* Embedded AI Assistant (toggleable) */}
          {showAssistant && (
            <div className="h-[480px]">
              <AiAssistant
                weather={weather}
                risk={risk}
                mode={techMode}
                onModeChange={setTechMode}
              />
            </div>
          )}

          {/* Loading State */}
          {loading && !weather ? (
            <div className="p-12 bg-slate-900 rounded-xl border border-slate-800 text-center font-mono text-xs text-slate-400 animate-pulse">
              {t('refreshing', lang)} {currentLocation.name}...
            </div>
          ) : !weather || !risk ? (
            /* Unavailable State */
            <div className="p-10 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-200">{t('unavailable', lang)}</p>
              <p className="text-xs text-slate-400">Risk assessment is temporarily unavailable because current environmental data could not be retrieved.</p>
              <button
                onClick={loadDashboardData}
                className="mt-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
              >
                {t('try_again', lang)}
              </button>
            </div>
          ) : (
            <>
              {/* REAL-TIME LIVE GPS & TELEMETRY STREAM */}
              <RealtimeLiveLocationTracker
                onLocationUpdate={(loc) => {
                  handleLocationChange(loc, 'GPS');
                }}
              />

              {/* Heat Risk Score Gauge */}
              <HeatGauge
                score={risk.risk_score}
                level={risk.risk_level}
                lastUpdated={new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                dataQuality={risk.data_quality}
                lang={lang}
              />

              {/* Weather & XAI Contributing Factors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <WeatherCard
                  weather={weather}
                  onRefresh={loadDashboardData}
                  isLoading={loading}
                  lang={lang}
                />
                <RiskDrivers
                  factors={risk.factors}
                  mode={techMode}
                  onToggleMode={setTechMode}
                  lang={lang}
                />
              </div>

              {/* Actionable Guidance */}
              <GuidanceList
                guidance={risk.recommendations}
                mode={techMode}
                lang={lang}
              />

              {/* REAL-TIME MULTI-USER BROADCAST COMMAND CENTER */}
              <RealtimeBroadcastCommandCenter />

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                  href="/timeline"
                  className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-400">{t('timeline', lang).toUpperCase()}</span>
                    <Clock className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400">See when heat risk peaks over the next 24–48 hours.</p>
                </Link>

                <Link
                  href="/simulator"
                  className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-400">{t('what_if_simulator', lang).toUpperCase()}</span>
                    <Sliders className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400">Test how changing activity or cooling affects your risk.</p>
                </Link>

                <Link
                  href="/community/map"
                  className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-400">{t('community_map', lang).toUpperCase()}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400">View water points, shade reports, and cooling centers.</p>
                </Link>
              </div>

              {/* Academic & System Verification Row (v2.0) */}
              <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>CSE-AIML 2ND REVIEW • TECHNICAL VERIFICATION ARTIFACTS</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inspect the mathematical derivations, 326/326 automated test reports, and live subsystem telemetry.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/methodology"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Methodology &amp; Math</span>
                  </Link>
                  <Link
                    href="/evidence"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Evidence &amp; QA</span>
                  </Link>
                  <Link
                    href="/system"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>System Telemetry</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Location Selector Modal */}
      {showLocationSelector && (
        <LocationSelector
          currentLocation={currentLocation}
          currentSource={locationSource}
          onSelect={handleLocationChange}
          onClose={() => setShowLocationSelector(false)}
        />
      )}
    </div>
  );
}

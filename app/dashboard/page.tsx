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
import { LocationData, RiskAssessment, TechMode, WeatherData } from '@/lib/types';
import Link from 'next/link';
import { Clock, Sliders, MessageSquare, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { LocationProvider, useLocation } from '@/context/LocationProvider';
import { WEATHER_REFRESH_INTERVAL_MS } from '@/lib/constants';

function DashboardInner() {
  const router = useRouter();
  const { location, source, setManualLocation } = useLocation();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [techMode, setTechMode] = useState<TechMode>('technical');
  const [profile, setProfile] = useState(getUserProfile());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [authStatus, setAuthStatus] = useState<SystemStatusValue>('AUTHENTICATED');
  const [locationSource, setLocationSource] = useState<LocationSource>('DEFAULT');

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestSeqRef = useRef<number>(0);

  const loadData = useCallback(async (loc: LocationData) => {
    const currentSeq = ++requestSeqRef.current;
    setLoading(true);
    const wData = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
    if (currentSeq !== requestSeqRef.current) return; // stale response
    setWeather(wData);
    const rData = evaluateHeatRisk(wData, {
      activity: profile.activity_level,
      duration: profile.exposure_duration,
      cooling: profile.cooling_access,
      age_group: profile.age_group,
    });
    setRisk(rData);
    setLoading(false);
  }, [profile]);

  // react to location changes from geolocation or manual fallback
  useEffect(() => {
    if (location) {
      setLocationSource(source);
      saveUserProfile({ location });
      loadData(location);
    }
  }, [location, source, loadData]);

  // keep source in sync for UI display
  useEffect(() => {
    setLocationSource(source);
  }, [source]);

  // Supabase auth listener
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          setAuthStatus('SIGNED OUT');
          router.replace('/login');
        } else {
          setAuthStatus('AUTHENTICATED');
        }
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setAuthStatus('SIGNED OUT');
          router.replace('/login');
        } else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          setAuthStatus('AUTHENTICATED');
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [router]);

  // auto‑refresh weather/risk at configured interval
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      if (location) loadData(location);
    }, WEATHER_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [location, loadData]);

  const handleLocationChange = async (loc: LocationData, src: LocationSource) => {
    setManualLocation(loc);
    setLocationSource(src);
    saveUserProfile({ location: loc });
    await loadData(loc);
  };

  const currentLocation = location ?? { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 };

  // weather freshness & status calculations
  const weatherAgeMins = weather ? Math.floor((Date.now() - new Date(weather.timestamp).getTime()) / 60000) : 0;
  const isStale = weatherAgeMins > 15;
  const dataStatus: 'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'FALLBACK' = weather
    ? weather.is_fallback ? 'FALLBACK'
      : weather.is_cached || isStale ? 'CACHED'
      : 'LIVE'
    : loading ? 'LIVE' : 'UNAVAILABLE';
  const lastUpdatedLabel = weather
    ? isStale ? `Stale (Updated ${weatherAgeMins}m ago)`
      : `Updated ${new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

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
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} techMode={techMode} onToggleTechMode={setTechMode} />
      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h1 className="text-xl font-bold text-slate-900">OPERATIONAL HEAT RISK DASHBOARD</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">Contextual Heat Strain Assessment for {profile.name || 'User'} ({profile.role.toUpperCase()} MODE)</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/timeline" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Forecast Timeline</span>
              </Link>
              <button onClick={() => setShowAssistant(!showAssistant)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showAssistant ? 'Hide Assistant' : 'Ask AI Assistant'}</span>
                {showAssistant ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <LocationStatusBar location={currentLocation} locationSource={locationSource} dataStatus={dataStatus} lastUpdated={lastUpdatedLabel} onChangeLocation={() => setShowLocationSelector(true)} onRefresh={() => location && loadData(location)} isLoading={loading} />
          <SystemStatusPanel locationStatus={locationSysStatus} weatherStatus={weatherSysStatus} forecastStatus={forecastSysStatus} alertsStatus={alertsSysStatus} aiStatus={aiSysStatus} authStatus={authStatus} />
          {showAssistant && (
            <div className="h-[480px]"><AiAssistant weather={weather} risk={risk} mode={techMode} onModeChange={setTechMode} /></div>
          )}
          {loading && !weather ? (
            <div className="p-12 bg-white rounded-xl border border-slate-200 text-center font-mono text-xs text-slate-500 animate-pulse">Retrieving environmental data for {currentLocation.name}...</div>
          ) : !weather || !risk ? (
            <div className="p-10 bg-white rounded-xl border border-slate-200 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700">We couldn't retrieve current weather data.</p>
              <p className="text-xs text-slate-500">Risk assessment is temporarily unavailable because current environmental data could not be retrieved.</p>
              <button onClick={() => location && loadData(location)} className="mt-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition">Try Again</button>
            </div>
          ) : (
            <>
              <HeatGauge score={risk.risk_score} level={risk.risk_level} lastUpdated={new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} dataQuality={risk.data_quality} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <WeatherCard weather={weather} onRefresh={() => location && loadData(location)} isLoading={loading} />
                <RiskDrivers factors={risk.factors} mode={techMode} onToggleMode={setTechMode} />
              </div>
              <GuidanceList guidance={risk.recommendations} mode={techMode} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/timeline" className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold font-mono text-emerald-700">FORECAST TIMELINE</span><Clock className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" /></div>
                  <p className="text-xs text-slate-500">See when heat risk peaks over the next 24–48 hours.</p>
                </Link>
                <Link href="/simulator" className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold font-mono text-emerald-700">WHAT-IF SIMULATOR</span><Sliders className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" /></div>
                  <p className="text-xs text-slate-500">Test how changing activity or cooling affects your risk.</p>
                </Link>
                <Link href="/community/map" className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition shadow-xs group">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold font-mono text-emerald-700">COMMUNITY MAP</span><ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" /></div>
                  <p className="text-xs text-slate-500">View water points, shade reports, and cooling centers.</p>
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
      {showLocationSelector && (
        <LocationSelector currentLocation={currentLocation} currentSource={locationSource} onSelect={handleLocationChange} onClose={() => setShowLocationSelector(false)} />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <LocationProvider>
      <DashboardInner />
    </LocationProvider>
  );
}

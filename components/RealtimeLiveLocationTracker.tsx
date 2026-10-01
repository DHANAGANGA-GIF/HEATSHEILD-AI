'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Compass,
  Radio,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  Wind,
  Droplets,
  RefreshCw,
  Sparkles,
  Shield,
  Gauge,
  ShieldCheck
} from 'lucide-react';
import { reverseGeocode, fetchWeatherData, getWeatherConditionText } from '@/lib/weather-api';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { LocationData, WeatherData } from '@/lib/types';
import { useAuth } from '@/lib/firebase/auth-context';
import { writeUserLocation } from '@/lib/firebase/firestore';
import { authenticatedFetch } from '@/lib/api-client';

interface RealtimeLiveLocationTrackerProps {
  onLocationUpdate?: (location: LocationData) => void;
}

export const RealtimeLiveLocationTracker: React.FC<RealtimeLiveLocationTrackerProps> = ({
  onLocationUpdate,
}) => {
  // AUTHORITY: The authenticated Firebase user determines the email recipient.
  // The user CANNOT type a different email address into the dispatch field.
  const { firebaseUser, appProfile: authProfile, getIdToken } = useAuth();
  const authorizedEmail: string = firebaseUser?.email || authProfile?.email || '';
  const [emailStatus, setEmailStatus] = useState<{
    ready: boolean;
    mode: 'SANDBOX' | 'PRODUCTION' | 'NOT_READY' | 'NOT_CONFIGURED';
    provider?: string;
    message: string;
    reason?: string;
    oauthConnected?: boolean;
  }>({
    ready: true,
    mode: 'PRODUCTION',
    message: 'Active transactional email gateway',
  });

  useEffect(() => {
    fetch('/api/email/status')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setEmailStatus({
            ready: data.ready !== undefined ? Boolean(data.ready) : data.mode !== 'NOT_READY',
            mode: data.mode || (data.ready ? 'PRODUCTION' : 'NOT_READY'),
            provider: data.provider,
            message: data.message || '',
            reason: data.reason,
            oauthConnected: data.oauthConnected,
          });
        }
      })
      .catch(() => {});
  }, []);

  const [profile, setProfile] = useState(getUserProfile());
  const [isWatching, setIsWatching] = useState(false);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    speed?: number | null;
    heading?: number | null;
  } | null>(null);

  const [resolvedName, setResolvedName] = useState<string>(
    profile.location?.name || ''
  );
  const [resolvedLocality, setResolvedLocality] = useState<string>(
    profile.location?.locality || ''
  );

  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastGeocodedCoords = useRef<{ lat: number; lon: number } | null>(null);

  // Sync profile location from localStorage on mount
  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    if (p.location) {
      setCoords({
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        accuracy: p.location.gps_accuracy,
      });
      setResolvedName(p.location.name);
      setResolvedLocality(p.location.locality || '');
    }
  }, []);

  // Fetch live weather whenever coordinates change significantly
  const loadWeatherForCoords = async (lat: number, lon: number, name: string) => {
    setIsFetchingWeather(true);
    try {
      const data = await fetchWeatherData(lat, lon, name, true);
      setLiveWeather(data);
    } catch {
      // Ignore
    } finally {
      setIsFetchingWeather(false);
    }
  };

  // Reverse geocode with distance threshold check (don't spam reverse geocoder)
  const handlePositionUpdate = async (pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;

    setCoords({
      latitude,
      longitude,
      accuracy: Math.round(accuracy),
      altitude: altitude ? Math.round(altitude) : null,
      speed: speed ? Math.round(speed * 3.6) : 0, // m/s to km/h
      heading: heading ? Math.round(heading) : null,
    });

    const prev = lastGeocodedCoords.current;
    const distanceDelta = prev
      ? Math.hypot(prev.lat - latitude, prev.lon - longitude)
      : 1;

    // If moved >~50m or first run, reverse geocode and sync
    if (distanceDelta > 0.0005) {
      lastGeocodedCoords.current = { lat: latitude, lon: longitude };
      try {
        const resolved = await reverseGeocode(latitude, longitude);
        resolved.gps_accuracy = Math.round(accuracy);
        setResolvedName(resolved.name);
        setResolvedLocality(resolved.locality || '');
        saveUserProfile({ location: resolved });
        if (onLocationUpdate) onLocationUpdate(resolved);
        await loadWeatherForCoords(latitude, longitude, resolved.name);

        // Write location to Firestore locations/{uid} — non-blocking, per-user isolation
        if (firebaseUser?.uid) {
          writeUserLocation(firebaseUser.uid, {
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            altitude: altitude ? Math.round(altitude) : null,
            speed: speed ? Math.round(speed * 3.6) : null,
            heading: heading ? Math.round(heading) : null,
            locationName: resolved.name,
            locationLocality: resolved.locality || '',
            locationSource: 'LIVE_GPS',
          }).catch(() => {
            // Non-fatal — localStorage update succeeded
          });
        }
      } catch {
        const fallbackLoc: LocationData = {
          name: 'Current Live GPS Location',
          locality: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
          latitude,
          longitude,
          gps_accuracy: Math.round(accuracy),
        };
        saveUserProfile({ location: fallbackLoc });
        if (onLocationUpdate) onLocationUpdate(fallbackLoc);
        await loadWeatherForCoords(latitude, longitude, 'Live Location');

        // Write fallback location to Firestore
        if (firebaseUser?.uid) {
          writeUserLocation(firebaseUser.uid, {
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            locationSource: 'LIVE_GPS',
          }).catch(() => {});
        }
      }
    }
  };

  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsWatching(true);
    // Initial single high-accuracy request
    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      (err) => {
        console.warn('GPS initial error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Continuous watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => {
        console.warn('GPS watch error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopWatchingLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  };

  // Dispatch live report to the authenticated user's own email via Firebase-authenticated endpoint.
  // The recipient is ALWAYS the server-verified Firebase email — never a user-typed value.
  const handleSendLiveReport = async () => {
    if (!authorizedEmail) {
      alert('You must be signed in to dispatch a live safety report.');
      return;
    }

    if (!coords) {
      alert('Live GPS location is required. Please enable GPS tracking first.');
      return;
    }

    setDispatchStatus('sending');
    setDispatchMessage(null);

    try {
      const res = await authenticatedFetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // NOTE: Do NOT include targetEmail — the server derives it from the verified token.
          clientLocation: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            location_name: resolvedName,
            location_source: 'LIVE_GPS',
            gps_accuracy: coords.accuracy,
          },
          customSubject: `HeatShield AI | Real-Time Live GPS Heat Safety Report for ${resolvedName}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.results?.[0]?.success) {
        setDispatchStatus('success');
        // Show the server-verified recipient for confirmation (not any user-supplied value)
        const confirmedEmail = data.verifiedRecipient || authorizedEmail;
        setDispatchMessage(`✓ Live safety report sent successfully to ${confirmedEmail}!`);
        setTimeout(() => setDispatchStatus('idle'), 6000);
      } else if (res.status === 401) {
        setDispatchStatus('error');
        setDispatchMessage('Authentication required. Please sign in again to send live reports.');
      } else {
        setDispatchStatus('error');
        const errDetail = data.error || data.message || data.results?.[0]?.error;
        setDispatchMessage(errDetail || 'Email delivery is currently unavailable. Please try again later.');
      }
    } catch (err: any) {
      setDispatchStatus('error');
      setDispatchMessage('Email delivery is currently unavailable. Please try again later.');
    }
  };

  useEffect(() => {
    // Start tracking on mount if permission exists
    if (navigator.geolocation) {
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          startWatchingLocation();
        }
      }).catch(() => {});
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100">
      {/* Radar scanning background aura */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 animate-pulse" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Radio className={`w-5 h-5 ${isWatching ? 'animate-pulse text-emerald-300' : 'text-slate-400'}`} />
            </div>
            {isWatching && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-mono tracking-tight uppercase">
                LOCATION-BASED WEATHER & ADVISORY DISPATCH
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                isWatching
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {isWatching ? 'BROWSER LOCATION ACTIVE' : 'PROFILE DEFAULT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Current weather data for your selected location (Open-Meteo) with personalized safety advisory dispatch
            </p>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2">
          {isWatching ? (
            <button
              onClick={stopWatchingLocation}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Reset to Default Location</span>
            </button>
          ) : (
            <button
              onClick={startWatchingLocation}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition flex items-center gap-2 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Use Approximate Location</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Coordinates & Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 relative z-10">
        {/* Card 1: Location Coordinates */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Location Coordinates</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {isWatching ? 'Browser Geolocation' : 'Default / Saved'}
            </span>
          </div>

          <div className="font-mono text-base font-extrabold text-white">
            {coords ? `${coords.latitude.toFixed(3)}° N, ${coords.longitude.toFixed(3)}° E` : '13.083° N, 80.271° E'}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
            <span>Precision: <strong className="text-slate-200">{isWatching ? 'Approximate (Browser)' : 'City Center'}</strong></span>
          </div>
        </div>

        {/* Card 2: Location Name & Zone */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Selected Location</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {isWatching ? 'Auto-Resolved' : 'Profile Default'}
            </span>
          </div>

          <div className="text-base font-bold text-white truncate">
            {resolvedName || 'Chennai'}
          </div>

          <div className="text-[11px] text-slate-400 truncate">
            {resolvedLocality || 'Monitored Region'}
          </div>
        </div>

        {/* Card 3: Live Weather Stream */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5" />
              <span>Current Weather</span>
            </span>
            {isFetchingWeather ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <span className="text-[10px] font-mono text-slate-400">Open-Meteo API</span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-white font-mono">
              {liveWeather ? `${liveWeather.temperature}°C` : '--°C'}
            </div>
            <span className="text-[11px] text-slate-300 font-mono">
              {liveWeather ? `Feels ${liveWeather.apparent_temperature}°C` : 'Fetching...'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-blue-400" />
              <span>Humidity: {liveWeather ? `${liveWeather.relative_humidity}%` : '--%'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-emerald-400" />
              <span>Wind: {liveWeather ? `${liveWeather.wind_speed} km/h` : '-- km/h'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Email Dispatch Strip */}
      <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white font-mono">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>PERSONAL HEAT ADVISORY EMAIL DISPATCH</span>
            {!emailStatus.ready || emailStatus.mode === 'NOT_READY' ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800/60 flex items-center gap-1">
                EMAIL DELIVERY: NOT READY{emailStatus.reason ? ` (${emailStatus.reason})` : ''}
              </span>
            ) : emailStatus.mode === 'SANDBOX' ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                EMAIL DELIVERY: SANDBOX ({emailStatus.provider ? emailStatus.provider.toUpperCase() : 'RESEND'})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                EMAIL DELIVERY: READY ({emailStatus.provider ? emailStatus.provider.toUpperCase() : 'ACTIVE'})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{emailStatus.message || (emailStatus.ready ? 'Live transactional email delivery operational.' : 'Email service configuration required.')}</span>
            {emailStatus.provider === 'gmail' && !emailStatus.oauthConnected && (
              <a
                href="/api/email/google/connect"
                className="text-emerald-400 hover:underline font-bold font-mono"
              >
                Connect Gmail OAuth &rarr;
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* SECURITY: Email is locked to the authenticated Firebase user.
              The user cannot type a different recipient. */}
          <div className="bg-slate-900 border border-emerald-800/50 rounded-xl px-3.5 py-2 text-xs text-emerald-300 font-mono flex items-center gap-2 min-w-[240px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">
              {authorizedEmail || (firebaseUser ? 'Your authenticated account does not have an email address.' : 'Sign in to enable dispatch')}
            </span>
          </div>

          <button
            onClick={handleSendLiveReport}
            disabled={dispatchStatus === 'sending' || !authorizedEmail || !coords}
            title={!authorizedEmail ? (firebaseUser ? 'Your authenticated account does not have an email address.' : 'Sign in to dispatch') : !coords ? 'Enable GPS tracking first' : 'Send live GPS report'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dispatchStatus === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Email My Heat Advisory</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dispatch Status Feedback */}
      {dispatchMessage && (
        <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 font-mono ${
          dispatchStatus === 'success'
            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
            : 'bg-rose-950/70 border-rose-800 text-rose-200'
        }`}>
          {dispatchStatus === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{dispatchMessage}</span>
        </div>
      )}
    </div>
  );
};

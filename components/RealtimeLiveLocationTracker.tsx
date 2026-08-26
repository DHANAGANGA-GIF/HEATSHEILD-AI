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
  Gauge
} from 'lucide-react';
import { reverseGeocode, fetchWeatherData, getWeatherConditionText } from '@/lib/weather-api';
import { getUserProfile, saveUserProfile } from '@/lib/store';
import { LocationData, WeatherData } from '@/lib/types';

interface RealtimeLiveLocationTrackerProps {
  onLocationUpdate?: (location: LocationData) => void;
}

export const RealtimeLiveLocationTracker: React.FC<RealtimeLiveLocationTrackerProps> = ({
  onLocationUpdate,
}) => {
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
    profile.location?.name || 'Chennai'
  );
  const [resolvedLocality, setResolvedLocality] = useState<string>(
    profile.location?.locality || 'Tamil Nadu, India'
  );

  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState(profile.email || 'user@heatshield.org');

  const watchIdRef = useRef<number | null>(null);
  const lastGeocodedCoords = useRef<{ lat: number; lon: number } | null>(null);

  // Sync profile email
  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    if (p.email) setTargetEmail(p.email);
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

    // If moved > ~50m or first run, reverse geocode
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

  // Dispatch live report to email
  const handleSendLiveReport = async () => {
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setDispatchStatus('sending');
    setDispatchMessage(null);

    const lat = coords?.latitude || 13.0827;
    const lon = coords?.longitude || 80.2707;

    try {
      const res = await fetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          sendToAll: false,
          clientLocation: {
            latitude: lat,
            longitude: lon,
            location_name: resolvedName,
            location_source: coords ? 'LIVE_GPS' : 'SAVED_LOCATION',
            gps_accuracy: coords?.accuracy,
          },
          customSubject: `HeatShield AI | Real-Time Live GPS Heat Safety Report for ${resolvedName}`,
        }),
      });

      const data = await res.json();
      if (data.success && data.results?.[0]?.success) {
        setDispatchStatus('success');
        setDispatchMessage(`✓ Real-time live report & precautions dispatched to ${targetEmail}!`);
        setTimeout(() => setDispatchStatus('idle'), 5000);
      } else {
        setDispatchStatus('error');
        setDispatchMessage(data.error || data.results?.[0]?.error || 'Failed to dispatch email.');
      }
    } catch (err: any) {
      setDispatchStatus('error');
      setDispatchMessage('Network error dispatching live safety report.');
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
                REAL-TIME LIVE GPS & TELEMETRY STREAM
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                isWatching
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {isWatching ? 'LIVE SENSOR LOCK' : 'STANDBY'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous high-frequency geolocation, thermal microclimate mapping & instant mail broadcast
            </p>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2">
          {isWatching ? (
            <button
              onClick={stopWatchingLocation}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-xs font-mono font-bold transition flex items-center gap-2 shadow-xs"
            >
              <span>Pause GPS Watcher</span>
            </button>
          ) : (
            <button
              onClick={startWatchingLocation}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition flex items-center gap-2 shadow-md shadow-emerald-950/40"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Enable Live GPS Watcher</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Coordinates & Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 relative z-10">
        {/* Card 1: GPS Coordinates */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Live Coordinates</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Accuracy: {coords?.accuracy ? `±${coords.accuracy}m` : '±15m'}
            </span>
          </div>

          <div className="font-mono text-base font-extrabold text-white">
            {coords ? `${coords.latitude.toFixed(5)}°, ${coords.longitude.toFixed(5)}°` : '13.08270°, 80.27070°'}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
            <span>Speed: <strong className="text-slate-200">{coords?.speed || 0} km/h</strong></span>
            <span>Alt: <strong className="text-slate-200">{coords?.altitude !== null && coords?.altitude !== undefined ? `${coords.altitude}m` : 'Sea Level'}</strong></span>
          </div>
        </div>

        {/* Card 2: Location Name & Zone */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Resolved Region</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {isWatching ? 'Auto-Geocoded' : 'Profile Default'}
            </span>
          </div>

          <div className="text-base font-bold text-white truncate">
            {resolvedName}
          </div>

          <div className="text-[11px] text-slate-400 truncate">
            {resolvedLocality || 'Monitored Climate Zone'}
          </div>
        </div>

        {/* Card 3: Live Microclimate Stream */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5" />
              <span>Real-Time Weather</span>
            </span>
            {isFetchingWeather ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <span className="text-[10px] font-mono text-slate-400">Open-Meteo API</span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-white font-mono">
              {liveWeather ? `${liveWeather.temperature}°C` : '34.2°C'}
            </div>
            <span className="text-[11px] text-slate-300 font-mono">
              Feels {liveWeather ? `${liveWeather.apparent_temperature}°C` : '39.0°C'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-blue-400" />
              <span>Humidity: {liveWeather ? `${liveWeather.relative_humidity}%` : '64%'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-emerald-400" />
              <span>Wind: {liveWeather ? `${liveWeather.wind_speed} km/h` : '14 km/h'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Email Dispatch Strip */}
      <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>INSTANT REAL-TIME SAFETY & PRECAUTIONS DISPATCH</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Send your live GPS coordinates, thermal risk index, and 7 personalized emergency precautions directly to your email.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="your-email@domain.com"
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 min-w-[240px]"
          />

          <button
            onClick={handleSendLiveReport}
            disabled={dispatchStatus === 'sending'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 disabled:opacity-50"
          >
            {dispatchStatus === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Email My Live Report</span>
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

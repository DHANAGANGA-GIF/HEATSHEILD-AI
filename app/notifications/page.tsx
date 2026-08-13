'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell, CheckCircle, AlertTriangle, Info, ShieldAlert, Settings, Filter,
  ArrowLeft, X, Volume2, Globe, MapPin, Clock, Sparkles, ExternalLink,
  RotateCcw, Check, Navigation, RefreshCw, Search, Thermometer, Wind,
  Droplets, Loader2, Mail, Smartphone, ShieldCheck, AlertOctagon, CheckCircle2
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';

import {
  getSmartAlerts, getAlertSettings, saveAlertSettings, markSmartAlertRead,
  dismissSmartAlert, clearDismissedAlerts, getUserProfile, saveUserProfile,
  addSmartAlerts, getNotificationLogs, saveRecipientProfile, getRecipientProfiles
} from '@/lib/store';
import {
  AlertPriority, AlertSettings, SmartAlert, UserProfile, LocationData,
  WeatherData, NotificationLog, RecipientNotificationProfile
} from '@/lib/types';
import {
  getNotificationPermissionStatus, requestNotificationPermission, NotificationPermissionState
} from '@/lib/notification-service';
import {
  fetchWeatherData, searchLocations, reverseGeocode, getWeatherConditionText
} from '@/lib/weather-api';

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams ? searchParams.get('id') : null;

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(getAlertSettings());
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('default');

  // Real-time Environmental & Location States
  const [currentLocation, setCurrentLocation] = useState<LocationData>(
    profile.location || {
      name: 'Chennai',
      locality: 'Tamil Nadu, India',
      latitude: 13.0827,
      longitude: 80.2707,
      country: 'India',
    }
  );
  const [locationSource, setLocationSource] = useState<'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE'>('SAVED_LOCATION');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<SmartAlert | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  // Manual Geocoding Search
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Test Dispatch States
  const [isTestingRecipient, setIsTestingRecipient] = useState<string | null>(null);
  const [testDispatchResults, setTestDispatchResults] = useState<Record<string, { status: string; id?: string; error?: string }>>({});
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  const loadRealTimeData = async (loc: LocationData) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    try {
      const data = await fetchWeatherData(loc.latitude, loc.longitude, loc.name);
      setWeatherData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setWeatherError('Live weather currently unavailable');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    setSettings(getAlertSettings());
    setAlerts(getSmartAlerts());
    setLogs(getNotificationLogs());
    setPermissionStatus(getNotificationPermissionStatus());

    const initialLoc: LocationData = p.location || {
      name: 'Chennai',
      locality: 'Tamil Nadu, India',
      latitude: 13.0827,
      longitude: 80.2707,
      country: 'India',
    };
    setCurrentLocation(initialLoc);
    loadRealTimeData(initialLoc);
  // loadRealTimeData is defined outside and does not change identity — it is safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleDetectGpsLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser geolocation is not supported on this device.');
      return;
    }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const resolvedLoc = await reverseGeocode(latitude, longitude);
        resolvedLoc.gps_accuracy = Math.round(accuracy);
        setCurrentLocation(resolvedLoc);
        setLocationSource('LIVE_GPS');
        setGpsAccuracy(Math.round(accuracy));
        saveUserProfile({ location: resolvedLoc });
        await loadRealTimeData(resolvedLoc);
        setIsLoadingLocation(false);
      },
      (err) => {
        setIsLoadingLocation(false);
        setLocationSource('UNAVAILABLE');
        alert(`Live location unavailable — permission not granted (${err.message}). You can select a saved location or search manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleLocationSearch = async (query: string) => {
    setLocationSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearchingLocation(true);
    const results = await searchLocations(query);
    setSearchResults(results);
    setIsSearchingLocation(false);
  };

  const handleSelectLocation = async (loc: LocationData) => {
    setCurrentLocation(loc);
    setLocationSource('MANUAL_LOCATION');
    setGpsAccuracy(undefined);
    saveUserProfile({ location: loc });
    setSearchResults([]);
    setLocationSearchQuery('');
    await loadRealTimeData(loc);
  };

  const handleRequestPermission = async () => {
    const status = await requestNotificationPermission();
    setPermissionStatus(status);
  };

  const handleTestDispatchRecipient = async (email?: string, sendToAll: boolean = false) => {
    const key = sendToAll ? 'ALL' : (email || 'default');
    setIsTestingRecipient(key);

    let activeLat = currentLocation.latitude;
    let activeLon = currentLocation.longitude;
    let activeName = currentLocation.name;
    let activeSource = locationSource;
    let activeAccuracy = gpsAccuracy;
    let activeTimestamp = new Date().toISOString();

    if (locationSource === 'LIVE_GPS') {
      if (!navigator.geolocation) {
        setIsTestingRecipient(null);
        alert('Fresh GPS location unavailable. Email was not sent using LIVE GPS.');
        return;
      }

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });

        activeLat = pos.coords.latitude;
        activeLon = pos.coords.longitude;
        activeAccuracy = Math.round(pos.coords.accuracy);
        activeTimestamp = new Date(pos.timestamp || Date.now()).toISOString();

        const resolved = await reverseGeocode(activeLat, activeLon);
        activeName = resolved.name;

        setCurrentLocation({
          name: activeName,
          locality: resolved.locality,
          latitude: activeLat,
          longitude: activeLon,
          country: resolved.country,
        });
        setGpsAccuracy(activeAccuracy);
      } catch (err: any) {
        setIsTestingRecipient(null);
        alert('Fresh GPS location unavailable. Email was not sent using LIVE GPS.');
        return;
      }
    }

    try {
      const response = await fetch('/api/admin/test-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: email,
          sendToAll,
          clientLocation: {
            latitude: activeLat,
            longitude: activeLon,
            location_name: activeName,
            location_source: activeSource,
            gps_accuracy: activeAccuracy,
            timestamp: activeTimestamp,
          },
          weatherSnapshot: weatherData || undefined,
        }),
      });



      const data = await response.json();
      if (data.success && Array.isArray(data.results)) {
        const newResults: Record<string, { status: string; id?: string; error?: string }> = { ...testDispatchResults };
        data.results.forEach((r: { recipient: string; success: boolean; id?: string; error?: string }) => {
          newResults[r.recipient] = {
            status: r.success ? 'SENT' : 'FAILED',
            id: r.id,
            error: r.error,
          };
        });
        setTestDispatchResults(newResults);
        setLogs(getNotificationLogs());
      } else {
        alert(`Test dispatch failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error calling test dispatch API: ${err?.message || 'Network error'}`);
    } finally {
      setIsTestingRecipient(null);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (selectedPriority !== 'ALL' && alert.priority !== selectedPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        alert.title.toLowerCase().includes(q) ||
        alert.message.toLowerCase().includes(q) ||
        (alert.location_name && alert.location_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center font-mono">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">NOTIFICATION CENTER & SMART ALERTS</h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Real-Time Location-Aware Heat Safety Alerts & Persistent History
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>Preferences</span>
              </button>
              <button
                onClick={() => loadRealTimeData(currentLocation)}
                disabled={isLoadingWeather}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingWeather ? 'animate-spin' : ''}`} />
                <span>Refresh Live Data</span>
              </button>
            </div>
          </div>

          {/* Preferences Drawer */}
          {showPreferences && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>Notification Preferences</span>
              </h2>
              <div className="text-xs text-slate-300 font-mono">
                System notifications are configured for instant real-time dispatch via Resend Transactional Email.
              </div>
            </div>
          )}


          {/* Real-time Environmental & Location Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Real-Time Location</span>
                </span>
                <button
                  onClick={handleDetectGpsLocation}
                  disabled={isLoadingLocation}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition flex items-center gap-1"
                >
                  {isLoadingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                  <span>Detect GPS</span>
                </button>
              </div>

              <div>
                <div className="text-base font-bold text-white truncate">{currentLocation.name}</div>
                <div className="text-xs text-slate-400">{currentLocation.locality || currentLocation.country}</div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  Coords: {currentLocation.latitude.toFixed(4)}°, {currentLocation.longitude.toFixed(4)}°
                  {gpsAccuracy && ` (Accuracy: ±${gpsAccuracy}m)`}
                </div>
                <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                  Source: {locationSource === 'LIVE_GPS' ? '✓ LIVE GPS (CONSENTED)' : locationSource === 'UNAVAILABLE' ? '❌ GPS DENIED / UNAVAILABLE' : 'SAVED PROFILE LOCATION'}
                </div>
              </div>

              {/* Manual Search */}
              <div className="relative pt-1">
                <input
                  type="text"
                  placeholder="Search location manually..."
                  value={locationSearchQuery}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectLocation(res)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 border-b border-slate-800 last:border-0 text-slate-200"
                      >
                        <div className="font-bold text-white">{res.name}</div>
                        <div className="text-[10px] text-slate-400">{res.locality}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Weather Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4" />
                  <span>Real-Time Weather</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Updated: {lastUpdated}</span>
              </div>

              {isLoadingWeather ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Fetching Open-Meteo observations...</span>
                </div>
              ) : weatherError ? (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                  {weatherError}
                </div>
              ) : weatherData ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-white">{weatherData.temperature}°C</span>
                      <span className="text-xs text-slate-400 ml-2">Feels {weatherData.apparent_temperature}°C</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                      {getWeatherConditionText(weatherData.weather_code)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      <span>Humidity: {weatherData.relative_humidity}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Wind className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Wind: {weatherData.wind_speed} km/h</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">Live weather currently unavailable</div>
              )}
            </div>

            {/* Test Email Dispatch Panel */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <span>Test Notification Dispatch</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800 uppercase">
                  RESEND & TWILIO
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Dispatch an immediate test alert using real live weather observations and dynamic heat risk analysis for your active location.
              </p>


              <div className="pt-1 flex gap-2">
                <button
                  onClick={() => handleTestDispatchRecipient(profile.email || '99240040560@klu.ac.in', false)}
                  disabled={isTestingRecipient !== null}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isTestingRecipient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  <span>Send Test Email</span>
                </button>
                <button
                  onClick={() => handleTestDispatchRecipient(undefined, true)}
                  disabled={isTestingRecipient !== null}
                  className="px-3 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>Test All (4)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Test Recipients Status */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Registered Recipient Status & Testing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              {[
                { email: '99240040560@klu.ac.in', loc: 'Chennai', age: 'Age: 20' },
                { email: '99240040571@klu.ac.in', loc: 'Vijayawada', age: 'Age: 21' },
                { email: '99240040875@klu.ac.in', loc: 'Guntur', age: 'Age: Not Provided (Adult Default)' },
                { email: '99240040159@klu.ac.in', loc: 'Hyderabad', age: 'Age: 22' },
              ].map((rec) => {
                const res = testDispatchResults[rec.email];
                return (
                  <div key={rec.email} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div>
                      <div className="font-bold text-white truncate">{rec.email}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{rec.loc} • {rec.age}</div>
                    </div>

                    {res && (
                      <div className={`text-[10px] font-bold ${res.status === 'SENT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {res.status === 'SENT' ? `✓ SENT (ID: ${res.id?.slice(0, 10)}...)` : `✗ FAILED (${res.error})`}
                      </div>
                    )}

                    <button
                      onClick={() => handleTestDispatchRecipient(rec.email, false)}
                      disabled={isTestingRecipient === rec.email}
                      className="w-full py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      {isTestingRecipient === rec.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      <span>Test Dispatch</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persistent Notification History Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Persistent Notification & Delivery History ({logs.length})</span>
              </h2>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">No dispatch history logs yet</div>
                <p className="text-[11px] text-slate-500">
                  Click &quot;Send Test Email&quot; or trigger the hourly cron job to create notification records.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3">Recipient</th>
                      <th className="pb-3 px-3">Type</th>
                      <th className="pb-3 px-3">Risk Level</th>
                      <th className="pb-3 px-3">Location</th>
                      <th className="pb-3 px-3">Temp</th>
                      <th className="pb-3 px-3">Sent At</th>
                      <th className="pb-3 px-3">Provider ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'SENT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-semibold">{log.recipient_email}</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.alert_type}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${log.risk_level === 'EXTREME' ? 'text-rose-400' : log.risk_level === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'}`}>

                            {log.risk_level} ({log.risk_score}/100)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{log.location_name}</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.temperature ? `${log.temperature}°C` : '--'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{log.provider_message_id || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  );
}

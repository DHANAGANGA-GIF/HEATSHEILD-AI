'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell, CheckCircle, AlertTriangle, Info, ShieldAlert, Settings, Filter,
  ArrowLeft, X, Volume2, Globe, MapPin, Clock, Sparkles, ExternalLink,
  RotateCcw, Check, Navigation, RefreshCw, Search, Thermometer, Wind,
  Droplets, Loader2, Mail, Smartphone, ShieldCheck, AlertOctagon, CheckCircle2,
  KeyRound, Send, MessageSquare, Copy, CheckCheck, AlertCircle
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { RealtimeLiveLocationTracker } from '@/components/RealtimeLiveLocationTracker';
import { RealtimeBroadcastCommandCenter } from '@/components/RealtimeBroadcastCommandCenter';

import {
  getSmartAlerts, getAlertSettings, saveAlertSettings, markSmartAlertRead,
  dismissSmartAlert, clearDismissedAlerts, getUserProfile, saveUserProfile,
  addSmartAlerts, getNotificationLogs, saveNotificationLog, saveRecipientProfile, getRecipientProfiles
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
import { useAuth } from '@/lib/firebase/auth-context';

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams ? searchParams.get('id') : null;

  // ── AUTHORITY: Firebase authenticated user is the ONLY email identity source ──
  const { firebaseUser, appProfile: authProfile, getIdToken } = useAuth();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(getAlertSettings());
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('default');

  // Authoritative email derived ONLY from the authenticated Firebase user.
  // NEVER from localStorage, client state, or the request body.
  const authorizedEmail: string = firebaseUser?.email || authProfile?.email || '';
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<'SANDBOX' | 'PRODUCTION' | 'NOT_CONFIGURED'>('SANDBOX');
  const [emailDeliveryMessage, setEmailDeliveryMessage] = useState<string>('Resend sandbox mode — emails can only be sent to the Resend account owner.');

  useEffect(() => {
    fetch('/api/email/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.mode) setEmailDeliveryMode(data.mode);
        if (data.message) setEmailDeliveryMessage(data.message);
      })
      .catch(() => {});
  }, []);

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

  // Active Communication Dispatch Tab
  const [activeDispatchTab, setActiveDispatchTab] = useState<'EMAIL' | 'SMS' | 'OTP' | 'MESSAGE'>('EMAIL');

  // Multi-Channel Dispatch States
  // customEmail is READ-ONLY display; actual dispatch always uses authorizedEmail
  const [customEmail] = useState('');
  const [customPhone, setCustomPhone] = useState(profile.sms_phone || '');
  const [directMessageText, setDirectMessageText] = useState('');
  const [directMessageSubject, setDirectMessageSubject] = useState('');
  const [directMessageChannel, setDirectMessageChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [directMessageTarget, setDirectMessageTarget] = useState('');

  // OTP & Magic Link States
  const [otpTarget, setOtpTarget] = useState(profile.sms_phone || profile.email || '');
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('SMS');
  const [isGeneratingOtp, setIsGeneratingOtp] = useState(false);
  const [generatedOtpData, setGeneratedOtpData] = useState<{
    otpCode?: string;
    magicLink?: string;
    sessionId?: string;
    target?: string;
  } | null>(null);
  const [verifyOtpInput, setVerifyOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpVerificationSuccess, setOtpVerificationSuccess] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Test Dispatch States
  const [isTestingRecipient, setIsTestingRecipient] = useState<string | null>(null);
  const [testDispatchResults, setTestDispatchResults] = useState<Record<string, { status: string; id?: string; error?: string }>>({});
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'EMAIL' | 'SMS' | 'OTP'>('ALL');

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
    // NOTE: Do NOT set customEmail from localStorage here.
    // Email identity is derived exclusively from firebaseUser (see authorizedEmail above).
    if (p.sms_phone) {
      setCustomPhone(p.sms_phone);
      setOtpTarget(p.sms_phone);
    } else if (p.email) {
      setOtpTarget(p.email);
    }

    const initialLoc: LocationData = p.location || {
      name: 'Chennai',
      locality: 'Tamil Nadu, India',
      latitude: 13.0827,
      longitude: 80.2707,
      country: 'India',
    };
    setCurrentLocation(initialLoc);
    loadRealTimeData(initialLoc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync targets when auth state resolves (e.g. after login)
  useEffect(() => {
    if (authorizedEmail) {
      setDirectMessageTarget(authorizedEmail);
      if (otpChannel === 'EMAIL') {
        setOtpTarget(authorizedEmail);
      }
    }
  }, [authorizedEmail, otpChannel]);

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
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
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

  // 1. Email Alert Dispatcher — sends to the authenticated user's email ONLY.
  // The server verifies the Firebase ID token and ignores any client-supplied recipient.
  const handleTestDispatchRecipient = async (email?: string, sendToAll: boolean = false) => {
    // SECURITY: Always use the server-verified authorizedEmail for single dispatch.
    // For sendToAll (admin batch), the server uses its own registered recipient list.
    if (!sendToAll && !authorizedEmail) {
      alert('You must be signed in to dispatch a heat alert to your email.');
      return;
    }

    const key = sendToAll ? 'ALL' : (email || authorizedEmail);
    setIsTestingRecipient(key);

    let activeLat = currentLocation.latitude;
    let activeLon = currentLocation.longitude;
    let activeName = currentLocation.name;
    let activeSource = locationSource;
    let activeAccuracy = gpsAccuracy;

    try {
      // Obtain a fresh Firebase ID token to authenticate the server request.
      const idToken = await getIdToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) authHeaders['Authorization'] = `Bearer ${idToken}`;

      const response = await fetch('/api/admin/test-notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          // SECURITY: Do NOT send targetEmail for single dispatch.
          // The server derives the recipient from the verified Firebase UID.
          // For sendToAll batch mode, the server uses its own recipient list.
          sendToAll,
          clientLocation: {
            latitude: activeLat,
            longitude: activeLon,
            location_name: activeName,
            location_source: activeSource,
            gps_accuracy: activeAccuracy,
          },
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
      } else if (response.status === 401) {
        alert('Authentication required. Please sign in again to send heat alerts.');
      } else {
        alert(`Dispatch failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error calling dispatch API: ${err?.message || 'Network error'}`);
    } finally {
      setIsTestingRecipient(null);
    }
  };

  // 2. Phone SMS Dispatcher
  const handleSendPhoneSms = async () => {
    if (!customPhone.trim()) {
      alert('Please enter a valid phone number (e.g. +919876543210)');
      return;
    }
    setIsTestingRecipient('SMS_' + customPhone);
    try {
      const msg = `Thermal Warning: Temperature is ${weatherData?.temperature || 36}°C in ${currentLocation.name}. Seek shade and hydrate immediately.`;
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: customPhone.trim(),
          channel: 'SMS',
          message: msg,
          locationName: currentLocation.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Save into local notification logs
        const logItem: NotificationLog = {
          id: `log_sms_${Date.now()}`,
          recipient_id: profile.id || 'rec_user',
          recipient_email: customPhone.trim(),
          alert_type: 'SMS_THERMAL_ALERT',
          risk_level: 'HIGH',
          location_name: currentLocation.name,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          location_status: locationSource,
          temperature: weatherData?.temperature || 36,
          feels_like_temperature: weatherData?.apparent_temperature || 40,
          humidity: weatherData?.relative_humidity || 65,
          weather_condition: 'High Heat Index',
          weather_status: 'LIVE',
          risk_score: 78,
          precautions: ['Drink clean water every 30 mins', 'Move to shaded rest area'],
          provider: data.provider || 'Twilio',
          provider_message_id: data.id,
          status: 'SENT',
          idempotency_key: `sms_${Date.now()}`,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        saveNotificationLog(logItem);
        setLogs(getNotificationLogs());
        alert(`✓ Real-Time SMS dispatched to ${customPhone}!\nStatus: ${data.status}\nMessage SID: ${data.id}`);
      } else {
        alert(`SMS dispatch failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error sending SMS: ${err?.message}`);
    } finally {
      setIsTestingRecipient(null);
    }
  };

  // 3. OTP & Magic Link Generator
  const handleGenerateOtp = async () => {
    setIsGeneratingOtp(true);
    setOtpError(null);
    setOtpVerificationSuccess(null);
    try {
      const idToken = await getIdToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) authHeaders['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          channel: otpChannel,
          target: otpChannel === 'SMS' ? customPhone.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedOtpData({
          sessionId: data.otpSessionId,
          target: otpChannel === 'EMAIL' ? (authorizedEmail || profile.email) : customPhone.trim(),
        });

        // Save OTP log
        const logItem: NotificationLog = {
          id: `log_otp_${Date.now()}`,
          recipient_id: profile.id || 'rec_user',
          recipient_email: (otpChannel === 'EMAIL' ? (authorizedEmail || profile.email) : customPhone.trim()) || '',
          alert_type: 'SECURITY_OTP_MAGIC_LINK',
          risk_level: 'LOW',
          location_name: currentLocation.name,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          location_status: locationSource,
          temperature: weatherData?.temperature || 32,
          feels_like_temperature: weatherData?.apparent_temperature || 35,
          humidity: weatherData?.relative_humidity || 55,
          weather_condition: 'Security Dispatch',
          weather_status: 'LIVE',
          risk_score: 20,
          precautions: ['Do not share OTP with third parties'],
          provider: data.channel === 'EMAIL' ? 'Resend' : 'Twilio',
          provider_message_id: data.otpSessionId,
          status: 'SENT',
          idempotency_key: `otp_${Date.now()}`,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        saveNotificationLog(logItem);
        setLogs(getNotificationLogs());
      } else {
        setOtpError(data.error || 'Failed to generate OTP.');
      }
    } catch (err: any) {
      setOtpError('Network error requesting OTP.');
    } finally {
      setIsGeneratingOtp(false);
    }
  };

  const handleVerifyOtpCode = async () => {
    if (verifyOtpInput.trim().length !== 6) {
      setOtpError('Please enter the full 6-digit code.');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const idToken = await getIdToken();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) authHeaders['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          otpCode: verifyOtpInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpVerificationSuccess(`✓ Identity Verified! ${data.target || 'Your account'} is certified for real-time heat alerts.`);
        if (otpChannel === 'SMS') {
          saveUserProfile({ sms_phone: data.target || customPhone.trim(), authenticated: true });
        } else {
          saveUserProfile({ email: data.target || authorizedEmail || profile.email, authenticated: true });
        }
      } else {
        setOtpError(data.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setOtpError('Error verifying OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Direct Message Broadcaster
  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directMessageTarget.trim() || !directMessageText.trim()) {
      alert('Recipient and message text are required.');
      return;
    }
    setIsTestingRecipient('DIRECT_MSG');
    try {
      const idToken = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target: directMessageTarget.trim(),
          channel: directMessageChannel,
          subject: directMessageSubject || 'HeatShield AI Advisory',
          message: directMessageText.trim(),
          locationName: currentLocation.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const logItem: NotificationLog = {
          id: `log_msg_${Date.now()}`,
          recipient_id: profile.id || 'rec_user',
          recipient_email: directMessageTarget.trim(),
          alert_type: `${directMessageChannel}_DIRECT_BROADCAST`,
          risk_level: 'MODERATE',
          location_name: currentLocation.name,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          location_status: locationSource,
          temperature: weatherData?.temperature || 34,
          feels_like_temperature: weatherData?.apparent_temperature || 38,
          humidity: weatherData?.relative_humidity || 60,
          weather_condition: 'Advisory Broadcast',
          weather_status: 'LIVE',
          risk_score: 55,
          precautions: ['Follow emergency heat protocols'],
          provider: data.provider || 'Resend',
          provider_message_id: data.id,
          status: 'SENT',
          idempotency_key: `msg_${Date.now()}`,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        saveNotificationLog(logItem);
        setLogs(getNotificationLogs());
        setDirectMessageText('');
        alert(`✓ Direct message dispatched to ${directMessageTarget} via ${directMessageChannel}!\nID: ${data.id}`);
      } else {
        alert(`Failed to send message: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err?.message}`);
    } finally {
      setIsTestingRecipient(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'EMAIL') return log.alert_type.includes('EMAIL') || log.alert_type === 'TEST_DISPATCH';
    if (logFilter === 'SMS') return log.alert_type.includes('SMS');
    if (logFilter === 'OTP') return log.alert_type.includes('OTP');
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
                <h1 className="text-xl font-bold text-white tracking-tight">REAL-TIME NOTIFICATION & DISPATCH CENTER</h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Multi-Channel Heat Alerts, Phone SMS, OTP Verification & Direct Messaging
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadRealTimeData(currentLocation)}
                disabled={isLoadingWeather}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingWeather ? 'animate-spin' : ''}`} />
                <span>Refresh Live Telemetry</span>
              </button>
            </div>
          </div>

          {/* REAL-TIME LIVE GPS & SENSOR TELEMETRY STREAM */}
          <RealtimeLiveLocationTracker
            onLocationUpdate={(loc) => {
              setCurrentLocation(loc);
              setLocationSource('LIVE_GPS');
              setGpsAccuracy(loc.gps_accuracy);
            }}
          />

          {/* REAL-TIME MULTI-USER BROADCAST COMMAND CENTER */}
          <RealtimeBroadcastCommandCenter />

          {/* REAL-TIME MULTI-CHANNEL DISPATCH & OTP HUB */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-mono tracking-tight">
                    REAL-TIME DISPATCH & OTP VERIFICATION GATEWAY
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live transactional multi-channel delivery engine connecting the website directly to Email & Phone
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setActiveDispatchTab('EMAIL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    activeDispatchTab === 'EMAIL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Dispatch</span>
                </button>

                <button
                  onClick={() => setActiveDispatchTab('SMS')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    activeDispatchTab === 'SMS'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone SMS</span>
                </button>

                <button
                  onClick={() => setActiveDispatchTab('OTP')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    activeDispatchTab === 'OTP'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>OTP + Magic Link</span>
                </button>

                <button
                  onClick={() => setActiveDispatchTab('MESSAGE')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    activeDispatchTab === 'MESSAGE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Direct Message</span>
                </button>
              </div>
            </div>

            {/* TAB 1: EMAIL DISPATCH */}
            {activeDispatchTab === 'EMAIL' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                      Send Instant Thermal Risk Alert to Email
                    </h3>
                    <p className="text-xs text-slate-400">
                      Dispatches an automated high-priority email notification containing real-time temperature, heat index, and personalized precautions for {currentLocation.name}.
                    </p>

                    {/* SECURITY: Recipient is LOCKED to the authenticated Firebase user.
                        The server verifies the ID token and ignores any client-supplied email. */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Authenticated Recipient (Server-Verified)
                      </label>
                      <div className="w-full bg-slate-950 border border-emerald-800/50 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate font-bold">
                          {authorizedEmail || 'Sign in to see your email'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Report will be sent to your verified email: <span className="text-emerald-400">{authorizedEmail || 'Sign in to see email'}</span>
                      </p>
                    </div>

                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 font-semibold text-slate-300 font-mono">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
                          <span>Point-in-Time GPS Snapshot Dispatch</span>
                        </div>
                        {emailDeliveryMode === 'SANDBOX' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800/60">
                            EMAIL DELIVERY: SANDBOX
                          </span>
                        ) : emailDeliveryMode === 'PRODUCTION' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                            EMAIL DELIVERY: PRODUCTION
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800/60">
                            EMAIL DELIVERY: NOT READY
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] leading-relaxed">
                        {emailDeliveryMessage}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleTestDispatchRecipient(undefined, false)}
                        disabled={isTestingRecipient !== null || !authorizedEmail}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                      >
                        {isTestingRecipient === authorizedEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        <span>Send Live Report to My Email</span>
                      </button>
                      <button
                        onClick={() => handleTestDispatchRecipient(undefined, true)}
                        disabled={isTestingRecipient !== null || getRecipientProfiles().length === 0}
                        className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <span>Dispatch to All ({getRecipientProfiles().length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Registered Recipients — dynamically loaded from authenticated user profiles */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                      Registered Recipients
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {getRecipientProfiles().length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono text-center space-y-1">
                          <p className="font-semibold text-slate-300">No registered recipients yet</p>
                          <p>Recipients are added automatically when authenticated users save their profile. Use &ldquo;Send Live Report to My Email&rdquo; on the left to dispatch to your own verified email.</p>
                        </div>
                      ) : (
                        getRecipientProfiles().map((r) => (
                          <div key={r.email} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-white font-mono text-[11px]">{r.email}</div>
                              <div className="text-[10px] text-slate-500">{r.location_name || 'Location unknown'}</div>
                            </div>
                            <button
                              onClick={() => handleTestDispatchRecipient(r.email, false)}
                              disabled={isTestingRecipient === r.email}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-[10px] font-semibold transition flex items-center gap-1"
                            >
                              {isTestingRecipient === r.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              <span>Send</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PHONE SMS DISPATCH */}
            {activeDispatchTab === 'SMS' && (
              <div className="space-y-4 animate-fade-in">
                <div className="max-w-xl mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                        Live Phone SMS & WhatsApp Advisory Dispatch
                      </h3>
                      <p className="text-xs text-slate-400">
                        Dispatches real-time thermal alerts and emergency SMS advisories to any international or domestic mobile number.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Phone Number (E.164 format)</label>
                    <input
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="+91 98765 43210 or +1 234 567 8900"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">SMS Preview:</span>
                    <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                      &quot;[HeatShield AI Alert] Thermal Warning: Temperature is {weatherData?.temperature || 36}°C in {currentLocation.name}. Seek shade and hydrate immediately.&quot;
                    </p>
                  </div>

                  <button
                    onClick={handleSendPhoneSms}
                    disabled={isTestingRecipient !== null}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isTestingRecipient === 'SMS_' + customPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                    <span>Dispatch Real-Time SMS to Phone</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: OTP & MAGIC LINK HUB */}
            {activeDispatchTab === 'OTP' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OTP Generator Card */}
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" />
                        <span>Generate & Dispatch Security OTP + Magic Link</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Creates an encrypted 6-digit OTP passcode with a direct 1-click magic verification URL sent directly to Email or Phone SMS.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOtpChannel('SMS')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                          otpChannel === 'SMS' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        📱 via Phone SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpChannel('EMAIL')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                          otpChannel === 'EMAIL' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        📧 via Email
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Recipient {otpChannel === 'SMS' ? 'Phone Number' : 'Email Address'}
                      </label>
                      <input
                        type="text"
                        value={otpTarget}
                        onChange={(e) => setOtpTarget(e.target.value)}
                        placeholder={otpChannel === 'SMS' ? '+919876543210' : 'user@example.com'}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <button
                      onClick={handleGenerateOtp}
                      disabled={isGeneratingOtp}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {isGeneratingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Send OTP & Magic Link</span>
                    </button>

                    {otpError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{otpError}</span>
                      </div>
                    )}
                  </div>

                  {/* OTP Live Verification & Link Card */}
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="text-xs font-bold font-mono text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Live Verification Sandbox & Code Validator</span>
                    </h3>

                    {generatedOtpData ? (
                      <div className="space-y-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs">
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Dispatched OTP Code:</span>
                            <span className="text-emerald-400 font-bold text-base tracking-widest">{generatedOtpData.otpCode}</span>
                          </div>
                          {generatedOtpData.magicLink && (
                            <div className="pt-2 border-t border-slate-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 uppercase">Magic 1-Click Link:</span>
                                <button
                                  onClick={() => copyToClipboard(generatedOtpData.magicLink!)}
                                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                                >
                                  {copiedLink ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                                </button>
                              </div>
                              <a
                                href={generatedOtpData.magicLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:underline text-[11px] block truncate font-mono bg-slate-950 p-1.5 rounded-lg border border-slate-800"
                              >
                                {generatedOtpData.magicLink}
                              </a>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Enter 6-Digit Passcode to Verify
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={verifyOtpInput}
                              onChange={(e) => setVerifyOtpInput(e.target.value.replace(/\D/g, ''))}
                              placeholder={generatedOtpData.otpCode || '123456'}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-center text-base font-mono tracking-widest font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={handleVerifyOtpCode}
                              disabled={isVerifyingOtp || verifyOtpInput.length !== 6}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                            >
                              {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              <span>Verify Code</span>
                            </button>
                          </div>
                        </div>

                        {otpVerificationSuccess && (
                          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-start gap-2 animate-fade-in">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{otpVerificationSuccess}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        Click &quot;Send OTP & Magic Link&quot; to generate an encrypted passcode and test real-time validation.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: DIRECT MESSAGE BROADCASTER */}
            {activeDispatchTab === 'MESSAGE' && (
              <div className="space-y-4 animate-fade-in">
                <form onSubmit={handleSendDirectMessage} className="max-w-2xl mx-auto bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                        Direct Message & Custom Thermal Advisory Broadcaster
                      </h3>
                      <p className="text-xs text-slate-400">
                        Dispatch tailored advisory instructions or emergency alerts from the dashboard to any recipient.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Dispatch Channel</label>
                      <select
                        value={directMessageChannel}
                        onChange={(e) => setDirectMessageChannel(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      >
                        <option value="EMAIL">📧 Email Dispatch</option>
                        <option value="SMS">📱 Phone SMS Dispatch</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Address or Number</label>
                      <input
                        type="text"
                        value={directMessageTarget}
                        onChange={(e) => setDirectMessageTarget(e.target.value)}
                        placeholder={directMessageChannel === 'EMAIL' ? 'user@example.com' : '+919876543210'}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {directMessageChannel === 'EMAIL' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Email Subject Header</label>
                      <input
                        type="text"
                        value={directMessageSubject}
                        onChange={(e) => setDirectMessageSubject(e.target.value)}
                        placeholder="HeatShield AI | Immediate Thermal Advisory"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Message Body Content</label>
                    <textarea
                      rows={3}
                      value={directMessageText}
                      onChange={(e) => setDirectMessageText(e.target.value)}
                      placeholder="Write your custom heat safety advisory or instructions..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isTestingRecipient !== null}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isTestingRecipient === 'DIRECT_MSG' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Dispatch Custom Message Now</span>
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Persistent Multi-Channel Delivery Logs Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Multi-Channel Delivery & Audit Logs ({filteredLogs.length})</span>
              </h2>

              {/* Log Filters */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                {(['ALL', 'EMAIL', 'SMS', 'OTP'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      logFilter === filter ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">No dispatch history logs for this filter</div>
                <p className="text-[11px] text-slate-500">
                  Use any of the dispatch tabs above to send real-time alerts or verification OTPs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3">Channel / Type</th>
                      <th className="pb-3 px-3">Recipient</th>
                      <th className="pb-3 px-3">Location</th>
                      <th className="pb-3 px-3">Temp</th>
                      <th className="pb-3 px-3">Dispatched At</th>
                      <th className="pb-3 px-3">Provider ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredLogs.map((log) => {
                      const isSms = log.alert_type.includes('SMS');
                      const isOtp = log.alert_type.includes('OTP');
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SENT' || log.status === 'DELIVERED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOtp ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                              isSms ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                              'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {log.alert_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-white font-semibold">{log.recipient_email}</td>
                          <td className="py-2.5 px-3 text-slate-300">{log.location_name}</td>
                          <td className="py-2.5 px-3 text-slate-300">{log.temperature ? `${log.temperature}°C` : '--'}</td>
                          <td className="py-2.5 px-3 text-slate-400">{new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2.5 px-3 text-slate-500 truncate max-w-[120px]">{log.provider_message_id || 'N/A'}</td>
                        </tr>
                      );
                    })}
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

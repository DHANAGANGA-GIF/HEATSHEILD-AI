'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { getUserProfile, saveUserProfile, logoutUser } from '@/lib/store';
import { UserProfile } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  User, Save, CheckCircle, ShieldCheck, Key, Lock, Bell, MapPin,
  LogOut, ExternalLink, Smartphone, Mail, KeyRound, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/firebase/auth-context';

export default function ProfilePage() {
  const router = useRouter();
  const { firebaseUser, appProfile, signOut: authSignOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const p = appProfile || getUserProfile();
    return p;
  });
  const [saved, setSaved] = useState(false);
  
  // OTP Verification Modal & State
  const [phoneInput, setPhoneInput] = useState(profile.sms_phone || '');
  const [isPhoneVerified, setIsPhoneVerified] = useState(Boolean(profile.sms_phone));
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpTarget, setOtpTarget] = useState('');
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [authSession, setAuthSession] = useState<{
    provider: string;
    emailConfirmed: boolean;
    phoneConfirmed: boolean;
    lastSignIn: string;
  }>({
    provider: firebaseUser ? 'Firebase Authentication' : 'HeatShield Session',
    emailConfirmed: firebaseUser?.emailVerified ?? true,
    phoneConfirmed: Boolean(profile.sms_phone),
    lastSignIn: new Date().toLocaleString(),
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const current = appProfile || getUserProfile();
    if (firebaseUser?.email) {
      current.email = firebaseUser.email;
      current.firebase_uid = firebaseUser.uid;
      current.id = firebaseUser.uid;
    }
    setProfile(current);
    if (current.sms_phone) {
      setPhoneInput(current.sms_phone);
      setIsPhoneVerified(true);
    }

    if (firebaseUser) {
      setAuthSession({
        provider: 'Firebase Authentication',
        emailConfirmed: Boolean(firebaseUser.emailVerified),
        phoneConfirmed: Boolean(firebaseUser.phoneNumber || current.sms_phone),
        lastSignIn: firebaseUser.metadata?.lastSignInTime
          ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleString()
          : new Date().toLocaleString(),
      });
    } else if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setAuthSession({
            provider: session.user.app_metadata?.provider || 'Supabase Auth',
            emailConfirmed: Boolean(session.user.email_confirmed_at),
            phoneConfirmed: Boolean(session.user.phone_confirmed_at || current.sms_phone),
            lastSignIn: session.user.last_sign_in_at
              ? new Date(session.user.last_sign_in_at).toLocaleString()
              : new Date().toLocaleString(),
          });
        }
      }).catch(() => {});
    }
  }, [firebaseUser, appProfile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      email: firebaseUser?.email || profile.email,
      sms_phone: phoneInput.trim() || undefined,
    };
    saveUserProfile(updated);
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = async () => {
    if (authSignOut) {
      await authSignOut();
    } else {
      await logoutUser();
    }
    router.push('/login');
  };

  const handleOpenOtpModal = (channel: 'EMAIL' | 'SMS') => {
    const target = channel === 'EMAIL' ? (firebaseUser?.email || profile.email || '') : phoneInput;
    setOtpChannel(channel);
    setOtpTarget(target);
    setOtpCode('');
    setOtpSuccessMsg(null);
    setOtpErrorMsg(null);
    setShowOtpModal(true);
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setOtpErrorMsg(null);
    setOtpSuccessMsg(null);

    try {
      let token = '';
      if (firebaseUser) {
        token = await firebaseUser.getIdToken();
      }

      if (!token) {
        setOtpErrorMsg('Authentication required. Please sign in again.');
        setIsSendingOtp(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: otpChannel,
          target: otpChannel === 'SMS' ? phoneInput.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResendCooldown(30);
        setOtpSuccessMsg(
          `Security verification code sent to ${otpChannel === 'EMAIL' ? (firebaseUser?.email || profile.email) : phoneInput}! Valid for 10 minutes.`
        );
      } else {
        setOtpErrorMsg(data.error || 'Failed to dispatch verification code.');
      }
    } catch (err: any) {
      setOtpErrorMsg('Network error requesting verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      setOtpErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpErrorMsg(null);

    try {
      let token = '';
      if (firebaseUser) {
        token = await firebaseUser.getIdToken();
      }

      if (!token) {
        setOtpErrorMsg('Authentication required. Please sign in again.');
        setIsVerifyingOtp(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ otpCode: otpCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (otpChannel === 'SMS') {
          setIsPhoneVerified(true);
          const updated = { ...profile, sms_phone: phoneInput.trim() };
          saveUserProfile(updated);
          setProfile(updated);
        } else {
          setAuthSession((prev) => ({ ...prev, emailConfirmed: true }));
        }
        setOtpSuccessMsg('Verification Certified! Your contact is confirmed for live thermal alerts.');
        setTimeout(() => setShowOtpModal(false), 2000);
      } else {
        setOtpErrorMsg(data.error || 'Invalid verification code.');
      }
    } catch (err: any) {
      setOtpErrorMsg('Network error verifying code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Account Overview Bar */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold font-mono shadow-md shadow-emerald-900/50">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">{profile.name || 'User Profile'}</h1>
                <p className="text-xs text-slate-400 font-mono">
                  {profile.email} • Role: <span className="font-semibold text-emerald-400">{profile.role.toUpperCase()}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-800 flex items-center gap-1.5 font-mono">
                  <CheckCircle className="w-4 h-4" /> Profile Updated
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-semibold text-xs rounded-xl border border-rose-800 transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Real-Time Communication & Security Center */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  REAL-TIME COMMUNICATION & VERIFICATION CENTER
                </h2>
              </div>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
              >
                <span>Live Dispatch Hub &rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">AUTH ENGINE</span>
                <span className="font-bold text-white">{authSession.provider}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">EMAIL ALERTS</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 font-mono">VERIFIED</span>
                  <button
                    onClick={() => handleOpenOtpModal('EMAIL')}
                    className="text-[10px] text-sky-400 hover:underline"
                  >
                    Test OTP
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">PHONE SMS ALERTS</span>
                <div className="flex items-center justify-between">
                  <span className={`font-bold font-mono ${isPhoneVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isPhoneVerified ? 'VERIFIED' : 'PENDING'}
                  </span>
                  <button
                    onClick={() => handleOpenOtpModal('SMS')}
                    className="text-[10px] text-emerald-400 hover:underline font-semibold"
                  >
                    {isPhoneVerified ? 'Re-Verify' : 'Verify SMS'}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">DISPATCH GATEWAY</span>
                <span className="font-bold text-emerald-400 font-mono">LIVE / RESEND + TWILIO</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/notifications"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>Multi-Channel Notification Hub</span>
              </Link>
              <Link
                href="/auth/verify"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                <span>Direct OTP Verification Portal</span>
              </Link>
            </div>
          </div>

          {/* Profile & Risk Context Form */}
          <form onSubmit={handleSave} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-sm font-bold text-white pb-3 border-b border-slate-800 uppercase font-mono tracking-wider">
              PERSONAL PROFILE & RISK PARAMETERS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>Email Address</span>
                  {firebaseUser && <span className="text-[10px] text-emerald-400 font-mono">🔒 Managed by Firebase Auth</span>}
                </label>
                <input
                  type="email"
                  value={firebaseUser?.email || profile.email || ''}
                  onChange={(e) => !firebaseUser && setProfile({ ...profile, email: e.target.value })}
                  readOnly={Boolean(firebaseUser)}
                  disabled={Boolean(firebaseUser)}
                  className={`w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500 ${firebaseUser ? 'opacity-80 cursor-not-allowed text-slate-300' : ''}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>Phone Number (For SMS & WhatsApp Alerts)</span>
                  {isPhoneVerified && <span className="text-[10px] text-emerald-400">✓ SMS Verified</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setIsPhoneVerified(false);
                    }}
                    placeholder="+91 98765 43210"
                    className="flex-1 bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenOtpModal('SMS')}
                    className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Verify via SMS
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1">Role Type</label>
                <select
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value as any })}
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="user">Standard User</option>
                  <option value="school">School Administrator</option>
                  <option value="worksite">Worksite Safety Officer</option>
                  <option value="ngo">NGO Community Lead</option>
                  <option value="admin">Platform Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1">Age Group</label>
                <select
                  value={profile.age_group}
                  onChange={(e) => setProfile({ ...profile, age_group: e.target.value as any })}
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="adult">Adult (18-64)</option>
                  <option value="older_adult">Older Adult (65+)</option>
                  <option value="child">Child / Youth</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1">Activity Level</label>
                <select
                  value={profile.activity_level}
                  onChange={(e) => setProfile({ ...profile, activity_level: e.target.value as any })}
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="low">Low Activity</option>
                  <option value="moderate">Moderate Work</option>
                  <option value="high">High Physical Exercise / Heavy Labor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase mb-1">Cooling Access</label>
                <select
                  value={profile.cooling_access}
                  onChange={(e) => setProfile({ ...profile, cooling_access: e.target.value as any })}
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="good">Good (AC / Shade)</option>
                  <option value="limited">Limited Cooling</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save & Update Profile</span>
            </button>
          </form>
        </main>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">
                  {otpChannel === 'EMAIL' ? 'Verify Email Address' : 'Verify Phone Number via SMS'}
                </h3>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-slate-500 hover:text-white text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>

            {otpSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            {otpErrorMsg && (
              <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpErrorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient {otpChannel === 'EMAIL' ? 'Email' : 'Phone Number'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otpTarget}
                    onChange={(e) => setOtpTarget(e.target.value)}
                    readOnly={otpChannel === 'EMAIL' && Boolean(firebaseUser)}
                    placeholder={otpChannel === 'EMAIL' ? 'name@example.com' : '+919876543210'}
                    className={`flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono ${otpChannel === 'EMAIL' && firebaseUser ? 'opacity-80 cursor-not-allowed text-slate-300' : ''}`}
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || resendCooldown > 0}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 shrink-0"
                  >
                    {isSendingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingOtp ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Send OTP'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base text-center font-mono tracking-widest font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Verify Passcode</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Shield, LogIn, UserPlus, ArrowRight, AlertCircle, CheckCircle2,
  Lock, Mail, Phone, KeyRound, Loader2, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase/client';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveUserProfile, getUserProfile, setSessionCookie } from '@/lib/store';

export const dynamic = 'force-dynamic';

function getSafeRedirectUrl(param: string | null, role?: string, onboarded: boolean = true): string {
  // Validate redirect param: must start with single '/' and not contain protocol or '//'
  if (param && param.startsWith('/') && !param.startsWith('//') && !param.includes(':')) {
    return param;
  }
  if (!onboarded) {
    return '/onboarding';
  }
  if (role === 'admin' || role === 'super_admin') {
    return '/admin';
  }
  return '/dashboard';
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { signIn, signUp, sendPasswordReset, isAuthenticated, loading: authLoading, actionLoading } = useAuth();

  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deduplication ref to prevent duplicate redirects
  const isRedirectingRef = React.useRef(false);

  const performRedirect = React.useCallback((targetUrl?: string) => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;

    const currentProfile = getUserProfile();
    const destination = targetUrl || getSafeRedirectUrl(
      searchParams?.get('redirect'),
      currentProfile.role,
      currentProfile.onboarded !== false
    );

    if (currentProfile.id || currentProfile.firebase_uid) {
      setSessionCookie(currentProfile.firebase_uid || currentProfile.id);
    }

    router.replace(destination);
  }, [searchParams, router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && !isRedirectingRef.current) {
      performRedirect();
    }
  }, [isAuthenticated, authLoading, performRedirect]);

  // ── Firebase Email Auth ──────────────────────────────────────────────────
  const handleFirebaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }
    if (authMode === 'signup' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (authMode === 'signup') {
      const result = await signUp(email, password, name || email.split('@')[0]);
      if (!result.success) {
        setErrorMsg(result.error || 'Sign-up failed.');
        setLoading(false);
        return;
      }
      // Send welcome alert email (non-blocking)
      fetch('/api/broadcast/live-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: email,
          sendToAll: false,
          customSubject: `HeatShield AI | Welcome & Live Heat Safety Alert for ${name || email.split('@')[0]}`,
        }),
      }).catch(() => {});
      setSuccessMsg('Account created! Redirecting...');
      performRedirect('/onboarding');
    } else {
      const result = await signIn(email, password);
      if (!result.success) {
        setErrorMsg(result.error || 'Sign-in failed.');
        setLoading(false);
        return;
      }
      setSuccessMsg('Login successful! Redirecting...');
      const profile = getUserProfile();
      if (!profile.email) {
        saveUserProfile({
          email: email.trim().toLowerCase(),
          name: name || email.split('@')[0],
          authenticated: true,
        });
      }
      performRedirect();
    }
    setLoading(false);
  };

  // ── Supabase Fallback Email Auth (when Firebase not configured) ──────────
  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // If Supabase is not configured or failed to initialize, operate in local session mode
    if (!isSupabaseConfigured || !supabase) {
      const fallbackUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: email.trim().toLowerCase(),
        name: name || email.split('@')[0],
        authenticated: true,
        onboarded: true,
      };
      saveUserProfile(fallbackUser);
      setSuccessMsg('Signed in! Redirecting...');
      performRedirect();
      setLoading(false);
      return;
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name || email.split('@')[0] } },
        });
        if (error) throw error;
        if (data.user) {
          saveUserProfile({
            id: data.user.id,
            email: data.user.email || email,
            name: name || email.split('@')[0],
            authenticated: true,
            onboarded: false,
          });
          fetch('/api/broadcast/live-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetEmail: data.user.email || email, sendToAll: false }),
          }).catch(() => {});
          setSuccessMsg('Account registered! Redirecting...');
          performRedirect('/onboarding');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user) {
          saveUserProfile({
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.user_metadata?.full_name || email.split('@')[0],
            authenticated: true,
          });
          setSuccessMsg('Login successful! Redirecting...');
          performRedirect();
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed.';
      if (msg.includes('Invalid login')) setErrorMsg('Invalid email or password. Please check your credentials.');
      else if (msg.includes('already registered')) setErrorMsg('This email is already registered. Try signing in instead.');
      else setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset ────────────────────────────────────────────────────────
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setErrorMsg('Enter your email address to receive a reset link.'); return; }
    setLoading(true);
    setErrorMsg(null);

    if (isFirebaseConfigured) {
      const result = await sendPasswordReset(email);
      if (result.success) {
        setSuccessMsg(`Password reset email sent to ${email}. Check your inbox.`);
      } else {
        setErrorMsg(result.error || 'Failed to send reset email.');
      }
    } else if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
      });
      if (error) setErrorMsg(error.message);
      else setSuccessMsg(`Password reset email sent to ${email}.`);
    } else {
      setErrorMsg('Password reset is not available without email provider configuration.');
    }
    setLoading(false);
  };

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) { setErrorMsg('Enter a valid phone number with country code (+919876543210).'); return; }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const cleanPhone = phone.startsWith('+') ? phone.trim() : `+91${phone.trim()}`;
      const res = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: cleanPhone, channel: 'SMS' }) });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setSuccessMsg(`OTP sent to ${cleanPhone}!`);
        setCooldown(60);
        const timer = setInterval(() => { setCooldown((p) => { if (p <= 1) { clearInterval(timer); return 0; } return p - 1; }); }, 1000);
      } else {
        setErrorMsg(data.error || 'Failed to send OTP.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to OTP gateway.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) { setErrorMsg('Enter the 6-digit OTP code.'); return; }
    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanPhone = phone.startsWith('+') ? phone.trim() : `+91${phone.trim()}`;
      const res = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: cleanPhone, otpCode: otp.trim() }) });
      const data = await res.json();
      if (data.success) {
        saveUserProfile({ id: `usr_phone_${Date.now()}`, authenticated: true, sms_phone: cleanPhone, name: cleanPhone });
        setSuccessMsg('Phone verified! Redirecting...');
        performRedirect();
      } else {
        setErrorMsg(data.error || 'OTP verification failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Determine which auth handler to use ───────────────────────────────────
  const handleEmailAuth = isFirebaseConfigured ? handleFirebaseAuth : handleSupabaseAuth;
  const isWorking = loading || actionLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/50">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div>
          <span className="font-extrabold tracking-tight text-2xl text-white">
            HEATSHIELD <span className="text-emerald-400 font-mono">AI</span>
          </span>
          <div className="text-[11px] text-slate-400 font-mono">REAL-TIME HEAT RISK PLATFORM</div>
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-8">
        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setAuthMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${authMode === 'signin' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <LogIn className="w-4 h-4 inline mr-1.5 -mt-0.5" />Sign In
          </button>
          <button
            onClick={() => { setAuthMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${authMode === 'signup' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <UserPlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />Sign Up
          </button>
        </div>

        {/* Auth Method Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAuthMethod('email')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition border ${authMethod === 'email' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/50' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >
            <Mail className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Email / Password
          </button>
          <button
            onClick={() => setAuthMethod('phone')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition border ${authMethod === 'phone' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/50' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >
            <Phone className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Phone OTP
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 bg-red-950/60 border border-red-700/50 text-red-300 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 flex items-start gap-2 bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Firebase config notice */}
        {!isFirebaseConfigured && (
          <div className="mb-4 bg-amber-950/40 border border-amber-700/40 text-amber-300 rounded-lg px-3 py-2 text-xs font-mono">
            Firebase Auth not configured — using Supabase Auth fallback
          </div>
        )}

        {/* ── Email / Password Form ── */}
        {authMethod === 'email' && authMode !== 'reset' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={authMode === 'signup' ? 'Minimum 6 characters' : 'Your password'}
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authMode === 'signin' && (
              <button
                type="button"
                onClick={() => { setAuthMode('reset'); setErrorMsg(null); setSuccessMsg(null); }}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              disabled={isWorking}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-600 text-white font-semibold rounded-lg transition"
            >
              {isWorking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : authMode === 'signup' ? (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        )}

        {/* ── Password Reset Form ── */}
        {authMethod === 'email' && authMode === 'reset' && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <p className="text-sm text-slate-400">Enter your email address and we&apos;ll send you a password reset link.</p>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isWorking}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white font-semibold rounded-lg transition"
            >
              {isWorking ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><RotateCcw className="w-4 h-4" /> Send Reset Email</>}
            </button>
            <button type="button" onClick={() => setAuthMode('signin')} className="w-full text-sm text-slate-400 hover:text-white transition">
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* ── Phone OTP Form ── */}
        {authMethod === 'phone' && (
          <form onSubmit={otpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  disabled={otpSent}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500 disabled:opacity-50"
                />
              </div>
            </div>
            {otpSent && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">6-Digit OTP Code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500 tracking-[0.3em] font-mono"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={isWorking || (cooldown > 0 && !otpSent)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-600 text-white font-semibold rounded-lg transition"
            >
              {isWorking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : otpSent ? (
                <><KeyRound className="w-4 h-4" /> Verify OTP</>
              ) : (
                <><Phone className="w-4 h-4" /> Send OTP {cooldown > 0 ? `(${cooldown}s)` : ''}</>
              )}
            </button>
          </form>
        )}

        {/* Footer links */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          <Link href="/privacy" className="hover:text-emerald-400 transition">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-emerald-400 transition">Terms of Service</Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600 font-mono text-center max-w-xs">
        HeatShield AI — Real-time environmental heat risk decision support.<br />
        Data is processed securely and never sold.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

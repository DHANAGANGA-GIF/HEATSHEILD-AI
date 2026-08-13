'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, LogIn, UserPlus, ArrowRight, AlertCircle, CheckCircle2, Lock, Mail, Phone, KeyRound } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveUserProfile, getUserProfile } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email & Password Auth Handler via Supabase
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        if (authMode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name || email.split('@')[0] },
            },
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

            if (data.session) {
              setSuccessMsg('Account created successfully! Redirecting to onboarding...');
              setTimeout(() => router.push('/onboarding'), 1200);
            } else {
              setSuccessMsg('Registration successful! Please check your email for confirmation or sign in.');
            }
          }
        } else {
          // Sign In
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;

          if (data.user) {
            const updated = saveUserProfile({
              id: data.user.id,
              email: data.user.email || email,
              name: data.user.user_metadata?.full_name || email.split('@')[0],
              authenticated: true,
            });

            setSuccessMsg('Login successful! Redirecting...');
            setTimeout(() => {
              if (updated.onboarded) {
                router.push('/dashboard');
              } else {
                router.push('/onboarding');
              }
            }, 800);
          }
        }
      } else {
        const currentProfile = getUserProfile();
        saveUserProfile({
          id: `usr_${Date.now()}`,
          email,
          name: name || email.split('@')[0],
          authenticated: true,
        });
        router.push(currentProfile.onboarded ? '/dashboard' : '/onboarding');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Phone OTP Handler via Supabase
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setErrorMsg('Please enter a valid phone number with country code (e.g. +919876543210).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone.startsWith('+') ? phone : `+91${phone}`,
        });

        if (error) {
          if (
            error.message.includes('not_enabled') ||
            error.message.includes('Unsupported provider') ||
            error.message.includes('provider') ||
            error.status === 400 ||
            error.status === 422
          ) {
            setErrorMsg('SMS verification is not configured yet on this Supabase project. Please use Email or Google Auth.');
            return;
          }
          throw error;
        }

        setOtpSent(true);
        setSuccessMsg(`OTP sent to ${phone}. Please enter the 6-digit code below.`);
        setCooldown(60);
        const timer = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMsg('SMS verification is not configured yet.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'SMS verification is not configured yet.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
        const { data, error } = await supabase.auth.verifyOtp({
          phone: formattedPhone,
          token: otp,
          type: 'sms',
        });

        if (error) throw error;

        if (data.user) {
          saveUserProfile({
            id: data.user.id,
            email: data.user.email || `${formattedPhone}@heatshield.org`,
            name: `User ${formattedPhone}`,
            authenticated: true,
          });
          setSuccessMsg('Phone verified successfully! Redirecting...');
          setTimeout(() => router.push('/dashboard'), 800);
        }
      } else {
        setErrorMsg('SMS verification is not configured yet.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Handler
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          if (
            error.message.includes('not_enabled') ||
            error.message.includes('Unsupported provider') ||
            error.message.includes('provider is not enabled')
          ) {
            setErrorMsg('Google Sign-In is not enabled on this Supabase project. Please sign up or log in using Email & Password below.');
          } else {
            throw error;
          }
        }
      } else {
        saveUserProfile({
          email: 'google.user@heatshield.org',
          name: 'Authenticated User',
          authenticated: true,
        });
        router.push('/onboarding');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In is not enabled on this Supabase project. Use Email & Password below.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Login Handler
  const handleDemoLogin = (role: 'user' | 'school' | 'worksite' | 'ngo' | 'admin') => {
    saveUserProfile({
      id: `usr_demo_${role}`,
      name: `${role.toUpperCase()} Demo Account`,
      email: `${role}@heatshield-demo.org`,
      role,
      authenticated: true,
      onboarded: true,
    });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-10 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold mb-3 shadow-md">
            <Shield className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            HeatShield AI
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            AUTHENTICATION & DECISION SUPPORT PORTAL
          </p>
        </div>

        {/* Method Selector Tabs: Email / Phone */}
        <div className="flex bg-slate-950 p-1 rounded-xl mb-4 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => { setAuthMethod('email'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMethod === 'email' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('phone'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-2 font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              authMethod === 'phone' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone OTP</span>
          </button>
        </div>

        {/* Email Mode Sub-Toggle (Sign In vs Create Account) */}
        {authMethod === 'email' && (
          <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'signin' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'signup' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-950/70 border border-rose-800 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg flex items-start gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* EMAIL AUTH FORM */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-semibold">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Alex Rivera"
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-semibold">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@heatshield.org"
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 pl-10 pr-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-semibold">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 pl-10 pr-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating with Supabase...</span>
              ) : authMode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Supabase Account</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In with Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* PHONE OTP FORM */}
        {authMethod === 'phone' && (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-semibold">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full bg-slate-950 text-white text-xs rounded-xl border border-slate-800 pl-10 pr-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Include country code (e.g. +91 for India, +1 for US/Canada).</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <span>Sending OTP...</span> : <span>Send Verification Code</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase mb-1 font-semibold">Enter 6-Digit OTP</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-slate-950 text-white text-sm rounded-xl border border-slate-800 pl-10 pr-3.5 py-2.5 font-mono tracking-widest text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <span>Verifying...</span> : <span>Verify OTP & Sign In</span>}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                    className="underline hover:text-white"
                  >
                    Change Number
                  </button>

                  <button
                    type="button"
                    disabled={cooldown > 0 || loading}
                    onClick={handleSendPhoneOtp}
                    className="hover:text-white disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="my-5 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span className="h-px bg-slate-800 flex-1" />
          <span className="px-3 uppercase">Alternative Auth</span>
          <span className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-3 transition border border-slate-700 disabled:opacity-50 mb-5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Quick Demo Access */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-mono text-slate-400 font-semibold mb-2">QUICK DEMO SESSIONS (REVIEWERS)</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin('user')}
              className="py-2 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold text-left border border-slate-800 transition flex items-center justify-between"
            >
              <span>User Demo</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('school')}
              className="py-2 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold text-left border border-slate-800 transition flex items-center justify-between"
            >
              <span>School Admin</span>
              <ArrowRight className="w-3 h-3 text-blue-400" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('worksite')}
              className="py-2 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold text-left border border-slate-800 transition flex items-center justify-between"
            >
              <span>Worksite Safety</span>
              <ArrowRight className="w-3 h-3 text-amber-400" />
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('ngo')}
              className="py-2 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold text-left border border-slate-800 transition flex items-center justify-between"
            >
              <span>NGO Lead</span>
              <ArrowRight className="w-3 h-3 text-rose-400" />
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 font-sans">
          By logging in, you agree to HeatShield AI&apos;s <Link href="/terms" className="underline hover:text-slate-300">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-slate-300">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldCheck, CheckCircle2, AlertCircle, Loader2, ArrowRight,
  Mail, Smartphone, KeyRound, RefreshCw, Sparkles, Shield
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { saveUserProfile, getUserProfile } from '@/lib/store';
import { useAuth } from '@/lib/firebase/auth-context';

function VerifyContent() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const tokenParam = searchParams ? searchParams.get('token') : null;
  const targetParam = searchParams ? searchParams.get('target') : null;
  const channelParam = searchParams ? searchParams.get('channel') : null;

  const [target, setTarget] = useState(targetParam || '');
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verifiedTarget, setVerifiedTarget] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoVerified, setAutoVerified] = useState(false);

  // Auto-verify if token is present in the query URL
  useEffect(() => {
    if (tokenParam) {
      handleAutoVerifyToken(tokenParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam]);

  const handleAutoVerifyToken = async (token: string) => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificationSuccess(true);
        setAutoVerified(true);
        const resolved = data.target || targetParam || 'User';
        setVerifiedTarget(resolved);

        // Update profile in store
        const existing = getUserProfile();
        if (data.channel === 'SMS' || !resolved.includes('@')) {
          saveUserProfile({ sms_phone: resolved, authenticated: true });
        } else {
          saveUserProfile({ email: resolved, authenticated: true });
        }
      } else {
        setErrorMsg(data.error || 'Magic link verification failed or expired.');
      }
    } catch (err: any) {
      setErrorMsg('Network error connecting to verification gateway.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the full 6-digit OTP passcode.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ otpCode: otpCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificationSuccess(true);
        setVerifiedTarget(data.target || target.trim() || firebaseUser?.email || 'User');

        const existing = getUserProfile();
        if (target.includes('@') || firebaseUser?.email) {
          saveUserProfile({ email: data.target || firebaseUser?.email || target.trim(), authenticated: true });
        } else {
          saveUserProfile({ sms_phone: target.trim(), authenticated: true });
        }
      } else {
        setErrorMsg(data.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to reach verification service.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Subtle glow header */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

          {verificationSuccess ? (
            <div className="text-center py-4 space-y-5 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-3 py-1 rounded-full uppercase">
                  Identity Verified
                </span>
                <h1 className="text-2xl font-bold text-white mt-3">
                  Verification Complete!
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Your identity <span className="text-slate-200 font-mono font-semibold">{verifiedTarget}</span> has been authenticated for real-time heat alerts and emergency dispatches.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Verification Method:</span>
                  <span className="text-emerald-400 font-semibold">{autoVerified ? '⚡ 1-Click Magic Link' : '🔑 6-Digit OTP Code'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-semibold">Active & Certified</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Verified Timestamp:</span>
                  <span className="text-slate-200">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <Link
                  href="/dashboard"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-emerald-500/20"
                >
                  Enter Operational Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/notifications"
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl text-xs transition"
                >
                  Go to Notification Center
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Security OTP & Magic Link Verification
                </h1>
                <p className="text-xs text-slate-400">
                  Verify your email or phone number to receive real-time thermal alerts and emergency advisories.
                </p>
              </div>

              {isVerifying ? (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-300">Validating verification credentials...</p>
                  <p className="text-xs text-slate-500 font-mono">HeatShield Cryptographic Handshake</p>
                </div>
              ) : (
                <form onSubmit={handleManualCodeVerify} className="space-y-4">
                  {errorMsg && (
                    <div className="bg-red-950/50 border border-red-800/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-200 animate-shake">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Address or Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        {target.includes('@') ? <Mail className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                      </div>
                      <input
                        type="text"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="e.g. user@example.com or +919876543210"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>6-Digit Verification Code (OTP)</span>
                      <span className="text-[10px] text-slate-500 font-mono">From SMS or Email</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base tracking-widest font-mono text-emerald-400 placeholder-slate-700 text-center font-bold focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying Code...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Activate Alerts
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <Link
                      href="/notifications"
                      className="text-xs text-slate-500 hover:text-slate-400 transition"
                    >
                      Need to send a fresh OTP? Go to Notifications Hub &rarr;
                    </Link>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900 font-mono">
        HeatShield AI &copy; 2026 • Real-Time Environmental Risk & Communication Engine
      </footer>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

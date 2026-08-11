'use client';


import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, LogIn, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveUserProfile } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/onboarding`,
          },
        });
        if (error) throw error;
      } else {
        // Fallback for demo environment when Supabase keys are default
        saveUserProfile({
          email: 'google.demo.user@heatshield.org',
          name: 'Authenticated Google User',
        });
        router.push('/onboarding');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Authentication failed. Please try demo login.');
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: 'user' | 'school' | 'worksite' | 'ngo' | 'admin') => {
    saveUserProfile({
      id: `usr_demo_${role}`,
      name: `${role.toUpperCase()} Demo Account`,
      email: `${role}@heatshield-demo.org`,
      role,
    });
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Link href="/" className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold mb-4 shadow-md">
            <Shield className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Log in to HeatShield AI
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            REAL-TIME HEAT RISK DECISION SUPPORT
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 transition shadow-sm border border-slate-200 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
        </button>

        <div className="my-6 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span className="h-px bg-slate-800 flex-1" />
          <span className="px-3">OR DEMO SESSION</span>
          <span className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Demo Quick Login Options */}
        <div className="space-y-2">
          <button
            onClick={() => handleDemoLogin('user')}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition border border-slate-700"
          >
            <span>Standard User Demo</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          </button>
          <button
            onClick={() => handleDemoLogin('school')}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition border border-slate-700"
          >
            <span>School Administrator Demo</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button
            onClick={() => handleDemoLogin('worksite')}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition border border-slate-700"
          >
            <span>Worksite Safety Officer Demo</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            onClick={() => handleDemoLogin('ngo')}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition border border-slate-700"
          >
            <span>NGO Community Leader Demo</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
          </button>
          <button
            onClick={() => handleDemoLogin('admin')}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between transition border border-slate-700"
          >
            <span>Platform Super Admin Demo</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>

        <div className="mt-8 text-center text-[11px] text-slate-500 leading-normal font-sans">
          By logging in, you agree to HeatShield AI&apos;s <Link href="/terms" className="underline hover:text-slate-300">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-slate-300">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}

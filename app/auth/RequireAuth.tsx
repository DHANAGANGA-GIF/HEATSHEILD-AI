// app/auth/RequireAuth.tsx
'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SystemStatusValue } from '@/components/SystemStatusPanel';

/**
 * Guard component that ensures a user is authenticated via Supabase.
 * If no session is present, redirects to /login.
 * While checking, shows a minimal loading state.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<SystemStatusValue>('LOADING');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Supabase not configured – treat as signed out for safety.
      setAuthStatus('SIGNED OUT');
      router.replace('/login');
      return;
    }

    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setAuthStatus('SIGNED OUT');
        router.replace('/login');
      } else {
        setAuthStatus('AUTHENTICATED');
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAuthStatus('SIGNED OUT');
        router.replace('/login');
      } else {
        setAuthStatus('AUTHENTICATED');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // While we are still determining auth status, render nothing (or a tiny loader).
  if (authStatus === 'LOADING') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-sm text-slate-600">Checking authentication…</span>
      </div>
    );
  }

  // Authenticated – render wrapped content.
  return <>{children}</>;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveUserProfile } from '@/lib/store';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      if (isSupabaseConfigured && supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth callback error:', error);
          router.replace('/login?error=auth_callback_failed');
          return;
        }

        if (session?.user) {
          saveUserProfile({
            id: session.user.id,
            email: session.user.email || 'user@heatshield.org',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            authenticated: true,
          });
          router.replace('/onboarding');
          return;
        }
      }
      router.replace('/login');
    }

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-slate-400">Authenticating session with Supabase...</p>
      </div>
    </div>
  );
}

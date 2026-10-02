import type { Metadata } from 'next';
import './globals.css';
import { FirebaseAuthProvider } from '@/lib/firebase/auth-context';

// Force all pages to be rendered dynamically at request time.
// Prevents static-prerendering failures caused by browser-only APIs
// (localStorage, Supabase, geolocation) used in client components.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HeatShield AI V2.1 — Persistent Authentication + Multilingual Real-Time Heat Safety',
  description: 'AI-Based Heat Risk Awareness and Preventive Guidance System with persistent sessions, verified multilingual translations (EN, TE, TA, HI), and real-time open meteorological telemetry.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 font-sans">
        <FirebaseAuthProvider>
          {children}
        </FirebaseAuthProvider>
      </body>
    </html>
  );
}

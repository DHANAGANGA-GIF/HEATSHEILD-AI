import type { Metadata } from 'next';
import './globals.css';
import { FirebaseAuthProvider } from '@/lib/firebase/auth-context';

// Force all pages to be rendered dynamically at request time.
// Prevents static-prerendering failures caused by browser-only APIs
// (localStorage, Supabase, geolocation) used in client components.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HEATSHIELD AI — Real-Time Heat Risk Decision Support',
  description: 'Real-time, context-aware heat-risk decision support for people, schools, worksites, and communities.',
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

/**
 * HeatShield AI — Public Landing Page (Server Component)
 *
 * This is a Next.js App Router server component. It provides SEO metadata
 * and delegates all interactive rendering to <PublicLanding />, which is a
 * client component because the live checker requires browser APIs.
 *
 * DO NOT add any authentication or database calls here — the landing page
 * must work for unauthenticated visitors.
 */

import type { Metadata } from 'next';
import PublicLanding from '@/components/PublicLanding';

export const metadata: Metadata = {
  title: 'HeatShield AI — Real-Time Heat Risk Checker | No Login Required',
  description:
    'Check your heat risk right now using real Open-Meteo weather data and a transparent rule-based calculation. No login required. Supports 4000+ cities worldwide. Get actionable heat safety precautions instantly.',
  keywords: [
    'heat risk', 'heat index', 'heat stress', 'heat safety', 'weather risk',
    'heat stroke prevention', 'open-meteo', 'India heat alert', 'heat risk calculator',
  ],
  openGraph: {
    title: 'HeatShield AI — Check Your Heat Risk',
    description:
      'Real-time heat risk assessment using Open-Meteo weather and the Steadman/Rothfusz Heat Index. No login required.',
    type: 'website',
    siteName: 'HeatShield AI',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingPage() {
  return <PublicLanding />;
}

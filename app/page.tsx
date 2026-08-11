'use client';


import React from 'react';
import Link from 'next/link';
import {
  Shield,
  Sun,
  Flame,
  Activity,
  MessageSquare,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BarChart2,
  Globe,
  Database,
  Lock
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white font-sans">
              HEATSHIELD <span className="text-emerald-400 font-mono">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="#how-it-works" className="hover:text-emerald-400 transition">How It Works</a>
            <a href="#features" className="hover:text-emerald-400 transition">Features</a>
            <a href="#organizations" className="hover:text-emerald-400 transition">Organizations</a>
            <a href="#responsible-ai" className="hover:text-emerald-400 transition">Safety & AI</a>
            <a href="#faq" className="hover:text-emerald-400 transition">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Log In
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5"
            >
              <span>Check Heat Risk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-mono mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-Time Environmental Heat Risk Decision Support</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Understand heat risk. <br />
          <span className="text-emerald-400">Take action earlier.</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          Real-time, context-aware heat-risk decision support for people, schools, worksites, and communities.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Check Your Heat Risk</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-800 transition"
          >
            Explore HeatShield AI
          </a>
        </div>

        {/* Operational Metrics Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-left font-mono">
          <div>
            <div className="text-2xl font-bold text-emerald-400">0 - 100</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Explainable Risk Index</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">Open-Meteo</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Live Weather Stream</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">Leaflet OSM</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Spatial Intelligence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">â‚¹0 Budget</div>
            <div className="text-xs text-slate-400 mt-1 font-sans">Open-Source College MVP</div>
          </div>
        </div>
      </section>

      {/* Section 1: How it Works */}
      <section id="how-it-works" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              METHODOLOGY
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              HEAT â†’ INTELLIGENCE â†’ RISK â†’ ACTION â†’ COMMUNITY
            </p>
            <p className="mt-3 text-slate-400 text-sm">
              HeatShield AI combines live meteorology with user exposure context to generate actionable safety support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-left">
            {[
              { step: '01', title: 'Environmental Fetch', desc: 'Queries Open-Meteo for air temperature, humidity, apparent temp, and wind velocity.' },
              { step: '02', title: 'Context Fusion', desc: 'Integrates physical activity level, exposure duration, cooling availability, and age.' },
              { step: '03', title: 'ML Risk Engine', desc: 'Computes Steadman Heat Index & decision tree predictions to score risk from 0 to 100.' },
              { step: '04', title: 'XAI Attribution', desc: 'Explains exact factor weights (e.g. 42% temperature, 28% humidity) for total transparency.' },
              { step: '05', title: 'Targeted Guidance', desc: 'Delivers personalized hydration, work-rest cycles, shade rules, and community check-ins.' },
            ].map((st, i) => (
              <div key={i} className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div className="text-xl font-bold font-mono text-emerald-400 mb-3">{st.step}</div>
                <h3 className="text-sm font-semibold text-white mb-1">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 & 3: Real-Time Risk & Personalized Guidance */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono mb-4">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contextual Decision Support</span>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight leading-snug">
              Explainable Risk Scores & <br />
              <span className="text-emerald-400">Personalized Preventive Guidance</span>
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Generic temperature readings fail to convey individual risk. HeatShield AI models heat strain based on humidity, physical workload, sun exposure time, and cooling access.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>0 - 100 Heat Risk Scale:</strong> Clearly categorized into LOW, MODERATE, HIGH, and EXTREME.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Explainable AI (XAI):</strong> Displays exact percentage contributions for every environmental & contextual factor.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Actionable Precautions:</strong> Hydration schedules, shade recovery, work-rest intervals, and vulnerable group check-ins.</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400">DEMO RISK PREVIEW</span>
                <div className="text-2xl font-bold text-white font-mono mt-0.5">HIGH RISK (76/100)</div>
              </div>
              <span className="px-3 py-1 bg-amber-600 text-white font-bold text-xs rounded uppercase">HIGH</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Apparent Temperature (38.5Â°C)</span>
                <span className="text-emerald-400 font-bold">42% impact</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Relative Humidity (68%)</span>
                <span className="text-emerald-400 font-bold">28% impact</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Moderate Outdoor Activity</span>
                <span className="text-emerald-400 font-bold">18% impact</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Organization Solutions */}
      <section id="organizations" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              ORGANIZATION PORTALS
            </h2>
            <p className="mt-2 text-3xl font-bold text-white tracking-tight">
              Tailored Operational Dashboards
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-blue-900/50 text-blue-400 flex items-center justify-center mb-4">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">School Dashboard</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Outdoor sports safety planning, student physical activity level guidelines, and shade availability checklists.
              </p>
              <Link href="/school" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
                <span>View School Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-amber-900/50 text-amber-400 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Worksite Safety</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                OSHA/NIOSH-aligned work-rest cycle schedules, hydration compliance logging, and site exposure planners.
              </p>
              <Link href="/worksite" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
                <span>View Worksite Safety</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-rose-900/50 text-rose-400 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">NGO Vulnerability Portal</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Community report clusters, water point tracking, vulnerable group check-ins, and emergency response maps.
              </p>
              <Link href="/ngo" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
                <span>View NGO Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Responsible AI & Safety Notice */}
      <section id="responsible-ai" className="py-16 bg-slate-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-6 rounded-xl bg-amber-950/20 border border-amber-800/40 text-left">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-sm mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>RESPONSIBLE AI & SAFETY GOVERNANCE</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              HeatShield AI is a software decision support platform designed to assist individuals and managers in understanding heat risk. 
              <strong> It does not perform medical diagnosis, diagnose heatstroke or disease, prescribe medication, or guarantee safety.</strong> 
              If you or someone around you exhibits severe hyperthermic symptoms (such as confusion, dizziness, fainting, or cessation of sweating), contact local emergency medical services immediately.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white tracking-tight text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4 text-left">
            {[
              { q: 'Is HeatShield AI completely free to use?', a: 'Yes. HeatShield AI is designed as a â‚¹0 zero-budget MVP using open-source weather APIs (Open-Meteo) and Leaflet OpenStreetMap.' },
              { q: 'How does the Heat Risk Engine compute scores?', a: 'It calculates Steadman Heat Index equations combined with apparent temperature, relative humidity, physical activity level, exposure duration, and cooling access.' },
              { q: 'Does HeatShield AI provide medical diagnoses?', a: 'No. HeatShield AI provides operational decision support and general preventive guidance. It does not replace professional medical advice or emergency medical services.' },
              { q: 'Can organizations use HeatShield AI for worksite or school planning?', a: 'Yes. Dedicated dashboards exist for schools, worksites, and NGOs to manage work-rest cycles, outdoor activity guidelines, and community reports.' },
            ].map((faq, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-300 font-sans">HEATSHIELD AI</span>
            <span>â€” College MVP Software Prototype</span>
          </div>

          <div className="flex items-center gap-6 font-sans">
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms & Disclaimer</Link>
            <Link href="/help" className="hover:text-slate-300">Help Center</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

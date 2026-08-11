# System Architecture — HEATSHIELD AI

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NEXT.JS FRONTEND LAYER                               │
│  App Router + TypeScript + Tailwind CSS + Lucide Icons + Leaflet Maps + Recharts       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           ▼                                ▼                                ▼
┌──────────────────────┐        ┌──────────────────────┐        ┌────────────────────────┐
│ Environmental Stream │        │ Supabase PostgreSQL  │        │ Python / TS ML Engine  │
│ Open-Meteo API       │        │ Auth (Google OAuth)  │        │ Decision Tree & RF     │
│ Geocoding API        │        │ Resilient Sync Store │        │ XAI Feature Importance │
└──────────────────────┘        └──────────────────────┘        └────────────────────────┘
```

## Architectural Highlights
1. **Frontend:** Next.js 14 App Router with server/client component boundaries.
2. **Environmental Ingestion:** Direct REST fetching from Open-Meteo with 15-minute client-side caching.
3. **Database & Auth:** Supabase PostgreSQL with RLS + localStorage sync fallback.
4. **AI Inference:** Pure TypeScript client inference engine inside Next.js + deployable Python FastAPI service in `/ai-engine`.

# HeatShield AI — Production & Demo Environment Specification

> **Configuration Guide for Production Hosting & Demo Environment**  
> **Date**: August 2026  
> **Version**: 1.0.0 (Release Tag `v1.0.0`)  

---

## 1. Production Deployment & Hosting URLs

- **Primary Production URL**: `https://heatshield-ai.vercel.app` *(or configured Vercel subdomain)*
- **Backup Local URL**: `http://localhost:3000`
- **Hosting Provider**: Vercel Serverless Edge (Free Tier)
- **Database & Auth**: Supabase PostgreSQL (Free Tier)

---

## 2. Environment Variables Configuration (Vercel Console)

The following public environment variables must be configured in Vercel Project Settings > Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
NEXT_PUBLIC_WEATHER_API_URL=https://api.open-meteo.com/v1/forecast
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

> [!CAUTION]
> **Zero Credentials Exposure**: No passwords, service-role keys, or JWT secret tokens are stored in documentation or source code.

---

## 3. Demo Environment Credentials & Access

- **Standard User**: Authenticate via Supabase Auth or test user profile on `/onboarding`
- **School Manager**: Demo School Administrator Role (configured via `lib/organization-service.ts`)
- **Worksite Manager**: Demo Worksite Manager Role
- **NGO Moderator**: Demo NGO Moderator Role
- **Platform Admin**: Demo Platform Admin Role

> *Security Note*: Passwords and authentication secrets are entered dynamically during manual demonstration and are never hardcoded in repository documentation.

---

## 4. Required Permissions & Dependencies

- **Browser Permissions**: Location / Geolocation access (`navigator.geolocation`)
- **External Data Dependencies**:
  - Open-Meteo REST Weather API (`api.open-meteo.com`)
  - OpenStreetMap & Leaflet Map Tiles (`tile.openstreetmap.org`)
  - Supabase Auth & Database (`*.supabase.co`)
- **Network Dependencies**: Active Internet Connection (with automatic LocalStorage cache fallback during network degradation)

---

*Production & Demo Environment Specification Complete — August 2026*

# HeatShield AI — Zero-Budget Deployment Guide

> Step-by-step instructions for deploying HeatShield AI on zero-budget, serverless cloud infrastructure (Vercel + Supabase + Open-Meteo).

---

## 1. Prerequisites

- Node.js 18.x or 20.x installed
- Git version control
- Free Supabase account ([supabase.com](https://supabase.com))
- Free Vercel account ([vercel.com](https://vercel.com))
- No paid API keys or credit cards required!

---

## 2. Environment Variables

Create `.env.local` for local development. For production, set these variables in the **Vercel Project Settings > Environment Variables** console.

```bash
# Supabase Auth & Database (Free Tier)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here

# Open-Meteo Environmental API (Free - No API Key Required!)
NEXT_PUBLIC_WEATHER_API_URL=https://api.open-meteo.com/v1/forecast

# Python ML Engine (Optional - Client TS inference engine works standalone!)
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

> [!CAUTION]
> **NEVER COMMIT CREDENTIALS**: Never commit `.env`, `.env.local`, `service_role` keys, JWT secret tokens, or passwords to Git. All secrets must remain strictly in environment variables.

---

## 3. Supabase Project Setup & Database Migration

1. Log into [Supabase Dashboard](https://database.new) and create a new free-tier project (e.g., `heatshield-ai-prod`).
2. Navigate to **SQL Editor** in the Supabase Dashboard.
3. Copy the entire contents of [`supabase/schema.sql`](file:///C:/Users/rowad/csp%20%231/supabase/schema.sql) from this repository.
4. Paste and click **RUN** to create all 9 PostgreSQL tables, indexes, and Row Level Security (RLS) policies.
5. In **Authentication > Settings**, enable Email / OAuth providers as needed. Set Redirect URL to `https://your-app.vercel.app/login`.

---

## 4. Local Development Verification

```bash
# Install dependencies
npm install

# Run TypeScript typecheck
npx tsc --noEmit

# Run test suite (78 tests)
npm test

# Launch dev server
npm run dev
```

Open `http://localhost:3000` to verify the landing page and dashboard.

---

## 5. Production Build Verification

Verify that the Next.js production build completes without errors prior to deployment:

```bash
npm run build
```

This compiles 26 static app routes.

---

## 6. Vercel Deployment

1. Push your repository to GitHub / GitLab.
2. Go to [Vercel Dashboard](https://vercel.com/new) and select **Import Project**.
3. Select the `heatshield-ai` repository.
4. Framework Preset: **Next.js**.
5. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WEATHER_API_URL`
6. Click **Deploy**.
7. Vercel will build and deploy the site in ~60 seconds to `https://your-project.vercel.app`.

---

## 7. Machine Learning Engine Setup Options

HeatShield AI supports two execution modes for ML inference:

- **Mode A (Default Zero-Budget Standalone)**: The pure TypeScript client inference engine executes directly in the browser/Next.js client environment. Requires zero extra server configuration!
- **Mode B (Optional FastAPI Microservice)**: Navigate to `/ai-engine`:
  ```bash
  cd ai-engine
  pip install -r requirements.txt
  python train_model.py
  uvicorn main:app --reload --port 8000
  ```

---

## 8. Domain Configuration (Optional)

In Vercel Dashboard > Project Settings > Domains, you can map a free custom domain or use the provided `.vercel.app` subdomain. Ensure your Supabase Auth Site URL matches your production domain.

---

## 9. Troubleshooting & FAQ

| Problem | Cause | Solution |
|---|---|---|
| Open-Meteo returns HTTP 429 | Rate limit hit | Client-side 15-minute caching will automatically serve `CACHED` payload |
| Supabase Auth fails on login | Site URL mismatch | Add production domain to Supabase Auth > URL Configuration |
| RLS blocks database query | User not logged in | Ensure user profile exists and `auth.uid()` matches |

---

## 10. Free-Tier Limitations & Operational Constraints

1. **Open-Meteo API**: Free tier allows up to 10,000 daily calls per IP. HeatShield AI client-side caching minimizes API calls.
2. **Supabase Database**: Free tier pauses inactive projects after 7 days.
3. **Vercel Functions**: Free tier includes 100GB-hours execution time, ample for production deployment.

---

*Zero-Budget Deployment Guide Verified for HeatShield AI v1.0.0*

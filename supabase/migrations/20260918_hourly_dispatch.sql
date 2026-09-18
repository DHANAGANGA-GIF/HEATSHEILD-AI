-- Migration: 20260918_hourly_dispatch.sql
-- HeatShield AI — Hourly Personalized Heat-Risk Dispatch System & Idempotency Log

-- 1. Add alert preferences and email verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_heat_alerts_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 2. Create heat_risk_dispatch_log table
CREATE TABLE IF NOT EXISTS public.heat_risk_dispatch_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    weather_timestamp TIMESTAMP WITH TIME ZONE,
    risk_score INT CHECK (risk_score BETWEEN 0 AND 100),
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')),
    model_version TEXT DEFAULT 'HeatShield-ML v1.3.0 (Physics-Context Dual Engine)',
    dispatch_key TEXT UNIQUE NOT NULL,
    provider_message_id TEXT,
    status TEXT CHECK (status IN ('SENT', 'ACCEPTED', 'DELIVERED', 'FAILED', 'SKIPPED')) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_key ON public.heat_risk_dispatch_log (dispatch_key);
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_email ON public.heat_risk_dispatch_log (recipient_email);
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_status ON public.heat_risk_dispatch_log (status);
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_sent_at ON public.heat_risk_dispatch_log (sent_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.heat_risk_dispatch_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users read own dispatch logs" ON public.heat_risk_dispatch_log;
CREATE POLICY "Users read own dispatch logs" ON public.heat_risk_dispatch_log
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all dispatch logs" ON public.heat_risk_dispatch_log;
CREATE POLICY "Admins read all dispatch logs" ON public.heat_risk_dispatch_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Service and auth insert dispatch logs" ON public.heat_risk_dispatch_log;
CREATE POLICY "Service and auth insert dispatch logs" ON public.heat_risk_dispatch_log
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role') OR auth.uid() = user_id);

-- Migration: 20261004_multilingual_notifications.sql
-- HeatShield AI — Multilingual User Language System, Notification Preferences & Notification Logs

-- 1. Update preferred_language check constraint on profiles to include 'te' (Telugu)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check 
  CHECK (preferred_language IN ('en', 'te', 'ta', 'hi'));

-- 2. Add notification preferences, timezone, quiet hours, and firebase_uid columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS minimum_risk_level TEXT CHECK (minimum_risk_level IN ('all', 'moderate', 'high', 'extreme')) DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS forecast_alerts_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "07:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- Index for fast lookup by firebase_uid
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles (firebase_uid);

-- 3. Create persistent notification_logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')),
    language TEXT CHECK (language IN ('en', 'te', 'ta', 'hi')) DEFAULT 'en',
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'ACCEPTED')) NOT NULL,
    provider_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    event_fingerprint TEXT
);

-- Performance indexes on notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_language ON public.notification_logs (language);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs (status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_fingerprint ON public.notification_logs (event_fingerprint);

-- Enable RLS on notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_logs
DROP POLICY IF EXISTS "Users read own notification logs" ON public.notification_logs;
CREATE POLICY "Users read own notification logs" ON public.notification_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all notification logs" ON public.notification_logs;
CREATE POLICY "Admins read all notification logs" ON public.notification_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Service and auth insert notification logs" ON public.notification_logs;
CREATE POLICY "Service and auth insert notification logs" ON public.notification_logs
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role') OR auth.uid() = user_id);

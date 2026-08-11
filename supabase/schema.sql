-- HEATSHIELD AI PostgreSQL Database Schema
-- Compatible with Supabase PostgreSQL & Row Level Security (RLS)

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    age_group TEXT CHECK (age_group IN ('child', 'adult', 'older_adult', 'prefer_not_to_say')) DEFAULT 'adult',
    exposure TEXT CHECK (exposure IN ('indoors', 'occasional', 'work', 'physical')) DEFAULT 'occasional',
    activity_level TEXT CHECK (activity_level IN ('low', 'moderate', 'high')) DEFAULT 'moderate',
    exposure_duration TEXT CHECK (exposure_duration IN ('short', 'moderate', 'long')) DEFAULT 'moderate',
    cooling_access TEXT CHECK (cooling_access IN ('good', 'limited', 'prefer_not_to_say')) DEFAULT 'good',
    preferred_language TEXT CHECK (preferred_language IN ('en', 'ta', 'hi')) DEFAULT 'en',
    role TEXT CHECK (role IN ('user', 'school', 'worksite', 'ngo', 'admin')) DEFAULT 'user',
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('school', 'worksite', 'ngo')) NOT NULL,
    locality TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    member_count INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SAVED LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.saved_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    locality TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. WEATHER OBSERVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.weather_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    relative_humidity DOUBLE PRECISION NOT NULL,
    apparent_temperature DOUBLE PRECISION NOT NULL,
    wind_speed DOUBLE PRECISION NOT NULL,
    pressure DOUBLE PRECISION,
    weather_code INT,
    is_cached BOOLEAN DEFAULT FALSE,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RISK ASSESSMENTS TABLE
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    risk_score INT CHECK (risk_score BETWEEN 0 AND 100) NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')) NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    apparent_temperature DOUBLE PRECISION NOT NULL,
    relative_humidity DOUBLE PRECISION NOT NULL,
    activity_level TEXT NOT NULL,
    model_version TEXT DEFAULT 'HeatShield-XAI v1.2',
    data_source TEXT DEFAULT 'Open-Meteo API',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INCIDENTS / COMMUNITY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT CHECK (category IN ('water_access', 'shade_cooling', 'outdoor_heat', 'public_space', 'other')) NOT NULL,
    description TEXT NOT NULL,
    location_name TEXT NOT NULL,
    locality TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'RESOLVED', 'REJECTED')) DEFAULT 'SUBMITTED',
    votes_count INT DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. NOTIFICATIONS / ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.1 ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'organization_admin', 'manager', 'staff', 'member', 'school', 'worksite', 'ngo', 'user')) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng ON public.incidents (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_user ON public.risk_assessments (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON public.saved_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members (organization_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INTENTIONAL DESIGN: Community incident reports are publicly readable for situational awareness.
-- user_id is a UUID (not email/name). Email and profile data are never exposed through this table.
-- Modification (INSERT/UPDATE/DELETE) remains strictly restricted to the owning user.
CREATE POLICY "Public read community incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Users insert own incidents" ON public.incidents FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users update own incidents" ON public.incidents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own incidents" ON public.incidents FOR DELETE USING (auth.uid() = user_id);

-- Organization Isolation Policies
CREATE POLICY "Members read own organization" ON public.organizations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid()));

CREATE POLICY "Org Admins manage own organization" ON public.organizations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid() AND role IN ('admin', 'organization_admin')));

CREATE POLICY "Members read organization members" ON public.organization_members FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

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
    hourly_heat_alerts_enabled BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
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

-- 9. HEAT RISK DISPATCH LOG TABLE (Hourly Idempotent Notification Log)
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
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_key ON public.heat_risk_dispatch_log (dispatch_key);
CREATE INDEX IF NOT EXISTS idx_heat_risk_dispatch_email ON public.heat_risk_dispatch_log (recipient_email);

-- ROW LEVEL SECURITY (RLS) POLICIES — COMPREHENSIVE LEAST-PRIVILEGE COVERAGE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heat_risk_dispatch_log ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Table Policies (Private user data isolation)
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Organization Isolation Policies
CREATE POLICY "Members read own organization" ON public.organizations
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid()));
CREATE POLICY "Org Admins manage own organization" ON public.organizations
    FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid() AND role IN ('admin', 'organization_admin')));
CREATE POLICY "Members read organization members" ON public.organization_members
    FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- 3. Saved Locations Policies (User data isolation)
CREATE POLICY "Users read own locations" ON public.saved_locations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own locations" ON public.saved_locations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own locations" ON public.saved_locations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own locations" ON public.saved_locations
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Weather Observations Policies (Public read for meteorological data, authorized write)
CREATE POLICY "Public read weather observations" ON public.weather_observations
    FOR SELECT USING (true);
CREATE POLICY "Authenticated insert weather observations" ON public.weather_observations
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 5. Risk Assessments Policies (User data isolation)
CREATE POLICY "Users read own assessments" ON public.risk_assessments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessments" ON public.risk_assessments
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 6. Incidents / Community Reports Policies
-- Public read for collective situational awareness; modification strictly restricted to report owner
CREATE POLICY "Public read community incidents" ON public.incidents
    FOR SELECT USING (true);
CREATE POLICY "Users insert own incidents" ON public.incidents
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users update own incidents" ON public.incidents
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own incidents" ON public.incidents
    FOR DELETE USING (auth.uid() = user_id);

-- 7. Notifications Policies (Private alerts)
CREATE POLICY "Users read own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- 8. Audit Logs Policies (User can read own, admins read org logs)
CREATE POLICY "Users read own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read organization audit logs" ON public.audit_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Service and auth insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role') OR user_id = auth.uid());

-- 9. Heat Risk Dispatch Log Policies (Idempotent delivery audit log)
CREATE POLICY "Users read own dispatch logs" ON public.heat_risk_dispatch_log
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all dispatch logs" ON public.heat_risk_dispatch_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));
CREATE POLICY "Service and auth insert dispatch logs" ON public.heat_risk_dispatch_log
    FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role') OR auth.uid() = user_id);



-- =====================================================
-- PHASE 1: ORGANIZATIONS + EMPLOYEE MANAGEMENT
-- Enterprise expense tracker — multi-tenant support
-- Run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,                                    -- e.g., 'company.com' for email domain matching
    logo_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,             -- flexible config: approval_required, max_advance, etc.
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update timestamp trigger
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. EMPLOYEE WHITELIST (CSV import staging table)
-- Admin uploads employees here; on signup, trigger
-- auto-populates profile from this table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.employee_whitelist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    employee_id TEXT NOT NULL,                      -- company employee ID (e.g., "EMP-001")
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT,
    designation TEXT,
    reporting_manager_email TEXT,                   -- resolved to UUID after both users exist
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee', 'accountant')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email),
    UNIQUE(organization_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_whitelist_org ON public.employee_whitelist(organization_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_email ON public.employee_whitelist(email);

CREATE TRIGGER update_whitelist_updated_at
    BEFORE UPDATE ON public.employee_whitelist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. ALTER PROFILES — Add enterprise columns
-- All new columns are nullable so existing data is safe
-- =====================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add CHECK constraint for role (skip if already exists)
DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('admin', 'manager', 'employee', 'accountant'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for enterprise queries
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_role ON public.profiles(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_manager ON public.profiles(reporting_manager_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_emp_org
    ON public.profiles(organization_id, employee_id)
    WHERE organization_id IS NOT NULL AND employee_id IS NOT NULL;

-- =====================================================
-- 4. UPDATE handle_new_user() TRIGGER
-- Now checks employee_whitelist on signup and auto-
-- populates org/role/department from it
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    wl RECORD;
    mgr_id UUID;
BEGIN
    -- Check if this email exists in any active whitelist
    SELECT * INTO wl
    FROM public.employee_whitelist
    WHERE email = NEW.email AND is_active = TRUE
    LIMIT 1;

    -- Resolve reporting manager (if their profile already exists)
    IF wl.reporting_manager_email IS NOT NULL THEN
        SELECT id INTO mgr_id
        FROM public.profiles
        WHERE email = wl.reporting_manager_email
        LIMIT 1;
    END IF;

    INSERT INTO public.profiles (
        id, name, email, profile_picture,
        employee_id, department, designation, role,
        organization_id, reporting_manager_id
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        wl.employee_id,
        wl.department,
        wl.designation,
        COALESCE(wl.role, 'employee'),
        wl.organization_id,
        mgr_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. HELPER: Resolve manager IDs for existing profiles
-- Run after CSV import to link managers who signed up
-- before their reports
-- =====================================================
CREATE OR REPLACE FUNCTION public.resolve_manager_ids(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    UPDATE public.profiles p
    SET reporting_manager_id = mgr.id
    FROM public.employee_whitelist w
    JOIN public.profiles mgr ON mgr.email = w.reporting_manager_email
        AND mgr.organization_id = p_org_id
    WHERE p.email = w.email
        AND p.organization_id = p_org_id
        AND w.organization_id = p_org_id
        AND w.reporting_manager_email IS NOT NULL
        AND p.reporting_manager_id IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Organizations: members can read own org, admins can manage
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read own org"
    ON public.organizations FOR SELECT
    USING (
        id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can insert org"
    ON public.organizations FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update own org"
    ON public.organizations FOR UPDATE
    USING (
        id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Employee whitelist: only org admins can CRUD
ALTER TABLE public.employee_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read whitelist"
    ON public.employee_whitelist FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins insert whitelist"
    ON public.employee_whitelist FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins update whitelist"
    ON public.employee_whitelist FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins delete whitelist"
    ON public.employee_whitelist FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Profiles: allow users to read org members (needed for dropdowns)
CREATE POLICY "Org members can read org profiles"
    ON public.profiles FOR SELECT
    USING (
        -- Users can always read own profile
        id = auth.uid()
        OR
        -- Org members can read other members in same org
        (
            organization_id IS NOT NULL
            AND organization_id IN (
                SELECT organization_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- =====================================================
-- 7. ACTIVITY LOG — New action types for org events
-- (activity_log table already exists, just documenting
--  new action strings to use in frontend)
-- =====================================================
-- New actions: 'org_created', 'employees_imported',
--   'employee_role_changed', 'employee_deactivated'

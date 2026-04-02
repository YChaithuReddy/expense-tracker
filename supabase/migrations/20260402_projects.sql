-- =====================================================
-- PHASE 2: PROJECT DATABASE WITH CODES
-- Replaces free-text vendor with structured projects
-- Run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    project_code TEXT NOT NULL,                     -- e.g., 'PRJ-2024-001'
    project_name TEXT NOT NULL,
    client_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    budget NUMERIC(12,2),
    description TEXT,
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, project_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON public.projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_org_code ON public.projects(organization_id, project_code);
CREATE INDEX IF NOT EXISTS idx_projects_org_name ON public.projects(organization_id, project_name);

-- Auto-update timestamp
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. AUTO-GENERATE PROJECT CODE FUNCTION
-- Format: PRJ-YYYY-NNN (e.g., PRJ-2026-001)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_project_code(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
    yr TEXT;
    seq INTEGER;
BEGIN
    yr := to_char(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO seq
    FROM public.projects
    WHERE organization_id = p_org_id
      AND project_code LIKE 'PRJ-' || yr || '-%';
    RETURN 'PRJ-' || yr || '-' || LPAD(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. ALTER EXPENSES — Add project_id FK
-- Keeps vendor column for backward compat + personal mode
-- =====================================================
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_project ON public.expenses(project_id);

-- =====================================================
-- 4. ALTER ADVANCES — Add project_id and organization_id
-- =====================================================
ALTER TABLE public.advances ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.advances ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_advances_project ON public.advances(project_id);
CREATE INDEX IF NOT EXISTS idx_advances_org ON public.advances(organization_id);

-- =====================================================
-- 5. ROW LEVEL SECURITY FOR PROJECTS
-- =====================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- All org members can view active projects
CREATE POLICY "Org members view projects"
    ON public.projects FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Admin, Manager, Accountant can create projects
CREATE POLICY "Privileged roles create projects"
    ON public.projects FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager', 'accountant')
        )
    );

-- Admin, Manager, Accountant can update projects
CREATE POLICY "Privileged roles update projects"
    ON public.projects FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager', 'accountant')
        )
    );

-- Only admin can delete projects
CREATE POLICY "Admins delete projects"
    ON public.projects FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

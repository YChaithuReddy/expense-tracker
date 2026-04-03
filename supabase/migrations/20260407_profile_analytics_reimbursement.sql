-- =====================================================
-- PROFILE + ANALYTICS + REIMBURSEMENT TRACKING
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Reimbursement tracking on vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'upi', 'cheque'));
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Profile: allow users to update their own name
-- (Already possible via existing RLS UPDATE policy on profiles)

-- 3. Analytics helper: spend by department
CREATE OR REPLACE FUNCTION public.get_org_spend_by_department(p_org_id UUID, p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(r))
        FROM (
            SELECT p.department, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
            FROM public.expenses e
            JOIN public.profiles p ON e.user_id = p.id
            WHERE p.organization_id = p_org_id
              AND (p_start IS NULL OR e.date >= p_start)
              AND (p_end IS NULL OR e.date <= p_end)
            GROUP BY p.department
            ORDER BY total DESC
        ) r
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Analytics helper: spend by project
CREATE OR REPLACE FUNCTION public.get_org_spend_by_project(p_org_id UUID, p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(r))
        FROM (
            SELECT pr.project_code, pr.project_name, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
            FROM public.expenses e
            JOIN public.projects pr ON e.project_id = pr.id
            WHERE pr.organization_id = p_org_id
              AND (p_start IS NULL OR e.date >= p_start)
              AND (p_end IS NULL OR e.date <= p_end)
            GROUP BY pr.project_code, pr.project_name
            ORDER BY total DESC
        ) r
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Analytics helper: spend by employee
CREATE OR REPLACE FUNCTION public.get_org_spend_by_employee(p_org_id UUID, p_start DATE DEFAULT NULL, p_end DATE DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(r))
        FROM (
            SELECT p.name, p.employee_id, p.department, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
            FROM public.expenses e
            JOIN public.profiles p ON e.user_id = p.id
            WHERE p.organization_id = p_org_id
              AND (p_start IS NULL OR e.date >= p_start)
              AND (p_end IS NULL OR e.date <= p_end)
            GROUP BY p.name, p.employee_id, p.department
            ORDER BY total DESC
        ) r
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Analytics helper: monthly spend trend
CREATE OR REPLACE FUNCTION public.get_org_monthly_trend(p_org_id UUID, p_months INT DEFAULT 12)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(r))
        FROM (
            SELECT to_char(e.date, 'YYYY-MM') as month, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
            FROM public.expenses e
            JOIN public.profiles p ON e.user_id = p.id
            WHERE p.organization_id = p_org_id
              AND e.date >= (CURRENT_DATE - (p_months || ' months')::interval)
            GROUP BY to_char(e.date, 'YYYY-MM')
            ORDER BY month ASC
        ) r
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

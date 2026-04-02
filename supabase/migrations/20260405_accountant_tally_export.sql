-- =====================================================
-- ACCOUNTANT DASHBOARD + TALLY EXPORT
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Add export tracking to vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS tally_exported BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_tally_exported
    ON public.vouchers(organization_id, tally_exported, status);

-- 2. Tally ledger mapping table
CREATE TABLE IF NOT EXISTS public.tally_ledger_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    expense_category TEXT NOT NULL,
    expense_subcategory TEXT,
    tally_ledger_name TEXT NOT NULL,
    tally_cost_center TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, expense_category, COALESCE(expense_subcategory, ''))
);

CREATE TRIGGER update_tally_mappings_updated_at
    BEFORE UPDATE ON public.tally_ledger_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS
ALTER TABLE public.tally_ledger_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read ledger mappings"
    ON public.tally_ledger_mappings FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Accountant admin manage ledger mappings"
    ON public.tally_ledger_mappings FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles
        WHERE id = auth.uid() AND role IN ('accountant', 'admin')
    ));

-- 4. Seed default Indian accounting ledger mappings
-- (Will run for all existing organizations)
INSERT INTO public.tally_ledger_mappings (organization_id, expense_category, tally_ledger_name)
SELECT o.id, cat.name, cat.ledger
FROM public.organizations o
CROSS JOIN (VALUES
    ('Transportation', 'Travelling Expenses'),
    ('Accommodation', 'Travelling Expenses'),
    ('Meals', 'Staff Welfare Expenses'),
    ('Fuel', 'Fuel & Oil Expenses'),
    ('Miscellaneous', 'Miscellaneous Expenses')
) AS cat(name, ledger)
ON CONFLICT DO NOTHING;

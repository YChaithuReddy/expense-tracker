-- =====================================================
-- PHASE 3: VOUCHER & APPROVAL WORKFLOW
-- Multi-level approval: Employee → Manager → Accountant
-- Run in Supabase SQL Editor (after Phase 1 & 2)
-- =====================================================

-- =====================================================
-- 1. VOUCHERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    voucher_number TEXT NOT NULL,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    accountant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    advance_id UUID REFERENCES public.advances(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft',
        'pending_manager',
        'manager_approved',
        'pending_accountant',
        'approved',
        'rejected',
        'reimbursed'
    )),
    total_amount NUMERIC(12,2) DEFAULT 0,
    expense_count INTEGER DEFAULT 0,
    purpose TEXT,
    notes TEXT,
    rejection_reason TEXT,
    rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    manager_action_at TIMESTAMPTZ,
    accountant_action_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, voucher_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vouchers_org_status ON public.vouchers(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_submitter ON public.vouchers(submitted_by, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_manager ON public.vouchers(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_accountant ON public.vouchers(accountant_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_advance ON public.vouchers(advance_id);

CREATE TRIGGER update_vouchers_updated_at
    BEFORE UPDATE ON public.vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. VOUCHER_EXPENSES JUNCTION TABLE
-- Links expenses to a voucher
-- =====================================================
CREATE TABLE IF NOT EXISTS public.voucher_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE NOT NULL,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(voucher_id, expense_id)
);

CREATE INDEX IF NOT EXISTS idx_ve_voucher ON public.voucher_expenses(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ve_expense ON public.voucher_expenses(expense_id);

-- =====================================================
-- 3. VOUCHER_HISTORY — Audit trail
-- Every status change is recorded
-- =====================================================
CREATE TABLE IF NOT EXISTS public.voucher_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'created', 'submitted', 'manager_approved', 'manager_rejected',
        'accountant_approved', 'accountant_rejected', 'resubmitted', 'reimbursed'
    )),
    acted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    comments TEXT,
    previous_status TEXT,
    new_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vh_voucher ON public.voucher_history(voucher_id, created_at);

-- =====================================================
-- 4. ALTER EXPENSES — Add voucher tracking
-- =====================================================
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS voucher_status TEXT;

DO $$ BEGIN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_voucher_status_check
        CHECK (voucher_status IS NULL OR voucher_status IN ('in_voucher', 'submitted', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 5. AUTO-GENERATE VOUCHER NUMBER
-- Format: VCH-YYYY-NNN (e.g., VCH-2026-001)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_voucher_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
    yr TEXT;
    seq INTEGER;
BEGIN
    yr := to_char(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO seq
    FROM public.vouchers
    WHERE organization_id = p_org_id
      AND voucher_number LIKE 'VCH-' || yr || '-%';
    RETURN 'VCH-' || yr || '-' || LPAD(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ROW LEVEL SECURITY — Enforces approval chain
-- =====================================================
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_history ENABLE ROW LEVEL SECURITY;

-- VOUCHERS: Read access
CREATE POLICY "Submitters view own vouchers"
    ON public.vouchers FOR SELECT
    USING (submitted_by = auth.uid());

CREATE POLICY "Managers view assigned vouchers"
    ON public.vouchers FOR SELECT
    USING (manager_id = auth.uid());

CREATE POLICY "Accountants view assigned vouchers"
    ON public.vouchers FOR SELECT
    USING (accountant_id = auth.uid());

CREATE POLICY "Admins view all org vouchers"
    ON public.vouchers FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- VOUCHERS: Create (employees submit their own)
CREATE POLICY "Users create own vouchers"
    ON public.vouchers FOR INSERT
    WITH CHECK (submitted_by = auth.uid());

-- VOUCHERS: Update — role-based status transitions
CREATE POLICY "Submitters update draft or rejected vouchers"
    ON public.vouchers FOR UPDATE
    USING (submitted_by = auth.uid() AND status IN ('draft', 'rejected'));

CREATE POLICY "Managers approve or reject pending vouchers"
    ON public.vouchers FOR UPDATE
    USING (manager_id = auth.uid() AND status = 'pending_manager');

CREATE POLICY "Accountants approve or reject manager-approved vouchers"
    ON public.vouchers FOR UPDATE
    USING (accountant_id = auth.uid() AND status IN ('manager_approved', 'pending_accountant'));

-- VOUCHER_EXPENSES: Read/Write by involved parties
CREATE POLICY "Involved parties view voucher expenses"
    ON public.voucher_expenses FOR SELECT
    USING (
        voucher_id IN (
            SELECT id FROM public.vouchers
            WHERE submitted_by = auth.uid()
               OR manager_id = auth.uid()
               OR accountant_id = auth.uid()
               OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

CREATE POLICY "Submitters add expenses to vouchers"
    ON public.voucher_expenses FOR INSERT
    WITH CHECK (
        voucher_id IN (SELECT id FROM public.vouchers WHERE submitted_by = auth.uid())
    );

-- VOUCHER_HISTORY: Read by involved parties, insert by actors
CREATE POLICY "Involved parties view history"
    ON public.voucher_history FOR SELECT
    USING (
        voucher_id IN (
            SELECT id FROM public.vouchers
            WHERE submitted_by = auth.uid()
               OR manager_id = auth.uid()
               OR accountant_id = auth.uid()
               OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

CREATE POLICY "Actors insert history"
    ON public.voucher_history FOR INSERT
    WITH CHECK (acted_by = auth.uid());

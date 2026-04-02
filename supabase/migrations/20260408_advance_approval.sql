-- =====================================================
-- ADVANCE APPROVAL WORKFLOW
-- Employee → Manager → Accountant → Active
-- =====================================================

-- 1. Add approval columns to advances table
ALTER TABLE public.advances
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manager_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accountant_action_at TIMESTAMPTZ;

-- 2. Expand status to include approval states
-- Drop old constraint and add new one
ALTER TABLE public.advances DROP CONSTRAINT IF EXISTS advances_status_check;
ALTER TABLE public.advances ADD CONSTRAINT advances_status_check
    CHECK (status IN ('active', 'closed', 'pending_manager', 'pending_accountant', 'rejected'));

-- 3. Indexes for approval queries
CREATE INDEX IF NOT EXISTS idx_advances_manager ON public.advances(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_advances_accountant ON public.advances(accountant_id, status);

-- 4. Advance history table (audit trail)
CREATE TABLE IF NOT EXISTS public.advance_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    advance_id UUID REFERENCES public.advances(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('submitted', 'manager_approved', 'manager_rejected', 'accountant_approved', 'accountant_rejected', 'resubmitted', 'closed')),
    acted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    comments TEXT,
    previous_status TEXT,
    new_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adv_history_advance ON public.advance_history(advance_id);

-- 5. RLS on advance_history
ALTER TABLE public.advance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View advance history"
    ON public.advance_history FOR SELECT
    USING (
        advance_id IN (
            SELECT id FROM public.advances
            WHERE user_id = auth.uid()
               OR manager_id = auth.uid()
               OR accountant_id = auth.uid()
               OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

CREATE POLICY "Insert advance history"
    ON public.advance_history FOR INSERT
    WITH CHECK (acted_by = auth.uid());

-- 6. RLS updates on advances for manager/accountant access
CREATE POLICY "Managers view assigned advances"
    ON public.advances FOR SELECT
    USING (manager_id = auth.uid());

CREATE POLICY "Accountants view assigned advances"
    ON public.advances FOR SELECT
    USING (accountant_id = auth.uid());

CREATE POLICY "Managers approve/reject advances"
    ON public.advances FOR UPDATE
    USING (manager_id = auth.uid() AND status = 'pending_manager');

CREATE POLICY "Accountants approve/reject advances"
    ON public.advances FOR UPDATE
    USING (accountant_id = auth.uid() AND status = 'pending_accountant');

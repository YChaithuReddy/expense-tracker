-- Add expense_ids array to vouchers for reliable expense retrieval
-- This is a fallback in case voucher_expenses junction table has RLS issues
ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS expense_ids UUID[] DEFAULT '{}';

-- Allow involved parties to read expense_ids
COMMENT ON COLUMN public.vouchers.expense_ids IS 'Direct array of expense IDs linked to this voucher (fallback for junction table)';

-- Add advance notification types to the CHECK constraint
-- This allows advance_submitted, advance_approved, advance_rejected, advance_resubmitted
-- to be stored in the notifications.type column

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'voucher_submitted', 'voucher_approved', 'voucher_rejected',
        'voucher_reimbursed', 'voucher_resubmitted',
        'advance_submitted', 'advance_approved', 'advance_rejected', 'advance_resubmitted',
        'expense_added',
        'employee_joined', 'project_created', 'system'
    ));

-- =====================================================
-- PHASE 4: NOTIFICATIONS
-- In-app + email notification system
-- Run in Supabase SQL Editor (after Phase 1, 2, 3)
-- =====================================================

-- =====================================================
-- 1. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'voucher_submitted', 'voucher_approved', 'voucher_rejected',
        'voucher_reimbursed', 'voucher_resubmitted',
        'employee_joined', 'project_created', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT,
    reference_type TEXT,                 -- 'voucher', 'project', 'expense'
    reference_id UUID,                   -- FK to the referenced entity
    is_read BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Allow authenticated users to insert notifications (for client-side creation)
CREATE POLICY "Authenticated users create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. AUTO-NOTIFY ON VOUCHER STATUS CHANGE
-- Trigger fires AFTER UPDATE on vouchers and creates
-- the right notification for the right person
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_voucher_status_change()
RETURNS TRIGGER AS $$
DECLARE
    submitter_name TEXT;
    manager_name TEXT;
    accountant_name TEXT;
    notify_user_id UUID;
    notify_title TEXT;
    notify_message TEXT;
    notify_type TEXT;
BEGIN
    -- Skip if status didn't change
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;

    -- Look up names
    SELECT name INTO submitter_name FROM public.profiles WHERE id = NEW.submitted_by;
    SELECT name INTO manager_name FROM public.profiles WHERE id = NEW.manager_id;
    SELECT name INTO accountant_name FROM public.profiles WHERE id = NEW.accountant_id;

    -- Determine notification based on new status
    CASE NEW.status
        WHEN 'pending_manager' THEN
            notify_user_id := NEW.manager_id;
            notify_type := 'voucher_submitted';
            notify_title := 'New voucher for approval';
            notify_message := COALESCE(submitter_name, 'An employee') || ' submitted voucher ' || NEW.voucher_number || ' (Rs.' || COALESCE(NEW.total_amount::TEXT, '0') || ') for your approval.';
        WHEN 'pending_accountant' THEN
            notify_user_id := NEW.accountant_id;
            notify_type := 'voucher_approved';
            notify_title := 'Voucher ready for verification';
            notify_message := 'Voucher ' || NEW.voucher_number || ' was approved by ' || COALESCE(manager_name, 'Manager') || '. Please review and verify.';
        WHEN 'approved' THEN
            notify_user_id := NEW.submitted_by;
            notify_type := 'voucher_approved';
            notify_title := 'Voucher approved!';
            notify_message := 'Your voucher ' || NEW.voucher_number || ' (Rs.' || COALESCE(NEW.total_amount::TEXT, '0') || ') has been approved by ' || COALESCE(accountant_name, 'Accountant') || '.';
        WHEN 'rejected' THEN
            notify_user_id := NEW.submitted_by;
            notify_type := 'voucher_rejected';
            notify_title := 'Voucher rejected';
            notify_message := 'Your voucher ' || NEW.voucher_number || ' was rejected. Reason: ' || COALESCE(NEW.rejection_reason, 'No reason provided') || '. Please review and resubmit.';
        WHEN 'reimbursed' THEN
            notify_user_id := NEW.submitted_by;
            notify_type := 'voucher_reimbursed';
            notify_title := 'Reimbursement processed!';
            notify_message := 'Voucher ' || NEW.voucher_number || ' (Rs.' || COALESCE(NEW.total_amount::TEXT, '0') || ') has been reimbursed.';
        ELSE
            RETURN NEW;
    END CASE;

    -- Insert notification
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, reference_type, reference_id)
    VALUES (notify_user_id, NEW.organization_id, notify_type, notify_title, notify_message, 'voucher', NEW.id);

    -- Also notify submitter when manager approves (intermediate step)
    IF NEW.status = 'pending_accountant' THEN
        INSERT INTO public.notifications (user_id, organization_id, type, title, message, reference_type, reference_id)
        VALUES (
            NEW.submitted_by, NEW.organization_id, 'voucher_approved',
            'Manager approved your voucher',
            'Voucher ' || NEW.voucher_number || ' was approved by ' || COALESCE(manager_name, 'Manager') || '. Now pending accountant verification.',
            'voucher', NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_voucher_status_change ON public.vouchers;
CREATE TRIGGER on_voucher_status_change
    AFTER UPDATE ON public.vouchers
    FOR EACH ROW EXECUTE FUNCTION public.notify_voucher_status_change();

-- Also notify on new voucher creation (INSERT)
CREATE OR REPLACE FUNCTION public.notify_voucher_created()
RETURNS TRIGGER AS $$
DECLARE
    submitter_name TEXT;
BEGIN
    IF NEW.status = 'pending_manager' THEN
        SELECT name INTO submitter_name FROM public.profiles WHERE id = NEW.submitted_by;

        INSERT INTO public.notifications (user_id, organization_id, type, title, message, reference_type, reference_id)
        VALUES (
            NEW.manager_id, NEW.organization_id, 'voucher_submitted',
            'New voucher for approval',
            COALESCE(submitter_name, 'An employee') || ' submitted voucher ' || NEW.voucher_number || ' (Rs.' || COALESCE(NEW.total_amount::TEXT, '0') || ') for your approval.',
            'voucher', NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_voucher_created ON public.vouchers;
CREATE TRIGGER on_voucher_created
    AFTER INSERT ON public.vouchers
    FOR EACH ROW EXECUTE FUNCTION public.notify_voucher_created();

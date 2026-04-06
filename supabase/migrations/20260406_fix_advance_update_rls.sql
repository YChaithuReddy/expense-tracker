-- Fix: RLS UPDATE policies need WITH CHECK (true) to allow status changes
-- Without it, changing status from pending_manager → pending_accountant fails
-- because the USING clause checks BOTH old and new row values

DROP POLICY IF EXISTS "Managers approve/reject advances" ON public.advances;
CREATE POLICY "Managers approve/reject advances"
    ON public.advances FOR UPDATE
    USING (manager_id = auth.uid() AND status = 'pending_manager')
    WITH CHECK (true);

DROP POLICY IF EXISTS "Accountants approve/reject advances" ON public.advances;
CREATE POLICY "Accountants approve/reject advances"
    ON public.advances FOR UPDATE
    USING (accountant_id = auth.uid() AND status = 'pending_accountant')
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage org advances" ON public.advances;
CREATE POLICY "Admins manage org advances"
    ON public.advances FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (true);

-- Also ensure employees can update their own advances (edit, close, reopen)
DROP POLICY IF EXISTS "Users update own advances" ON public.advances;
CREATE POLICY "Users update own advances"
    ON public.advances FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (true);

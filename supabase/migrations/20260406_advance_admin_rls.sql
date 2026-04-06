-- Allow admins to update any advance in their organization
CREATE POLICY "Admins manage org advances"
    ON public.advances FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admins to view all org advances
CREATE POLICY "Admins view org advances"
    ON public.advances FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

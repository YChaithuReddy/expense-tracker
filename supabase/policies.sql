-- =====================================================
-- EXPENSE TRACKER - ROW LEVEL SECURITY POLICIES
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orphaned_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_whatsapp_expenses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PROFILES POLICIES
-- =====================================================
-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- System can insert profiles (via trigger)
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- 3. EXPENSES POLICIES
-- =====================================================
-- Users can view their own expenses
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
CREATE POLICY "Users can view own expenses" ON public.expenses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own expenses
DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
CREATE POLICY "Users can create own expenses" ON public.expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own expenses
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses" ON public.expenses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own expenses
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can delete own expenses" ON public.expenses
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 4. EXPENSE IMAGES POLICIES
-- =====================================================
-- Users can view their own expense images
DROP POLICY IF EXISTS "Users can view own expense images" ON public.expense_images;
CREATE POLICY "Users can view own expense images" ON public.expense_images
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create expense images for their expenses
DROP POLICY IF EXISTS "Users can create expense images" ON public.expense_images;
CREATE POLICY "Users can create expense images" ON public.expense_images
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own expense images
DROP POLICY IF EXISTS "Users can delete own expense images" ON public.expense_images;
CREATE POLICY "Users can delete own expense images" ON public.expense_images
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 5. ORPHANED IMAGES POLICIES
-- =====================================================
-- Users can view their own orphaned images
DROP POLICY IF EXISTS "Users can view own orphaned images" ON public.orphaned_images;
CREATE POLICY "Users can view own orphaned images" ON public.orphaned_images
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create orphaned images
DROP POLICY IF EXISTS "Users can create orphaned images" ON public.orphaned_images;
CREATE POLICY "Users can create orphaned images" ON public.orphaned_images
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own orphaned images
DROP POLICY IF EXISTS "Users can update own orphaned images" ON public.orphaned_images;
CREATE POLICY "Users can update own orphaned images" ON public.orphaned_images
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own orphaned images
DROP POLICY IF EXISTS "Users can delete own orphaned images" ON public.orphaned_images;
CREATE POLICY "Users can delete own orphaned images" ON public.orphaned_images
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 6. PENDING WHATSAPP EXPENSES POLICIES
-- =====================================================
-- Users can view their own pending expenses
DROP POLICY IF EXISTS "Users can view own pending whatsapp" ON public.pending_whatsapp_expenses;
CREATE POLICY "Users can view own pending whatsapp" ON public.pending_whatsapp_expenses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create pending expenses
DROP POLICY IF EXISTS "Users can create pending whatsapp" ON public.pending_whatsapp_expenses;
CREATE POLICY "Users can create pending whatsapp" ON public.pending_whatsapp_expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their pending expenses
DROP POLICY IF EXISTS "Users can update pending whatsapp" ON public.pending_whatsapp_expenses;
CREATE POLICY "Users can update pending whatsapp" ON public.pending_whatsapp_expenses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their pending expenses
DROP POLICY IF EXISTS "Users can delete pending whatsapp" ON public.pending_whatsapp_expenses;
CREATE POLICY "Users can delete pending whatsapp" ON public.pending_whatsapp_expenses
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 7. SERVICE ROLE POLICIES (for Edge Functions)
-- These allow the service role to bypass RLS for webhooks
-- =====================================================

-- Allow service role to query by whatsapp number (for webhook)
DROP POLICY IF EXISTS "Service can query by whatsapp" ON public.pending_whatsapp_expenses;
CREATE POLICY "Service can query by whatsapp" ON public.pending_whatsapp_expenses
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Allow service role to manage profiles (for webhook user lookup)
DROP POLICY IF EXISTS "Service can manage profiles" ON public.profiles;
CREATE POLICY "Service can manage profiles" ON public.profiles
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Allow service role to manage expenses (for webhook)
DROP POLICY IF EXISTS "Service can manage expenses" ON public.expenses;
CREATE POLICY "Service can manage expenses" ON public.expenses
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'RLS policies created successfully!';
END $$;

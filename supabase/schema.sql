-- =====================================================
-- EXPENSE TRACKER - SUPABASE DATABASE SCHEMA
-- Run this in the Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    profile_picture TEXT,
    google_sheet_id TEXT DEFAULT '',
    google_sheet_url TEXT DEFAULT '',
    google_sheet_created_at TIMESTAMPTZ,
    whatsapp_number TEXT DEFAULT '',
    whatsapp_notifications BOOLEAN DEFAULT FALSE,
    monthly_budget DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    time TIME,
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    vendor TEXT DEFAULT 'N/A',
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. EXPENSE IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expense_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    filename TEXT,
    size_bytes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. ORPHANED IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.orphaned_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_expense_date DATE,
    original_vendor TEXT,
    original_amount DECIMAL(10,2),
    original_category TEXT,
    original_expense_id UUID,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    was_exported BOOLEAN DEFAULT FALSE,
    last_exported_at TIMESTAMPTZ,
    size_bytes INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    retention_days INTEGER DEFAULT 30,
    preserve_indefinitely BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. PENDING WHATSAPP EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pending_whatsapp_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    whatsapp_number TEXT NOT NULL,
    step TEXT DEFAULT 'amount' CHECK (step IN ('confirm_scan', 'amount', 'description', 'date', 'confirm')),
    amount DECIMAL(10,2),
    description TEXT,
    category TEXT,
    vendor TEXT,
    expense_date DATE,
    bill_image_path TEXT,
    bill_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_created ON public.expenses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_expense_images_expense ON public.expense_images(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_images_user ON public.expense_images(user_id);
CREATE INDEX IF NOT EXISTS idx_orphaned_user_upload ON public.orphaned_images(user_id, upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_orphaned_expiry ON public.orphaned_images(expiry_date) WHERE NOT preserve_indefinitely;
CREATE INDEX IF NOT EXISTS idx_orphaned_exported ON public.orphaned_images(user_id, was_exported);
CREATE INDEX IF NOT EXISTS idx_pending_whatsapp ON public.pending_whatsapp_expenses(whatsapp_number);

-- =====================================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orphaned_images_updated_at ON public.orphaned_images;
CREATE TRIGGER update_orphaned_images_updated_at
    BEFORE UPDATE ON public.orphaned_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_whatsapp_updated_at ON public.pending_whatsapp_expenses;
CREATE TRIGGER update_pending_whatsapp_updated_at
    BEFORE UPDATE ON public.pending_whatsapp_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. AUTO-CREATE PROFILE ON USER SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, profile_picture)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 9. EXPENSE STATISTICS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_expense_stats(p_user_id UUID, p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', COALESCE(SUM(amount), 0),
        'count', COUNT(*),
        'average', COALESCE(AVG(amount), 0),
        'min', COALESCE(MIN(amount), 0),
        'max', COALESCE(MAX(amount), 0),
        'by_category', (
            SELECT json_object_agg(category, cat_total)
            FROM (
                SELECT category, SUM(amount) as cat_total
                FROM public.expenses
                WHERE user_id = p_user_id
                AND (p_start_date IS NULL OR date >= p_start_date)
                AND (p_end_date IS NULL OR date <= p_end_date)
                GROUP BY category
            ) cat_totals
        )
    ) INTO result
    FROM public.expenses
    WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date);

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. CLEANUP EXPIRED ORPHANED IMAGES FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_orphaned_images()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM public.orphaned_images
        WHERE expiry_date < NOW()
        AND preserve_indefinitely = FALSE
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. USER STORAGE STATS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_storage_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_images', COUNT(*),
        'total_size_bytes', COALESCE(SUM(size_bytes), 0),
        'total_size_mb', ROUND(COALESCE(SUM(size_bytes), 0) / 1048576.0, 2),
        'exported_count', COUNT(*) FILTER (WHERE was_exported = TRUE),
        'unexported_count', COUNT(*) FILTER (WHERE was_exported = FALSE),
        'expiring_within_7_days', COUNT(*) FILTER (
            WHERE expiry_date > NOW()
            AND expiry_date <= NOW() + INTERVAL '7 days'
            AND preserve_indefinitely = FALSE
        ),
        'preserved_count', COUNT(*) FILTER (WHERE preserve_indefinitely = TRUE)
    ) INTO result
    FROM public.orphaned_images
    WHERE user_id = p_user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. EXTEND ORPHANED IMAGE EXPIRY FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION extend_orphaned_image_expiry(p_image_id UUID, p_days INTEGER)
RETURNS public.orphaned_images AS $$
DECLARE
    updated_image public.orphaned_images;
BEGIN
    UPDATE public.orphaned_images
    SET expiry_date = expiry_date + (p_days || ' days')::INTERVAL,
        retention_days = retention_days + p_days
    WHERE id = p_image_id
    RETURNING * INTO updated_image;

    RETURN updated_image;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Schema created successfully!';
END $$;

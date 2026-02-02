-- =====================================================
-- EXPENSE TRACKER - STORAGE BUCKET CONFIGURATION
-- Run this AFTER policies.sql in the Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE STORAGE BUCKET FOR EXPENSE BILLS
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'expense-bills',
    'expense-bills',
    TRUE,  -- Public bucket for easy image access
    5242880,  -- 5MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- 2. STORAGE POLICIES FOR expense-bills BUCKET
-- =====================================================

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'expense-bills'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to view their own images
DROP POLICY IF EXISTS "Users can view own images" ON storage.objects;
CREATE POLICY "Users can view own images" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'expense-bills'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own images
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'expense-bills'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow public read access (since bucket is public)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'expense-bills');

-- Allow service role full access (for Edge Functions)
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
CREATE POLICY "Service role full access" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'expense-bills'
        AND auth.jwt()->>'role' = 'service_role'
    );

-- =====================================================
-- 3. HELPER FUNCTION TO GET PUBLIC URL
-- =====================================================
CREATE OR REPLACE FUNCTION get_storage_public_url(p_path TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Returns the public URL for a storage path
    -- Replace YOUR_PROJECT_REF with your actual project reference
    RETURN 'https://' || current_setting('app.settings.supabase_url', true) || '/storage/v1/object/public/expense-bills/' || p_path;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Storage bucket and policies created successfully!';
    RAISE NOTICE 'Bucket: expense-bills (public, 5MB limit, images only)';
END $$;

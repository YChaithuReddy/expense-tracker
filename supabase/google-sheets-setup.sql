-- =====================================================
-- GOOGLE SHEETS INTEGRATION - Additional columns
-- Run this in the Supabase SQL Editor
-- =====================================================

-- Add Google Sheets columns to profiles (if not exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_sheet_id TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS google_sheet_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS google_sheet_created_at TIMESTAMPTZ;

-- Add export tracking columns to expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS exported_to_sheets BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

-- Create index for faster export queries
CREATE INDEX IF NOT EXISTS idx_expenses_exported ON public.expenses(user_id, exported_to_sheets);

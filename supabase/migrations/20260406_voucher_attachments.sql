-- =====================================================
-- VOUCHER ATTACHMENTS — Google Sheet URL + PDF URL
-- Run in Supabase SQL Editor
-- =====================================================

ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS pdf_filename TEXT;

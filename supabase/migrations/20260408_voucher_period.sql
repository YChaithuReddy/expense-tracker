-- Add expense period dates to vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS period_to DATE;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS declaration_accepted BOOLEAN DEFAULT FALSE;

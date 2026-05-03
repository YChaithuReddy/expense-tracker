-- Add travel/transport fields to expenses table.
-- These columns were referenced in frontend code from Apr 15, 2026 but the
-- migration was never committed, so they may be missing on hosted instances.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS mode_of_expense TEXT,
  ADD COLUMN IF NOT EXISTS from_location    TEXT,
  ADD COLUMN IF NOT EXISTS to_location      TEXT,
  ADD COLUMN IF NOT EXISTS kilometers       NUMERIC;

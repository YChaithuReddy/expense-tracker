-- =============================================
-- ADVANCES TABLE - Run this in Supabase SQL Editor
-- =============================================

-- 1. Create advances table
CREATE TABLE IF NOT EXISTS advances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_name TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add advance_id to expenses table (nullable for backward compatibility)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS advance_id UUID REFERENCES advances(id) ON DELETE SET NULL;

-- 3. Enable RLS on advances
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - users can only see/modify their own advances
CREATE POLICY "Users can view own advances"
    ON advances FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own advances"
    ON advances FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advances"
    ON advances FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own advances"
    ON advances FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_advances_user_id ON advances(user_id);
CREATE INDEX IF NOT EXISTS idx_advances_project_name ON advances(user_id, project_name);
CREATE INDEX IF NOT EXISTS idx_expenses_advance_id ON expenses(advance_id);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION update_advances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advances_updated_at
    BEFORE UPDATE ON advances
    FOR EACH ROW
    EXECUTE FUNCTION update_advances_updated_at();

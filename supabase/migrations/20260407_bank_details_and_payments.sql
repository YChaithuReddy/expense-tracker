-- ============================================================
-- Banking Integration: Employee Bank Details + Payment Tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Employee Bank Details table
CREATE TABLE IF NOT EXISTS employee_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    account_holder_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    bank_name TEXT,
    upi_id TEXT,
    preferred_method TEXT NOT NULL DEFAULT 'neft' CHECK (preferred_method IN ('neft', 'imps', 'upi')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Payment Transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_id UUID NOT NULL REFERENCES advances(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    organization_id UUID,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_method TEXT CHECK (payment_method IN ('neft', 'imps', 'upi', 'bank_transfer', 'manual')),
    payment_reference TEXT,
    initiated_by UUID REFERENCES profiles(id),
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_txn_advance ON payment_transactions(advance_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_org_status ON payment_transactions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_txn_pending ON payment_transactions(status) WHERE status = 'pending';

-- 3. Add payment_status to advances table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'advances' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE advances ADD COLUMN payment_status TEXT DEFAULT 'not_initiated'
            CHECK (payment_status IN ('not_initiated', 'pending', 'processing', 'completed', 'failed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'advances' AND column_name = 'payment_transaction_id'
    ) THEN
        ALTER TABLE advances ADD COLUMN payment_transaction_id UUID;
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE employee_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for employee_bank_details

-- Users can see and manage their own bank details
CREATE POLICY "Users can view own bank details"
    ON employee_bank_details FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bank details"
    ON employee_bank_details FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bank details"
    ON employee_bank_details FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Accountants and admins can view bank details for their org members (for payment processing)
CREATE POLICY "Org admins can view member bank details"
    ON employee_bank_details FOR SELECT
    USING (
        user_id IN (
            SELECT p.id FROM profiles p
            WHERE p.organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
        AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant')
        )
    );

-- 6. RLS Policies for payment_transactions

-- Users can view their own payment transactions
CREATE POLICY "Users can view own payments"
    ON payment_transactions FOR SELECT
    USING (user_id = auth.uid());

-- Accountants/admins can view and manage payments for their org
CREATE POLICY "Org admins can view org payments"
    ON payment_transactions FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Org admins can create payments"
    ON payment_transactions FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Org admins can update payments"
    ON payment_transactions FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (true);

-- 7. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_bank_details_updated_at
    BEFORE UPDATE ON employee_bank_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_payment_txn_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

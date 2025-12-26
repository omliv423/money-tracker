-- Add settled_amount column for partial settlement support
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settled_amount INTEGER DEFAULT 0;

-- Update existing settled transactions to have settled_amount = total_amount
UPDATE transactions SET settled_amount = total_amount WHERE is_cash_settled = true AND settled_amount = 0;

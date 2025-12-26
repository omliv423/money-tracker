-- Add settled_amount column to transaction_lines for partial settlement support
ALTER TABLE transaction_lines ADD COLUMN IF NOT EXISTS settled_amount INTEGER DEFAULT 0;

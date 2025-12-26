-- Add settled_amount column for partial settlement support
ALTER TABLE transaction_lines
ADD COLUMN IF NOT EXISTS settled_amount integer DEFAULT 0;

-- Migrate existing data: set settled_amount = amount for settled lines
UPDATE transaction_lines
SET settled_amount = amount
WHERE is_settled = true AND (settled_amount IS NULL OR settled_amount = 0);

-- Comment: settled_amount represents how much of the line has been settled
-- A line is fully settled when settled_amount >= amount
-- Unsettled remainder = amount - settled_amount

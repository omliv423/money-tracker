-- Add paid_by_other flag to transactions table
-- This flag indicates that the transaction was paid by someone else (立替えてもらった)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_by_other BOOLEAN DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_transactions_paid_by_other ON transactions(paid_by_other) WHERE paid_by_other = TRUE;

-- Update existing transactions that have liability lines with counterparty
-- These are likely "立替えてもらった" transactions
UPDATE transactions t
SET paid_by_other = TRUE
WHERE EXISTS (
  SELECT 1 FROM transaction_lines tl
  WHERE tl.transaction_id = t.id
  AND tl.line_type = 'liability'
  AND tl.counterparty IS NOT NULL
);

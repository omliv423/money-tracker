-- Add account_id to settlements table to track which account received/paid the settlement
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'receive';

-- Add opening_date column to accounts table
-- This represents the date from which transactions should be counted
-- Transactions before this date are considered already reflected in opening_balance

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_date DATE;

-- Set default opening_date to a very old date for existing accounts (so all transactions are counted)
-- Users can update this to exclude historical transactions from balance calculation
UPDATE accounts SET opening_date = '1900-01-01' WHERE opening_date IS NULL;

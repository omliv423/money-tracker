-- Add current_balance column for tracking actual balance
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance INTEGER DEFAULT 0;

-- Update balances for specific accounts
UPDATE accounts SET current_balance = 409056 WHERE name = '三井住友';
UPDATE accounts SET current_balance = 55331 WHERE name = '楽天銀行';
UPDATE accounts SET current_balance = 4391 WHERE name ILIKE '%paypay%';

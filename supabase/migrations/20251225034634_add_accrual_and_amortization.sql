-- Add payment_date to transactions (支払日)
-- date は発生日として使用
ALTER TABLE transactions ADD COLUMN payment_date DATE;

-- Add amortization columns to transaction_lines (償却期間)
ALTER TABLE transaction_lines ADD COLUMN amortization_months INTEGER DEFAULT 1;
ALTER TABLE transaction_lines ADD COLUMN amortization_start DATE;
ALTER TABLE transaction_lines ADD COLUMN amortization_end DATE;

-- Add 楽天カード to accounts
INSERT INTO accounts (name, type, owner) VALUES ('楽天カード', 'card', 'self');

-- Update existing transactions: set payment_date = date for existing records
UPDATE transactions SET payment_date = date WHERE payment_date IS NULL;

-- Add index for payment_date
CREATE INDEX idx_transactions_payment_date ON transactions(payment_date DESC);

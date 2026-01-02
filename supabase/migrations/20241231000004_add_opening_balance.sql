-- 口座に初期残高と残高基準日を追加
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance_date DATE;

-- 既存のcurrent_balanceをopening_balanceにコピー（current_balanceが存在する場合）
UPDATE accounts SET opening_balance = COALESCE(current_balance, 0) WHERE opening_balance IS NULL OR opening_balance = 0;

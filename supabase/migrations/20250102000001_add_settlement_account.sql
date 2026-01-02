-- 消し込み時に使用した現預金口座を記録するカラムを追加
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settlement_account_id UUID REFERENCES accounts(id);

-- 消し込み日も記録
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settlement_date DATE;

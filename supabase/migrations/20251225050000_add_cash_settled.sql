-- Add is_cash_settled flag to transactions
-- false = 未払い（カード未決済）, true = 決済済み（カードから引き落とし済み）
ALTER TABLE transactions ADD COLUMN is_cash_settled BOOLEAN DEFAULT false;

-- 過去の取引で支払日が今日以前のものは決済済みとする
UPDATE transactions
SET is_cash_settled = true
WHERE payment_date <= CURRENT_DATE;

-- 発生日＝支払日（現金払い等）の取引も決済済み
UPDATE transactions
SET is_cash_settled = true
WHERE date = payment_date;

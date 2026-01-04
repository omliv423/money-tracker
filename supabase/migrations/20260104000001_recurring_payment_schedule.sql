-- 定期取引の支払いスケジュールを月オフセット+日で指定できるように変更
-- payment_month_offset: -2(前々月), -1(前月), 0(同月), 1(翌月), 2(翌々月)
-- payment_day: 1-31 (nullの場合は発生日と同じ日)

ALTER TABLE recurring_transactions
ADD COLUMN IF NOT EXISTS payment_month_offset INTEGER DEFAULT 0;

ALTER TABLE recurring_transactions
ADD COLUMN IF NOT EXISTS payment_day INTEGER;

-- 既存データのマイグレーション: payment_delay_days から推定
-- 0 -> 同月同日
-- 27 -> 翌月27日
-- 30 -> 翌月末（30日として扱う）
-- 57 -> 翌々月27日
UPDATE recurring_transactions
SET payment_month_offset = 0, payment_day = NULL
WHERE payment_delay_days = 0;

UPDATE recurring_transactions
SET payment_month_offset = 1, payment_day = 27
WHERE payment_delay_days = 27;

UPDATE recurring_transactions
SET payment_month_offset = 1, payment_day = 30
WHERE payment_delay_days = 30;

UPDATE recurring_transactions
SET payment_month_offset = 2, payment_day = 27
WHERE payment_delay_days = 57;

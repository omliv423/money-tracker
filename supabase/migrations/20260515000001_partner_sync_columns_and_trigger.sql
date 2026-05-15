-- Partner sync: counterparty_user_id 列とトリガー
-- 目的: パートナー間 (同一世帯メンバー) で transaction_lines / settlements を紐づけ、
--       片方の精算操作が相手側の mirror line にも自動反映されるようにする

SET ROLE postgres;

-- ============================================================
-- Step 1: 列追加
-- ============================================================
ALTER TABLE public.transaction_lines
  ADD COLUMN IF NOT EXISTS counterparty_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS counterparty_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_lines_counterparty_user_id
  ON public.transaction_lines(counterparty_user_id)
  WHERE counterparty_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_counterparty_user_id
  ON public.settlements(counterparty_user_id)
  WHERE counterparty_user_id IS NOT NULL;

COMMENT ON COLUMN public.transaction_lines.counterparty_user_id IS 'パートナーのuser_id (mirror同期対象)。NULLなら世帯外取引で同期しない';
COMMENT ON COLUMN public.settlements.counterparty_user_id IS 'パートナーのuser_id (mirror同期対象)。NULLなら世帯外取引で同期しない';

-- ============================================================
-- Step 2: backfill - 既存データへ counterparty_user_id を埋める
-- masayuki42321@gmail.com (e58ec8a1-207d...) ↔ asami.19971007@gmail.com (41d13e60-...)
-- ============================================================

-- masayuki の transaction_lines で counterparty='あさみ' → asami
UPDATE public.transaction_lines tl
SET counterparty_user_id = '41d13e60-207d-4582-83f6-2756efb7f100'::uuid
FROM public.transactions t
WHERE tl.transaction_id = t.id
  AND t.user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'::uuid
  AND tl.counterparty = 'あさみ'
  AND tl.counterparty_user_id IS NULL;

-- asami の transaction_lines で counterparty='小笠原将之' → masayuki
UPDATE public.transaction_lines tl
SET counterparty_user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'::uuid
FROM public.transactions t
WHERE tl.transaction_id = t.id
  AND t.user_id = '41d13e60-207d-4582-83f6-2756efb7f100'::uuid
  AND tl.counterparty = '小笠原将之'
  AND tl.counterparty_user_id IS NULL;

-- masayuki の settlements で counterparty='あさみ' → asami
UPDATE public.settlements
SET counterparty_user_id = '41d13e60-207d-4582-83f6-2756efb7f100'::uuid
WHERE user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'::uuid
  AND counterparty = 'あさみ'
  AND counterparty_user_id IS NULL;

-- asami の settlements で counterparty='小笠原将之' → masayuki
UPDATE public.settlements
SET counterparty_user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'::uuid
WHERE user_id = '41d13e60-207d-4582-83f6-2756efb7f100'::uuid
  AND counterparty = '小笠原将之'
  AND counterparty_user_id IS NULL;

-- ============================================================
-- Step 3: トリガー関数
-- transaction_lines の settled_amount/is_settled が変わったら、
-- 同じ世帯の相手側 mirror line も同じ状態に同期する
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_transaction_line_settlement_to_mirror()
RETURNS TRIGGER AS $$
DECLARE
  v_my_user_id UUID;
  v_my_date DATE;
  v_mirror_line_type TEXT;
BEGIN
  -- counterparty_user_id が NULL なら sync 不要
  IF NEW.counterparty_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 精算状態が変わっていなければ何もしない (再帰防止にもなる)
  IF (NEW.is_settled IS NOT DISTINCT FROM OLD.is_settled) AND
     (COALESCE(NEW.settled_amount, 0) = COALESCE(OLD.settled_amount, 0)) THEN
    RETURN NEW;
  END IF;

  -- 自分の user_id と date を取得
  SELECT user_id, date INTO v_my_user_id, v_my_date
  FROM public.transactions WHERE id = NEW.transaction_id;

  IF v_my_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- asset <-> liability の対応関係
  v_mirror_line_type := CASE
    WHEN NEW.line_type = 'asset' THEN 'liability'
    WHEN NEW.line_type = 'liability' THEN 'asset'
    ELSE NULL
  END;

  IF v_mirror_line_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- mirror line を検索して同期
  -- 条件: 相手のuser_id / 相手から見たcounterparty_user_idが自分 / 対のline_type / 同amount / 同date
  -- 同じ条件のmirror lineが複数存在する場合は、precision のため line_id でtie-break
  UPDATE public.transaction_lines mirror
  SET settled_amount = NEW.settled_amount,
      is_settled = NEW.is_settled
  FROM public.transactions mirror_t
  WHERE mirror.transaction_id = mirror_t.id
    AND mirror_t.user_id = NEW.counterparty_user_id
    AND mirror.counterparty_user_id = v_my_user_id
    AND mirror.line_type = v_mirror_line_type
    AND mirror.amount = NEW.amount
    AND mirror_t.date = v_my_date
    AND (mirror.settled_amount IS DISTINCT FROM NEW.settled_amount
         OR mirror.is_settled IS DISTINCT FROM NEW.is_settled);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.sync_transaction_line_settlement_to_mirror() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_transaction_line_settlement ON public.transaction_lines;

CREATE TRIGGER trg_sync_transaction_line_settlement
AFTER UPDATE OF settled_amount, is_settled ON public.transaction_lines
FOR EACH ROW
WHEN (NEW.counterparty_user_id IS NOT NULL)
EXECUTE FUNCTION public.sync_transaction_line_settlement_to_mirror();

COMMENT ON FUNCTION public.sync_transaction_line_settlement_to_mirror() IS
  'パートナー間で transaction_lines の精算状態を同期する。再帰は「変化がなければ更新しない」WHERE句で防止';

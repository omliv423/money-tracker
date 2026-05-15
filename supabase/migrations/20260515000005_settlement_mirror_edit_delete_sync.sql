-- settlements の編集/削除も mirror に同期する
-- アプローチ: mirrored_from_settlement_id FK で source↔mirror を明示的にリンク
--             UPDATE トリガーで mirror を追従、DELETE は FK CASCADE で自動消去

SET ROLE postgres;

-- ============================================================
-- Step 1: mirrored_from_settlement_id 列追加
-- ============================================================
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS mirrored_from_settlement_id UUID
  REFERENCES public.settlements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_settlements_mirrored_from
  ON public.settlements(mirrored_from_settlement_id)
  WHERE mirrored_from_settlement_id IS NOT NULL;

COMMENT ON COLUMN public.settlements.mirrored_from_settlement_id IS
  '相手側 mirror の場合、source settlement の id。NULL なら自分が source';

-- ============================================================
-- Step 2: create_partner_settlement_mirror を更新
-- mirror 作成時に mirrored_from_settlement_id を設定し、重複チェックを FK 経由に変える
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_partner_settlement_mirror(
  p_source_settlement_id UUID
) RETURNS UUID AS $$
DECLARE
  v_src RECORD;
  v_my_user_id UUID := auth.uid();
  v_my_counterparty_name TEXT;
  v_mirror_id UUID;
BEGIN
  SELECT * INTO v_src FROM public.settlements WHERE id = p_source_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source settlement not found'; END IF;
  IF v_src.user_id IS DISTINCT FROM v_my_user_id THEN
    RAISE EXCEPTION 'Cannot mirror another user''s settlement';
  END IF;
  IF v_src.counterparty_user_id IS NULL THEN
    RETURN NULL;  -- 世帯外なら mirror 不要
  END IF;

  -- ソース自体が mirror なら追加 mirror は作らない
  IF v_src.mirrored_from_settlement_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- 既存 mirror があれば再利用
  SELECT id INTO v_mirror_id FROM public.settlements
  WHERE mirrored_from_settlement_id = p_source_settlement_id
  LIMIT 1;

  IF v_mirror_id IS NOT NULL THEN
    RETURN v_mirror_id;
  END IF;

  -- 自分を表す counterparty名を解決
  SELECT counterparty INTO v_my_counterparty_name
  FROM public.settlements
  WHERE user_id = v_src.counterparty_user_id
    AND counterparty_user_id = v_my_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_my_counterparty_name IS NULL THEN
    SELECT partner_name INTO v_my_counterparty_name
    FROM public.accounts
    WHERE user_id = v_src.counterparty_user_id AND partner_name IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_my_counterparty_name IS NULL THEN
    SELECT split_part(email, '@', 1) INTO v_my_counterparty_name
    FROM auth.users WHERE id = v_my_user_id;
  END IF;

  INSERT INTO public.settlements
    (user_id, date, counterparty, counterparty_user_id, amount, note,
     account_id, type, mirrored_from_settlement_id)
  VALUES
    (v_src.counterparty_user_id, v_src.date,
     COALESCE(v_my_counterparty_name, 'パートナー'),
     v_my_user_id,
     -v_src.amount,
     CASE WHEN v_src.note IS NULL THEN '(mirror)' ELSE v_src.note || ' (mirror)' END,
     NULL,
     v_src.type,
     p_source_settlement_id)
  RETURNING id INTO v_mirror_id;

  RETURN v_mirror_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 3: settlements UPDATE トリガー
-- source が更新されたら mirror も追従させる (date / amount / note の変更)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_settlement_to_mirror()
RETURNS TRIGGER AS $$
BEGIN
  -- source 自身でなければ何もしない (mirror→source は伝播しない)
  IF NEW.mirrored_from_settlement_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 変化がなければ何もしない (再帰防止)
  IF NEW.date IS NOT DISTINCT FROM OLD.date
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.note IS NOT DISTINCT FROM OLD.note THEN
    RETURN NEW;
  END IF;

  UPDATE public.settlements
  SET date = NEW.date,
      amount = -NEW.amount,
      note = CASE WHEN NEW.note IS NULL THEN '(mirror)' ELSE NEW.note || ' (mirror)' END
  WHERE mirrored_from_settlement_id = NEW.id
    AND (date IS DISTINCT FROM NEW.date
         OR amount IS DISTINCT FROM -NEW.amount
         OR note IS DISTINCT FROM
            (CASE WHEN NEW.note IS NULL THEN '(mirror)' ELSE NEW.note || ' (mirror)' END));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.sync_settlement_to_mirror() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_settlement_to_mirror ON public.settlements;
CREATE TRIGGER trg_sync_settlement_to_mirror
AFTER UPDATE OF date, amount, note ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.sync_settlement_to_mirror();

COMMENT ON FUNCTION public.sync_settlement_to_mirror() IS
  'source settlement の編集を mirror に追従させる。DELETE は FK CASCADE で別途処理';

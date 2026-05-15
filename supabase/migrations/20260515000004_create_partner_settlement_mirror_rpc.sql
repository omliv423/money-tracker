-- create_partner_settlement_mirror RPC
-- 自分側 settlement を作成した後に、相手側にも mirror settlement レコードを作る

SET ROLE postgres;

CREATE OR REPLACE FUNCTION public.create_partner_settlement_mirror(
  p_source_settlement_id UUID
) RETURNS UUID AS $$
DECLARE
  v_src RECORD;
  v_my_user_id UUID := auth.uid();
  v_my_counterparty_name TEXT;
  v_mirror_id UUID;
BEGIN
  -- 元 settlement を取得
  SELECT * INTO v_src FROM public.settlements WHERE id = p_source_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source settlement not found'; END IF;
  IF v_src.user_id IS DISTINCT FROM v_my_user_id THEN
    RAISE EXCEPTION 'Cannot mirror another user''s settlement';
  END IF;
  IF v_src.counterparty_user_id IS NULL THEN
    -- 世帯外なら mirror 不要
    RETURN NULL;
  END IF;

  -- 既に mirror が存在するかチェック (同一source由来の重複防止)
  -- mirror判定: partner側で同date, counterparty_user_id=自分, amount=反対 で existing
  SELECT id INTO v_mirror_id
  FROM public.settlements
  WHERE user_id = v_src.counterparty_user_id
    AND counterparty_user_id = v_my_user_id
    AND date = v_src.date
    AND amount = -v_src.amount
    AND COALESCE(note, '') = COALESCE(CASE WHEN v_src.note IS NULL THEN '(mirror)' ELSE v_src.note || ' (mirror)' END, '(mirror)')
  LIMIT 1;

  IF v_mirror_id IS NOT NULL THEN
    RETURN v_mirror_id;  -- 既に存在
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

  -- mirror INSERT
  INSERT INTO public.settlements
    (user_id, date, counterparty, counterparty_user_id, amount, note, account_id, type)
  VALUES
    (v_src.counterparty_user_id, v_src.date,
     COALESCE(v_my_counterparty_name, 'パートナー'),
     v_my_user_id,
     -v_src.amount,  -- 反対符号
     CASE WHEN v_src.note IS NULL THEN '(mirror)' ELSE v_src.note || ' (mirror)' END,
     NULL,
     v_src.type)
  RETURNING id INTO v_mirror_id;

  RETURN v_mirror_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.create_partner_settlement_mirror(UUID) OWNER TO postgres;

COMMENT ON FUNCTION public.create_partner_settlement_mirror IS
  '自分側のsettlementを作成した後に呼び、相手側にmirror settlementを作成する。重複防止チェック内蔵';

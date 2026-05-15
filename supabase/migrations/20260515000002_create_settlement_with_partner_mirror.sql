-- create_settlement_with_items RPC
-- 精算操作 (settlement insert + lines update + settlement_items insert + balances update) を
-- 1つのRPCに集約し、paired counterparty_user_id があれば相手側にも mirror settlement を作成する

SET ROLE postgres;

-- ============================================================
-- 入力: settled lines list + remainder allocation
-- 出力: 作成された settlement のid
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_settlement_with_items(
  p_date DATE,
  p_counterparty TEXT,
  p_counterparty_user_id UUID,         -- NULLなら世帯外で mirror作成しない
  p_deposit_amount INTEGER,             -- 入金額 (0なら帳簿上の精算のみ)
  p_account_id UUID,                    -- 入金先口座 (NULL可)
  p_settle_line_ids UUID[],             -- 精算対象line ID配列 (asset/liability両方含む)
  p_debt_allocation JSONB DEFAULT '[]'::jsonb  -- 余り充当: [{line_id, amount}, ...]
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_settlement_id UUID;
  v_mirror_settlement_id UUID;
  v_line RECORD;
  v_alloc JSONB;
  v_remainder INTEGER;
  v_asset_total INTEGER := 0;
  v_settlement_type TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is NULL';
  END IF;

  -- type は受領=receive
  v_settlement_type := 'receive';

  -- 1. 自分側の settlement レコード作成
  INSERT INTO public.settlements
    (user_id, date, counterparty, counterparty_user_id, amount, note,
     account_id, type)
  VALUES
    (v_user_id, p_date, p_counterparty, p_counterparty_user_id,
     p_deposit_amount, CASE WHEN p_deposit_amount > 0 THEN NULL ELSE '精算' END,
     CASE WHEN p_deposit_amount > 0 THEN p_account_id ELSE NULL END,
     v_settlement_type)
  RETURNING id INTO v_settlement_id;

  -- 2. 選択 lines を全額精算 + settlement_items 作成
  FOR v_line IN
    SELECT tl.id, tl.amount, tl.settled_amount, tl.line_type
    FROM public.transaction_lines tl
    WHERE tl.id = ANY(p_settle_line_ids)
  LOOP
    DECLARE
      v_unsettled INTEGER := v_line.amount - COALESCE(v_line.settled_amount, 0);
    BEGIN
      UPDATE public.transaction_lines
      SET settled_amount = v_line.amount,
          is_settled = true
      WHERE id = v_line.id;

      INSERT INTO public.settlement_items (settlement_id, transaction_line_id, amount)
      VALUES (v_settlement_id, v_line.id, v_unsettled);

      IF v_line.line_type = 'asset' THEN
        v_asset_total := v_asset_total + v_unsettled;
      END IF;
    END;
  END LOOP;

  -- 3. 余り充当
  v_remainder := GREATEST(0, p_deposit_amount - v_asset_total);

  IF v_remainder > 0 AND jsonb_array_length(p_debt_allocation) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_debt_allocation)
    LOOP
      DECLARE
        v_alloc_line_id UUID := (v_alloc->>'line_id')::uuid;
        v_alloc_amount INTEGER := (v_alloc->>'amount')::integer;
        v_target_line RECORD;
      BEGIN
        SELECT amount, settled_amount INTO v_target_line
        FROM public.transaction_lines
        WHERE id = v_alloc_line_id;

        UPDATE public.transaction_lines
        SET settled_amount = COALESCE(settled_amount, 0) + v_alloc_amount,
            is_settled = (COALESCE(settled_amount, 0) + v_alloc_amount) >= amount
        WHERE id = v_alloc_line_id;

        INSERT INTO public.settlement_items (settlement_id, transaction_line_id, amount)
        VALUES (v_settlement_id, v_alloc_line_id, v_alloc_amount);

        v_remainder := v_remainder - v_alloc_amount;
      END;
    END LOOP;
  END IF;

  -- 4. 余りがあれば settlement_balances に加算
  IF v_remainder > 0 THEN
    INSERT INTO public.settlement_balances (user_id, counterparty, receive_balance, pay_balance)
    VALUES (v_user_id, p_counterparty, v_remainder, 0)
    ON CONFLICT (user_id, counterparty)
    DO UPDATE SET receive_balance = settlement_balances.receive_balance + v_remainder;
  END IF;

  -- 5. mirror: 相手側 (p_counterparty_user_id) にも settlement レコードを作成
  --    (transaction_lines の同期は trigger trg_sync_transaction_line_settlement が自動で行う)
  IF p_counterparty_user_id IS NOT NULL THEN
    -- 相手から見た「自分」counterparty名を取得 (相手の accounts.partner_name や既存settlements から推定)
    DECLARE
      v_my_counterparty_name TEXT;
    BEGIN
      SELECT counterparty INTO v_my_counterparty_name
      FROM public.settlements
      WHERE user_id = p_counterparty_user_id
        AND counterparty_user_id = v_user_id
      ORDER BY created_at DESC
      LIMIT 1;

      -- 既存記録から取れない場合は accounts.partner_name から推定
      IF v_my_counterparty_name IS NULL THEN
        SELECT partner_name INTO v_my_counterparty_name
        FROM public.accounts
        WHERE user_id = p_counterparty_user_id
          AND (partner_user_id = v_user_id OR partner_name IS NOT NULL)
        LIMIT 1;
      END IF;

      -- それでもなければ メールアドレスlocal partを使う
      IF v_my_counterparty_name IS NULL THEN
        SELECT split_part(email, '@', 1) INTO v_my_counterparty_name
        FROM auth.users WHERE id = v_user_id;
      END IF;

      INSERT INTO public.settlements
        (user_id, date, counterparty, counterparty_user_id, amount, note, account_id, type)
      VALUES
        (p_counterparty_user_id, p_date,
         COALESCE(v_my_counterparty_name, 'パートナー'), v_user_id,
         -p_deposit_amount,  -- 相手から見ると支払い (負の値)
         CASE WHEN p_deposit_amount > 0 THEN '(mirror)' ELSE '(mirror) 精算' END,
         NULL,  -- 相手側の現金口座は不明
         v_settlement_type)
      RETURNING id INTO v_mirror_settlement_id;
    END;
  END IF;

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.create_settlement_with_items(
  DATE, TEXT, UUID, INTEGER, UUID, UUID[], JSONB
) OWNER TO postgres;

COMMENT ON FUNCTION public.create_settlement_with_items IS
  '精算操作をアトミックに実行し、パートナーが居れば相手側にも mirror settlement を作成する。trigger trg_sync_transaction_line_settlement と組み合わせて両側のline精算状態を同期';

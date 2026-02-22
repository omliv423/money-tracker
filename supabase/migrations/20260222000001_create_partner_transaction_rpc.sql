SET ROLE postgres;

CREATE OR REPLACE FUNCTION public.create_partner_transaction(
  p_partner_user_id UUID,
  p_date DATE,
  p_description TEXT,
  p_amount INTEGER,
  p_account_id UUID,
  p_category_id UUID,
  p_counterparty_name TEXT,
  p_is_shared BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_my_household UUID;
  v_partner_household UUID;
  v_transaction_id UUID;
BEGIN
  -- 世帯の一致を検証
  v_my_household := public.get_user_household_id(auth.uid());
  v_partner_household := public.get_user_household_id(p_partner_user_id);

  IF v_my_household IS NULL OR v_my_household IS DISTINCT FROM v_partner_household THEN
    RAISE EXCEPTION 'Users are not in the same household';
  END IF;

  -- パートナーの取引を作成
  INSERT INTO public.transactions
    (user_id, date, payment_date, description, total_amount, account_id,
     is_cash_settled, settled_amount, paid_by_other, is_shared)
  VALUES
    (p_partner_user_id, p_date, p_date, p_description, p_amount, p_account_id,
     true, p_amount, true, p_is_shared)
  RETURNING id INTO v_transaction_id;

  -- 費用ライン
  INSERT INTO public.transaction_lines
    (transaction_id, amount, category_id, line_type, counterparty, is_settled)
  VALUES
    (v_transaction_id, p_amount, p_category_id, 'expense', NULL, false);

  -- 借入（liability）ライン
  INSERT INTO public.transaction_lines
    (transaction_id, amount, category_id, line_type, counterparty, is_settled)
  VALUES
    (v_transaction_id, p_amount, p_category_id, 'liability', p_counterparty_name, false);

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

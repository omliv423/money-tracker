-- counterparty_user_id 自動補完トリガー
-- 目的: INSERT 時に counterparty != NULL かつ同一世帯に唯一の相手が居れば、
--       counterparty_user_id を自動でセットする (フロントエンドが渡し忘れても安全)

SET ROLE postgres;

-- ============================================================
-- 同一世帯の「他のメンバー」が唯一であれば user_id を返すヘルパー
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sole_household_partner(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_household_id UUID;
  v_partner_user_id UUID;
  v_partner_count INTEGER;
BEGIN
  v_household_id := public.get_user_household_id(p_user_id);
  IF v_household_id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*), MAX(user_id) INTO v_partner_count, v_partner_user_id
  FROM public.household_members
  WHERE household_id = v_household_id
    AND user_id IS NOT NULL
    AND user_id <> p_user_id
    AND status = 'active';

  IF v_partner_count = 1 THEN
    RETURN v_partner_user_id;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER FUNCTION public.get_sole_household_partner(UUID) OWNER TO postgres;

-- ============================================================
-- transaction_lines BEFORE INSERT トリガー
-- counterparty が NULL でなく counterparty_user_id が未指定なら自動補完
-- ============================================================
CREATE OR REPLACE FUNCTION public.autofill_transaction_line_counterparty_user_id()
RETURNS TRIGGER AS $$
DECLARE
  v_tx_user_id UUID;
BEGIN
  IF NEW.counterparty IS NULL OR NEW.counterparty_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_tx_user_id FROM public.transactions WHERE id = NEW.transaction_id;
  IF v_tx_user_id IS NULL THEN RETURN NEW; END IF;

  NEW.counterparty_user_id := public.get_sole_household_partner(v_tx_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.autofill_transaction_line_counterparty_user_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_autofill_transaction_line_counterparty_user_id ON public.transaction_lines;
CREATE TRIGGER trg_autofill_transaction_line_counterparty_user_id
BEFORE INSERT ON public.transaction_lines
FOR EACH ROW
EXECUTE FUNCTION public.autofill_transaction_line_counterparty_user_id();

-- ============================================================
-- settlements BEFORE INSERT トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION public.autofill_settlement_counterparty_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counterparty IS NULL OR NEW.counterparty_user_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.counterparty_user_id := public.get_sole_household_partner(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.autofill_settlement_counterparty_user_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_autofill_settlement_counterparty_user_id ON public.settlements;
CREATE TRIGGER trg_autofill_settlement_counterparty_user_id
BEFORE INSERT ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.autofill_settlement_counterparty_user_id();

-- ============================================================
-- 既存 create_partner_transaction RPC を更新: 相手側 lines に counterparty_user_id をセット
-- ============================================================
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
  v_my_user_id UUID := auth.uid();
BEGIN
  v_my_household := public.get_user_household_id(v_my_user_id);
  v_partner_household := public.get_user_household_id(p_partner_user_id);

  IF v_my_household IS NULL OR v_my_household IS DISTINCT FROM v_partner_household THEN
    RAISE EXCEPTION 'Users are not in the same household';
  END IF;

  -- パートナー側 transaction (相手が支払うべき支出 = paid_by_other=true)
  INSERT INTO public.transactions
    (user_id, date, payment_date, description, total_amount, account_id,
     is_cash_settled, settled_amount, paid_by_other, is_shared)
  VALUES
    (p_partner_user_id, p_date, p_date, p_description, p_amount, p_account_id,
     true, p_amount, true, p_is_shared)
  RETURNING id INTO v_transaction_id;

  -- expense line
  INSERT INTO public.transaction_lines
    (transaction_id, amount, category_id, line_type, counterparty, is_settled)
  VALUES
    (v_transaction_id, p_amount, p_category_id, 'expense', NULL, false);

  -- liability line: counterparty_user_id を自分にセット
  INSERT INTO public.transaction_lines
    (transaction_id, amount, category_id, line_type, counterparty, is_settled, counterparty_user_id)
  VALUES
    (v_transaction_id, p_amount, p_category_id, 'liability', p_counterparty_name, false, v_my_user_id);

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- パートナー(あさみ)側の取引を一括作成
-- User: e58ec8a1-ce5d-41f8-acf7-e7f94aec56db
-- Partner: 41d13e60-207d-4582-83f6-2756efb7f100
-- Partner Account: 8c8e5ded-9215-4862-891c-6ca1481eea16 (三井住友)
-- Counterparty Name (user): 小笠原将之
-- Skip: 835b523f (2/17 マイバス already has partner entry)

SET ROLE postgres;

DO $$
DECLARE
  v_partner_uid UUID := '41d13e60-207d-4582-83f6-2756efb7f100';
  v_partner_account UUID := '8c8e5ded-9215-4862-891c-6ca1481eea16';
  v_user_name TEXT := '小笠原将之';
  v_tx_id UUID;
  v_new_tx_id UUID;
  v_actual_total INTEGER;
  v_partner_expense INTEGER;
  rec RECORD;
  line_rec RECORD;
BEGIN

  -- ============================================================
  -- Type A: ユーザーが払った取引 (asset ラインあり, counterparty=あさみ)
  -- → パートナーに paid_by_other=true の expense + liability を作成
  -- ============================================================
  FOR rec IN
    SELECT DISTINCT t.id, t.date, t.description, t.is_shared,
           tl.amount AS asset_amount, tl.category_id
    FROM transactions t
    JOIN transaction_lines tl ON tl.transaction_id = t.id
    WHERE t.date >= '2026-01-01'
      AND t.user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'
      AND t.paid_by_other = false
      AND tl.line_type = 'asset'
      AND tl.counterparty = 'あさみ'
      AND t.id != '835b523f-f23e-4aba-b98b-58a8bb7320d8'  -- skip already created
    ORDER BY t.date
  LOOP
    -- パートナーの取引を作成
    INSERT INTO transactions
      (user_id, date, payment_date, description, total_amount, account_id,
       is_cash_settled, settled_amount, paid_by_other, is_shared)
    VALUES
      (v_partner_uid, rec.date, rec.date, rec.description, rec.asset_amount, v_partner_account,
       true, rec.asset_amount, true, rec.is_shared)
    RETURNING id INTO v_new_tx_id;

    -- 費用ライン
    INSERT INTO transaction_lines
      (transaction_id, amount, category_id, line_type, counterparty, is_settled)
    VALUES
      (v_new_tx_id, rec.asset_amount, rec.category_id, 'expense', NULL, false);

    -- 借入（liability）ライン
    INSERT INTO transaction_lines
      (transaction_id, amount, category_id, line_type, counterparty, is_settled)
    VALUES
      (v_new_tx_id, rec.asset_amount, rec.category_id, 'liability', v_user_name, false);

    RAISE NOTICE 'Type A: % % ¥% → partner expense+liability', rec.date, rec.description, rec.asset_amount;
  END LOOP;

  -- ============================================================
  -- Type B: パートナーが払った取引 (paid_by_other=true, liability to あさみ)
  -- → パートナーに paid_by_other=false の expense + asset を作成
  -- actual_total = ROUND(user_total / 0.65)
  -- partner_expense = actual_total - user_total
  -- partner_asset = user_total (= what user owes)
  -- ============================================================
  FOR rec IN
    SELECT t.id, t.date, t.description, t.total_amount, t.is_shared,
           tl.category_id
    FROM transactions t
    JOIN transaction_lines tl ON tl.transaction_id = t.id
    WHERE t.date >= '2026-01-01'
      AND t.user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db'
      AND t.paid_by_other = true
      AND tl.line_type = 'liability'
      AND tl.counterparty = 'あさみ'
    ORDER BY t.date
  LOOP
    -- 実際の総額を計算
    v_actual_total := ROUND(rec.total_amount / 0.65);
    v_partner_expense := v_actual_total - rec.total_amount;

    -- パートナーの取引を作成（パートナーが自分で払った）
    INSERT INTO transactions
      (user_id, date, payment_date, description, total_amount, account_id,
       is_cash_settled, settled_amount, paid_by_other, is_shared)
    VALUES
      (v_partner_uid, rec.date, rec.date, rec.description, v_actual_total, v_partner_account,
       true, v_actual_total, false, rec.is_shared)
    RETURNING id INTO v_new_tx_id;

    -- 費用ライン（パートナーの負担分）
    INSERT INTO transaction_lines
      (transaction_id, amount, category_id, line_type, counterparty, is_settled)
    VALUES
      (v_new_tx_id, v_partner_expense, rec.category_id, 'expense', NULL, false);

    -- 立替（asset）ライン（ユーザーへの貸し）
    INSERT INTO transaction_lines
      (transaction_id, amount, category_id, line_type, counterparty, is_settled)
    VALUES
      (v_new_tx_id, rec.total_amount, rec.category_id, 'asset', v_user_name, false);

    RAISE NOTICE 'Type B: % % actual=¥% partner_expense=¥% asset=¥%', rec.date, rec.description, v_actual_total, v_partner_expense, rec.total_amount;
  END LOOP;

END $$;

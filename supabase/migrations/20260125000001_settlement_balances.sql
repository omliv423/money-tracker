-- settlement_balances テーブル（相手ごとの精算可能金額を管理）
CREATE TABLE IF NOT EXISTS settlement_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  counterparty TEXT NOT NULL,
  receive_balance INTEGER NOT NULL DEFAULT 0,  -- 受取可能金額（立替の精算用）
  pay_balance INTEGER NOT NULL DEFAULT 0,       -- 支払可能金額（借入の返済用）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, counterparty)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_settlement_balances_user_id ON settlement_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_balances_counterparty ON settlement_balances(counterparty);

-- RLS有効化
ALTER TABLE settlement_balances ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
CREATE POLICY "Users can view own settlement_balances" ON settlement_balances
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settlement_balances" ON settlement_balances
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settlement_balances" ON settlement_balances
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own settlement_balances" ON settlement_balances
  FOR DELETE USING (user_id = auth.uid());

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_settlement_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settlement_balances_updated_at
  BEFORE UPDATE ON settlement_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_balances_updated_at();

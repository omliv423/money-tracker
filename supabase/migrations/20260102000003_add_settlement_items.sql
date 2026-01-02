-- 精算の内訳を記録するテーブル
CREATE TABLE IF NOT EXISTS settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  transaction_line_id UUID NOT NULL REFERENCES transaction_lines(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement_id ON settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_transaction_line_id ON settlement_items(transaction_line_id);

-- RLS有効化
ALTER TABLE settlement_items ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
CREATE POLICY "Users can view own settlement_items" ON settlement_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM settlements WHERE settlements.id = settlement_items.settlement_id AND settlements.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own settlement_items" ON settlement_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM settlements WHERE settlements.id = settlement_items.settlement_id AND settlements.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own settlement_items" ON settlement_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM settlements WHERE settlements.id = settlement_items.settlement_id AND settlements.user_id = auth.uid())
  );

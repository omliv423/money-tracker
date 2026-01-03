-- 年間収支計画テーブル
CREATE TABLE IF NOT EXISTS annual_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  fiscal_year INTEGER NOT NULL,           -- 2024, 2025等
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  budget_type TEXT NOT NULL CHECK (budget_type IN ('income', 'expense')),
  planned_amount INTEGER NOT NULL,        -- 計画額
  notes TEXT,                             -- メモ
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fiscal_year, month, category_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_annual_budget_items_user_year ON annual_budget_items(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_annual_budget_items_category ON annual_budget_items(category_id);

-- RLS有効化
ALTER TABLE annual_budget_items ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
CREATE POLICY "Users can view own annual_budget_items" ON annual_budget_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annual_budget_items" ON annual_budget_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annual_budget_items" ON annual_budget_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annual_budget_items" ON annual_budget_items
  FOR DELETE USING (auth.uid() = user_id);

-- コメント
COMMENT ON TABLE annual_budget_items IS '年間収支計画（月別・カテゴリ別）';
COMMENT ON COLUMN annual_budget_items.fiscal_year IS '年度（2024, 2025等）';
COMMENT ON COLUMN annual_budget_items.month IS '月（1-12）';
COMMENT ON COLUMN annual_budget_items.budget_type IS '種別（income/expense）';
COMMENT ON COLUMN annual_budget_items.planned_amount IS '計画額';

-- 既存のbudgetsからデータを移行（今年度分）
-- INSERT INTO annual_budget_items (user_id, fiscal_year, month, category_id, budget_type, planned_amount)
-- SELECT
--   b.user_id,
--   EXTRACT(YEAR FROM now())::INTEGER as fiscal_year,
--   generate_series(1, 12) as month,
--   b.category_id,
--   'expense' as budget_type,
--   b.monthly_amount as planned_amount
-- FROM budgets b
-- WHERE b.is_active = true;

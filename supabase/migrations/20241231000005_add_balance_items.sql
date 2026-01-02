-- 資産・負債を登録するテーブル
CREATE TABLE balance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,                    -- 名前（例: 住宅ローン、投資信託）
  item_type TEXT NOT NULL,               -- asset（資産）/ liability（負債）
  category TEXT,                         -- カテゴリ（investment, real_estate, loan, etc）
  balance INTEGER NOT NULL DEFAULT 0,    -- 残高（負債はマイナスではなく正の数で保存）
  balance_date DATE,                     -- 残高基準日
  note TEXT,                             -- メモ
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE balance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own balance_items" ON balance_items
  FOR ALL USING (auth.uid() = user_id);

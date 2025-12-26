-- クイック入力テンプレートテーブル
CREATE TABLE IF NOT EXISTS quick_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  line_type TEXT DEFAULT 'expense',
  counterparty TEXT,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE quick_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to quick_entries" ON quick_entries
  FOR ALL USING (true) WITH CHECK (true);

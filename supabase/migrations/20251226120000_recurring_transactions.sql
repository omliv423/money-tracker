-- 定期取引テーブル
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  account_id UUID REFERENCES accounts(id),
  total_amount INTEGER NOT NULL,
  day_of_month INTEGER,
  payment_delay_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 定期取引明細テーブル
CREATE TABLE IF NOT EXISTS recurring_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_transaction_id UUID REFERENCES recurring_transactions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  category_id UUID REFERENCES categories(id),
  line_type TEXT NOT NULL,
  counterparty TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies (公開アクセス)
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transaction_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to recurring_transactions" ON recurring_transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to recurring_transaction_lines" ON recurring_transaction_lines
  FOR ALL USING (true) WITH CHECK (true);

-- カテゴリの親子構造を追加
ALTER TABLE categories ADD COLUMN parent_id UUID REFERENCES categories(id);

-- 親カテゴリかどうかを判定しやすくするためのインデックス
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- 相手先（取引先）テーブルを作成
CREATE TABLE counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 取引に相手先を紐づけ
ALTER TABLE transactions ADD COLUMN counterparty_id UUID REFERENCES counterparties(id);

-- インデックス追加
CREATE INDEX idx_transactions_counterparty_id ON transactions(counterparty_id);

-- サンプル相手先データ
INSERT INTO counterparties (name) VALUES
  ('Amazon'),
  ('コンビニ'),
  ('スーパー'),
  ('レストラン'),
  ('カフェ'),
  ('ドラッグストア'),
  ('その他');

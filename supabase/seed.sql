-- Money Tracker Seed Data
-- Run this after schema.sql

-- 口座 (Accounts)
INSERT INTO accounts (name, type, owner, initial_balance) VALUES
  ('楽天銀行', 'bank', 'self', 0),
  ('三井住友銀行', 'bank', 'self', 0),
  ('PayPay', 'cash', 'self', 0),
  ('現金', 'cash', 'self', 0),
  ('共同カード', 'card', 'shared', 0);

-- カテゴリ (Categories)
-- 収入
INSERT INTO categories (name, type) VALUES
  ('給与', 'income'),
  ('副収入', 'income'),
  ('その他収入', 'income');

-- 支出
INSERT INTO categories (name, type) VALUES
  ('食費', 'expense'),
  ('交通費', 'expense'),
  ('住居費', 'expense'),
  ('光熱費', 'expense'),
  ('通信費', 'expense'),
  ('娯楽費', 'expense'),
  ('日用品', 'expense'),
  ('医療費', 'expense'),
  ('被服費', 'expense'),
  ('その他', 'expense');

-- 振替
INSERT INTO categories (name, type) VALUES
  ('口座間振替', 'transfer'),
  ('立替金', 'transfer');

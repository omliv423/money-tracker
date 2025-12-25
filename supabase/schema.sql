-- Money Tracker Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table (口座・財布)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'card', 'investment', 'points')),
  owner TEXT NOT NULL DEFAULT 'self' CHECK (owner IN ('self', 'shared')),
  initial_balance INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories table (カテゴリ)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table (取引ヘッダ)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  total_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction lines table (取引明細 - 按分対応)
CREATE TABLE transaction_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  line_type TEXT NOT NULL CHECK (line_type IN ('income', 'expense', 'asset', 'liability')),
  counterparty TEXT,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settlements table (精算記録)
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  counterparty TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transaction_lines_transaction ON transaction_lines(transaction_id);
CREATE INDEX idx_transaction_lines_category ON transaction_lines(category_id);
CREATE INDEX idx_transaction_lines_counterparty ON transaction_lines(counterparty) WHERE counterparty IS NOT NULL;
CREATE INDEX idx_transaction_lines_unsettled ON transaction_lines(counterparty, is_settled) WHERE is_settled = false;
CREATE INDEX idx_settlements_date ON settlements(date DESC);
CREATE INDEX idx_settlements_counterparty ON settlements(counterparty);

-- Row Level Security (認証なしなので全て許可)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Public access policies (認証なしなので全てのアクセスを許可)
CREATE POLICY "Allow all access to accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transaction_lines" ON transaction_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to settlements" ON settlements FOR ALL USING (true) WITH CHECK (true);

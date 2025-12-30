# Row Level Security (RLS) 実装計画

> 作成日: 2024-12-31
> 目的: マルチテナント化に向けたRLS設計と実装手順

## 1. 現在のデータベース構造

### 1.1 テーブル一覧と目的

| テーブル | 目的 | レコード所有者 | 現状のRLS |
|---------|------|---------------|-----------|
| `accounts` | 口座・財布管理 | ユーザー個人 | `USING (true)` |
| `categories` | カテゴリ管理 | ユーザー個人 + 共有 | `USING (true)` |
| `counterparties` | 取引相手マスタ | ユーザー個人 | `USING (true)` |
| `transactions` | 取引ヘッダ | ユーザー個人 | `USING (true)` |
| `transaction_lines` | 取引明細 | 親取引に従属 | `USING (true)` |
| `settlements` | 精算記録 | ユーザー個人 | `USING (true)` |
| `recurring_transactions` | 定期取引テンプレート | ユーザー個人 | `USING (true)` |
| `recurring_transaction_lines` | 定期取引明細 | 親テンプレートに従属 | `USING (true)` |
| `quick_entries` | クイック入力テンプレート | ユーザー個人 | `USING (true)` |
| `budgets` | 予算設定 | ユーザー個人 | `USING (true)` |

### 1.2 現在のスキーマ (抜粋)

```sql
-- 主要テーブルの構造（user_id カラムなし）

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'self',
  initial_balance INTEGER NOT NULL DEFAULT 0,
  current_balance INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- ⚠️ user_id がない
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_date DATE,
  description TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  counterparty_id UUID REFERENCES counterparties(id),
  total_amount INTEGER NOT NULL,
  is_cash_settled BOOLEAN DEFAULT false,
  settled_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- ⚠️ user_id がない
);
```

## 2. user_id カラム追加方針

### 2.1 追加が必要なテーブル

| テーブル | 追加方法 | 備考 |
|---------|---------|------|
| `accounts` | 直接追加 | 必須 |
| `categories` | 直接追加 + NULL許容 | 共有カテゴリはNULL |
| `counterparties` | 直接追加 | 必須 |
| `transactions` | 直接追加 | 必須 |
| `transaction_lines` | **不要** | transactions.user_id をJOINで参照 |
| `settlements` | 直接追加 | 必須 |
| `recurring_transactions` | 直接追加 | 必須 |
| `recurring_transaction_lines` | **不要** | 親を参照 |
| `quick_entries` | 直接追加 | 必須 |
| `budgets` | 直接追加 | 必須 |

### 2.2 マイグレーションSQL

```sql
-- ========================================
-- Migration: Add user_id to all tables
-- ファイル: supabase/migrations/20250101000000_add_user_id.sql
-- ⚠️ 実行前に既存データのバックアップを取ること
-- ========================================

-- 1. accounts テーブル
ALTER TABLE accounts
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. categories テーブル（NULL許容 = 共有カテゴリ）
ALTER TABLE categories
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. counterparties テーブル
ALTER TABLE counterparties
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. transactions テーブル
ALTER TABLE transactions
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. settlements テーブル
ALTER TABLE settlements
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. recurring_transactions テーブル
ALTER TABLE recurring_transactions
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. quick_entries テーブル
ALTER TABLE quick_entries
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. budgets テーブル
ALTER TABLE budgets
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- インデックス追加（パフォーマンス向上）
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_counterparties_user_id ON counterparties(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_settlements_user_id ON settlements(user_id);
CREATE INDEX idx_recurring_transactions_user_id ON recurring_transactions(user_id);
CREATE INDEX idx_quick_entries_user_id ON quick_entries(user_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
```

## 3. RLSポリシー設計

### 3.1 設計原則

1. **最小権限の原則**: 自分のデータのみアクセス可能
2. **明示的な操作分離**: SELECT/INSERT/UPDATE/DELETE を個別定義
3. **auth.uid() 使用**: Supabase Auth のユーザーIDで制御
4. **親子関係の考慮**: 子テーブルは親テーブル経由で制御

### 3.2 accounts テーブル

```sql
-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Allow all access to accounts" ON accounts;

-- SELECT: 自分の口座のみ
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 自分のuser_idでのみ作成可能
CREATE POLICY "Users can create own accounts"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 自分の口座のみ更新可能
CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 自分の口座のみ削除可能
CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);
```

### 3.3 categories テーブル (共有カテゴリ対応)

```sql
DROP POLICY IF EXISTS "Allow all access to categories" ON categories;

-- SELECT: 自分のカテゴリ + 共有カテゴリ (user_id = NULL)
CREATE POLICY "Users can view own and shared categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- INSERT: 自分のカテゴリのみ作成可能
CREATE POLICY "Users can create own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 自分のカテゴリのみ更新可能（共有は更新不可）
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 自分のカテゴリのみ削除可能
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);
```

### 3.4 transactions テーブル

```sql
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);
```

### 3.5 transaction_lines テーブル (親テーブル参照)

```sql
DROP POLICY IF EXISTS "Allow all access to transaction_lines" ON transaction_lines;

-- SELECT: 親取引が自分のものであれば閲覧可能
CREATE POLICY "Users can view lines of own transactions"
  ON transaction_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- INSERT: 親取引が自分のものであれば作成可能
CREATE POLICY "Users can create lines for own transactions"
  ON transaction_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- UPDATE: 親取引が自分のものであれば更新可能
CREATE POLICY "Users can update lines of own transactions"
  ON transaction_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- DELETE: 親取引が自分のものであれば削除可能
CREATE POLICY "Users can delete lines of own transactions"
  ON transaction_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );
```

### 3.6 その他のテーブル（標準パターン）

以下のテーブルは accounts と同じパターンを適用:
- `counterparties`
- `settlements`
- `recurring_transactions`
- `quick_entries`
- `budgets`

`recurring_transaction_lines` は `transaction_lines` と同じ親参照パターンを適用。

## 4. 完全なマイグレーションSQL

```sql
-- ========================================
-- Migration: Implement RLS policies
-- ファイル: supabase/migrations/20250101000001_add_rls_policies.sql
-- ⚠️ user_idカラム追加後に実行すること
-- ========================================

-- ===================
-- accounts
-- ===================
DROP POLICY IF EXISTS "Allow all access to accounts" ON accounts;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts"
  ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- categories (共有対応)
-- ===================
DROP POLICY IF EXISTS "Allow all access to categories" ON categories;

CREATE POLICY "Users can view own and shared categories"
  ON categories FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create own categories"
  ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- counterparties
-- ===================
DROP POLICY IF EXISTS "Allow all access to counterparties" ON counterparties;

CREATE POLICY "Users can view own counterparties"
  ON counterparties FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own counterparties"
  ON counterparties FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counterparties"
  ON counterparties FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own counterparties"
  ON counterparties FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- transactions
-- ===================
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- transaction_lines (親参照)
-- ===================
DROP POLICY IF EXISTS "Allow all access to transaction_lines" ON transaction_lines;

CREATE POLICY "Users can view lines of own transactions"
  ON transaction_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM transactions
    WHERE transactions.id = transaction_lines.transaction_id
    AND transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create lines for own transactions"
  ON transaction_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM transactions
    WHERE transactions.id = transaction_lines.transaction_id
    AND transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can update lines of own transactions"
  ON transaction_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM transactions
    WHERE transactions.id = transaction_lines.transaction_id
    AND transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete lines of own transactions"
  ON transaction_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM transactions
    WHERE transactions.id = transaction_lines.transaction_id
    AND transactions.user_id = auth.uid()
  ));

-- ===================
-- settlements
-- ===================
DROP POLICY IF EXISTS "Allow all access to settlements" ON settlements;

CREATE POLICY "Users can view own settlements"
  ON settlements FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settlements"
  ON settlements FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settlements"
  ON settlements FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settlements"
  ON settlements FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- recurring_transactions
-- ===================
DROP POLICY IF EXISTS "Allow all access to recurring_transactions" ON recurring_transactions;

CREATE POLICY "Users can view own recurring_transactions"
  ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recurring_transactions"
  ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring_transactions"
  ON recurring_transactions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring_transactions"
  ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- recurring_transaction_lines (親参照)
-- ===================
DROP POLICY IF EXISTS "Allow all access to recurring_transaction_lines" ON recurring_transaction_lines;

CREATE POLICY "Users can view own recurring_transaction_lines"
  ON recurring_transaction_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM recurring_transactions
    WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
    AND recurring_transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own recurring_transaction_lines"
  ON recurring_transaction_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM recurring_transactions
    WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
    AND recurring_transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own recurring_transaction_lines"
  ON recurring_transaction_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM recurring_transactions
    WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
    AND recurring_transactions.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own recurring_transaction_lines"
  ON recurring_transaction_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM recurring_transactions
    WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
    AND recurring_transactions.user_id = auth.uid()
  ));

-- ===================
-- quick_entries
-- ===================
DROP POLICY IF EXISTS "Allow all access to quick_entries" ON quick_entries;

CREATE POLICY "Users can view own quick_entries"
  ON quick_entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quick_entries"
  ON quick_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick_entries"
  ON quick_entries FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick_entries"
  ON quick_entries FOR DELETE USING (auth.uid() = user_id);

-- ===================
-- budgets
-- ===================
DROP POLICY IF EXISTS "Allow all access to budgets" ON budgets;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own budgets"
  ON budgets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE USING (auth.uid() = user_id);
```

## 5. 共有カテゴリ（システムデフォルト）の扱い

### 5.1 設計方針

- `categories.user_id = NULL` は共有（システムデフォルト）カテゴリ
- 全ユーザーが閲覧可能、編集・削除は不可
- 管理者のみが作成・編集可能（Supabase Dashboard or service_role key）

### 5.2 初期共有カテゴリの例

```sql
-- システムデフォルトカテゴリ (user_id = NULL)
INSERT INTO categories (name, type, user_id) VALUES
  ('給与', 'income', NULL),
  ('副業', 'income', NULL),
  ('食費', 'expense', NULL),
  ('住居費', 'expense', NULL),
  ('光熱費', 'expense', NULL),
  ('通信費', 'expense', NULL),
  ('交通費', 'expense', NULL),
  ('娯楽費', 'expense', NULL),
  ('資金移動', 'transfer', NULL);
```

## 6. フロントエンド対応

### 6.1 Supabaseクライアント更新

**ファイル**: `src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ブラウザ用クライアント（認証セッション付き）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

### 6.2 INSERT時のuser_id設定

```typescript
// Before (user_idなし)
await supabase.from("transactions").insert({
  date: accrualDate,
  description,
  account_id: accountId,
  total_amount: totalAmount,
});

// After (user_id追加)
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not authenticated");

await supabase.from("transactions").insert({
  user_id: user.id,  // ← 追加
  date: accrualDate,
  description,
  account_id: accountId,
  total_amount: totalAmount,
});
```

### 6.3 型定義更新

**ファイル**: `src/types/supabase.ts` の各テーブルに `user_id` を追加

```typescript
transactions: {
  Row: {
    id: string
    user_id: string  // ← 追加
    date: string
    // ...
  }
  Insert: {
    user_id: string  // ← 追加（必須）
    // ...
  }
}
```

## 7. テスト手順

### 7.1 事前準備

1. テスト用ユーザーを2つ作成
   - User A: `test-a@example.com`
   - User B: `test-b@example.com`

2. 各ユーザーでログインしてデータを作成

### 7.2 テストケース

| No | テスト内容 | 期待結果 |
|----|-----------|---------|
| 1 | User A でログインし、自分の取引を取得 | 自分の取引のみ返却 |
| 2 | User A でログインし、User B の取引IDで直接アクセス | 空配列 or エラー |
| 3 | 未ログイン状態でAPI呼び出し | 空配列（RLSでブロック） |
| 4 | User A で共有カテゴリを取得 | 共有カテゴリが返却される |
| 5 | User A で共有カテゴリを更新しようとする | エラー |
| 6 | User A が User B の口座IDを指定して取引作成 | エラー（FK違反 or RLS違反） |

### 7.3 テストスクリプト例

```typescript
// tests/rls.test.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(URL, ANON_KEY);

describe("RLS Tests", () => {
  let userAToken: string;
  let userBToken: string;
  let userATransactionId: string;

  beforeAll(async () => {
    // User A でログイン
    const { data: a } = await supabase.auth.signInWithPassword({
      email: "test-a@example.com",
      password: "password",
    });
    userAToken = a.session!.access_token;

    // User B でログイン
    const { data: b } = await supabase.auth.signInWithPassword({
      email: "test-b@example.com",
      password: "password",
    });
    userBToken = b.session!.access_token;
  });

  test("User A cannot see User B transactions", async () => {
    // User A のセッションで User B の取引を取得しようとする
    supabase.auth.setSession({ access_token: userAToken, refresh_token: "" });

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", "USER_B_ID"); // User B のID

    expect(data).toHaveLength(0);
  });

  test("Unauthenticated request returns empty", async () => {
    // セッションをクリア
    await supabase.auth.signOut();

    const { data } = await supabase.from("transactions").select("*");
    expect(data).toHaveLength(0);
  });
});
```

## 8. anon key をフロントで使う安全条件

### 8.1 必須条件

| 条件 | 説明 |
|------|------|
| RLS有効化 | 全テーブルで `ALTER TABLE xxx ENABLE ROW LEVEL SECURITY;` |
| 適切なポリシー | `USING (true)` を禁止し、`auth.uid()` ベースに |
| 認証必須 | 未認証では何もできない状態に |

### 8.2 anon key vs service_role key

| キー | 用途 | RLS適用 |
|------|------|---------|
| `anon key` | フロントエンド | **適用される** |
| `service_role key` | サーバーサイドのみ | **バイパス** |

**重要**: `service_role key` は絶対にフロントエンドに公開しない

### 8.3 チェックリスト

- [ ] 全テーブルでRLSが有効になっている
- [ ] `USING (true)` のポリシーがない
- [ ] 全INSERTで `user_id = auth.uid()` を強制
- [ ] service_role key がフロントエンドにない
- [ ] 環境変数が `NEXT_PUBLIC_` で始まるのは anon key のみ

## 9. 注意事項と落とし穴

### 9.1 パフォーマンス

- `EXISTS` サブクエリは適切なインデックスがないと遅くなる
- `transaction_lines` の親参照ポリシーは `transaction_id` にインデックス必須

### 9.2 デバッグ

```sql
-- RLSポリシーの確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

### 9.3 よくあるミス

1. **INSERT時にuser_idを忘れる** → RLSでブロックされる
2. **JOINでRLSが適用されない** → 明示的にWHERE条件を追加
3. **CASCADE DELETE** → 親削除時に子もRLSチェックを通過

### 9.4 ロールバック手順

問題発生時の緊急復旧:

```sql
-- 一時的に全アクセスを許可（本番では非推奨）
CREATE POLICY "Emergency all access"
  ON transactions FOR ALL
  USING (true)
  WITH CHECK (true);
```

## 10. 次のステップ

1. `docs/product/multi-tenant-and-auth.md` で認証フロー設計
2. マイグレーション実行計画
3. 既存データの user_id 紐付け
4. フロントエンド対応

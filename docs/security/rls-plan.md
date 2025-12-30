# Row Level Security (RLS) 完成版設計

> 更新日: 2024-12-31
> ステータス: レビュー済み・改善版

## 0. 現状の問題点

### 致命的な問題

| 問題 | 影響 | ファイル |
|------|------|---------|
| **全テーブルが `USING(true)`** | 全データ漏洩・改ざん可能 | schema.sql, 全migrations |
| **user_id カラムがない** | ユーザー分離不可能 | 全テーブル |
| **budgets の UNIQUE制約** | マルチユーザーで破綻 | budgets テーブル |
| **個人データが migrations に混在** | 他人に流すと事故 | 複数migrations |
| **UUID関数が不統一** | 再現性低下 | schema.sql vs migrations |

### 方針

1. **schema.sql は開発用に限定**（本番migrationの唯一のソースはmigrations/）
2. **全テーブルに user_id 追加**
3. **RLSポリシーは操作別に分割**（ALL 1本ではなく SELECT/INSERT/UPDATE/DELETE）
4. **参照先の所有権チェック必須**（FK先も自分のデータか確認）
5. **gen_random_uuid() に統一**（pgcrypto使用）

---

## 1. テーブル別 user_id 追加方針

| テーブル | user_id追加 | 備考 |
|---------|------------|------|
| `accounts` | 必須 | |
| `categories` | 必須（NULL許容） | NULL = 共有カテゴリ |
| `counterparties` | 必須 | |
| `transactions` | 必須 | |
| `transaction_lines` | **不要** | transactions.user_id を参照 |
| `settlements` | 必須 | |
| `recurring_transactions` | 必須 | |
| `recurring_transaction_lines` | **不要** | 親を参照 |
| `quick_entries` | 必須 | |
| `budgets` | 必須 | UNIQUE制約も修正 |

---

## 2. 完全版マイグレーションSQL

### 2.1 user_id カラム追加

```sql
-- ========================================
-- Migration: 20250101000000_add_user_id_columns.sql
-- 目的: 全テーブルにuser_idカラムを追加
-- ⚠️ 実行前にバックアップ必須
-- ========================================

-- pgcrypto拡張（gen_random_uuid用）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. accounts
ALTER TABLE accounts
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- 2. categories (NULL = 共有カテゴリ)
ALTER TABLE categories
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- 3. counterparties
ALTER TABLE counterparties
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_counterparties_user_id ON counterparties(user_id);

-- 4. transactions
ALTER TABLE transactions
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- 5. settlements
ALTER TABLE settlements
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_settlements_user_id ON settlements(user_id);

-- 6. recurring_transactions
ALTER TABLE recurring_transactions
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_recurring_transactions_user_id ON recurring_transactions(user_id);

-- 7. quick_entries
ALTER TABLE quick_entries
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_quick_entries_user_id ON quick_entries(user_id);

-- 8. budgets (UNIQUE制約も修正)
ALTER TABLE budgets
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 旧UNIQUE制約を削除（存在する場合）
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_id_key;

-- 新UNIQUE制約（user_id + category_id）
ALTER TABLE budgets ADD CONSTRAINT budgets_user_category_unique UNIQUE(user_id, category_id);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
```

### 2.2 既存ポリシー削除

```sql
-- ========================================
-- Migration: 20250101000001_drop_allow_all_policies.sql
-- 目的: 危険な USING(true) ポリシーを全削除
-- ========================================

-- accounts
DROP POLICY IF EXISTS "Allow all access to accounts" ON accounts;

-- categories
DROP POLICY IF EXISTS "Allow all access to categories" ON categories;

-- counterparties
DROP POLICY IF EXISTS "Allow all access to counterparties" ON counterparties;

-- transactions
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;

-- transaction_lines
DROP POLICY IF EXISTS "Allow all access to transaction_lines" ON transaction_lines;

-- settlements
DROP POLICY IF EXISTS "Allow all access to settlements" ON settlements;

-- recurring_transactions
DROP POLICY IF EXISTS "Allow all access to recurring_transactions" ON recurring_transactions;

-- recurring_transaction_lines
DROP POLICY IF EXISTS "Allow all access to recurring_transaction_lines" ON recurring_transaction_lines;

-- quick_entries
DROP POLICY IF EXISTS "Allow all access to quick_entries" ON quick_entries;

-- budgets
DROP POLICY IF EXISTS "Allow all access to budgets" ON budgets;
```

### 2.3 新RLSポリシー（操作別・参照チェック付き）

```sql
-- ========================================
-- Migration: 20250101000002_add_secure_rls_policies.sql
-- 目的: 安全なRLSポリシーを設定
-- ========================================

-- =====================
-- accounts
-- =====================
CREATE POLICY "accounts_select_own"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- categories (共有カテゴリ対応)
-- =====================
-- SELECT: 自分の + 共有(user_id IS NULL)
CREATE POLICY "categories_select_own_and_shared"
  ON categories FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- INSERT: 自分のみ（共有は管理者がservice_roleで作成）
CREATE POLICY "categories_insert_own"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 自分のみ（共有は更新不可）
CREATE POLICY "categories_update_own"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 自分のみ
CREATE POLICY "categories_delete_own"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- counterparties
-- =====================
CREATE POLICY "counterparties_select_own"
  ON counterparties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "counterparties_insert_own"
  ON counterparties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counterparties_update_own"
  ON counterparties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counterparties_delete_own"
  ON counterparties FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- transactions (参照先所有権チェック付き)
-- =====================
CREATE POLICY "transactions_select_own"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: account_id, counterparty_id が自分のものか確認
CREATE POLICY "transactions_insert_own_with_refs"
  ON transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
    )
    AND (
      transactions.counterparty_id IS NULL
      OR EXISTS (
        SELECT 1 FROM counterparties
        WHERE counterparties.id = transactions.counterparty_id
        AND counterparties.user_id = auth.uid()
      )
    )
  );

-- UPDATE: 同様に参照先もチェック
CREATE POLICY "transactions_update_own_with_refs"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
    )
    AND (
      transactions.counterparty_id IS NULL
      OR EXISTS (
        SELECT 1 FROM counterparties
        WHERE counterparties.id = transactions.counterparty_id
        AND counterparties.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "transactions_delete_own"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- transaction_lines (親と参照先の所有権チェック)
-- =====================
-- SELECT: 親transactionが自分のもの
CREATE POLICY "transaction_lines_select_via_parent"
  ON transaction_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- INSERT: 親transaction + category が自分のもの（または共有カテゴリ）
CREATE POLICY "transaction_lines_insert_with_refs"
  ON transaction_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
    AND (
      transaction_lines.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = transaction_lines.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

-- UPDATE: 同様
CREATE POLICY "transaction_lines_update_with_refs"
  ON transaction_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
    AND (
      transaction_lines.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = transaction_lines.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "transaction_lines_delete_via_parent"
  ON transaction_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_lines.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- =====================
-- settlements
-- =====================
CREATE POLICY "settlements_select_own"
  ON settlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "settlements_insert_own"
  ON settlements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settlements_update_own"
  ON settlements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settlements_delete_own"
  ON settlements FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- recurring_transactions (参照先チェック付き)
-- =====================
CREATE POLICY "recurring_transactions_select_own"
  ON recurring_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recurring_transactions_insert_own_with_refs"
  ON recurring_transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      recurring_transactions.account_id IS NULL
      OR EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = recurring_transactions.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "recurring_transactions_update_own_with_refs"
  ON recurring_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      recurring_transactions.account_id IS NULL
      OR EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = recurring_transactions.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "recurring_transactions_delete_own"
  ON recurring_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- recurring_transaction_lines (親とcategory所有権チェック)
-- =====================
CREATE POLICY "recurring_transaction_lines_select_via_parent"
  ON recurring_transaction_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_transactions
      WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
      AND recurring_transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_transaction_lines_insert_with_refs"
  ON recurring_transaction_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_transactions
      WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
      AND recurring_transactions.user_id = auth.uid()
    )
    AND (
      recurring_transaction_lines.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = recurring_transaction_lines.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "recurring_transaction_lines_update_with_refs"
  ON recurring_transaction_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recurring_transactions
      WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
      AND recurring_transactions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_transactions
      WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
      AND recurring_transactions.user_id = auth.uid()
    )
    AND (
      recurring_transaction_lines.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = recurring_transaction_lines.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "recurring_transaction_lines_delete_via_parent"
  ON recurring_transaction_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recurring_transactions
      WHERE recurring_transactions.id = recurring_transaction_lines.recurring_transaction_id
      AND recurring_transactions.user_id = auth.uid()
    )
  );

-- =====================
-- quick_entries (参照先チェック付き)
-- =====================
CREATE POLICY "quick_entries_select_own"
  ON quick_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "quick_entries_insert_own_with_refs"
  ON quick_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      quick_entries.account_id IS NULL
      OR EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = quick_entries.account_id
        AND accounts.user_id = auth.uid()
      )
    )
    AND (
      quick_entries.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = quick_entries.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "quick_entries_update_own_with_refs"
  ON quick_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      quick_entries.account_id IS NULL
      OR EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = quick_entries.account_id
        AND accounts.user_id = auth.uid()
      )
    )
    AND (
      quick_entries.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = quick_entries.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "quick_entries_delete_own"
  ON quick_entries FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- budgets (参照先チェック付き)
-- =====================
CREATE POLICY "budgets_select_own"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "budgets_insert_own_with_refs"
  ON budgets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      budgets.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = budgets.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "budgets_update_own_with_refs"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      budgets.category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM categories
        WHERE categories.id = budgets.category_id
        AND (categories.user_id = auth.uid() OR categories.user_id IS NULL)
      )
    )
  );

CREATE POLICY "budgets_delete_own"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 3. 既存データ移行

```sql
-- ========================================
-- Migration: 20250101000003_migrate_existing_data.sql
-- 目的: 既存データを特定ユーザーに紐付け
-- ⚠️ YOUR-USER-ID を実際のUUIDに置き換えて実行
-- ========================================

DO $$
DECLARE
  owner_user_id UUID := 'YOUR-USER-ID-HERE';  -- ← Supabase Dashboard で確認
BEGIN
  -- 全テーブルのuser_idを設定
  UPDATE accounts SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE categories SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE counterparties SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE transactions SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE settlements SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE recurring_transactions SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE quick_entries SET user_id = owner_user_id WHERE user_id IS NULL;
  UPDATE budgets SET user_id = owner_user_id WHERE user_id IS NULL;

  RAISE NOTICE 'Migrated all data to user: %', owner_user_id;
END $$;

-- NOT NULL制約を追加（categoriesは共有のためNULL許容のまま）
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE counterparties ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settlements ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE recurring_transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE quick_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
```

---

## 4. schema.sql の扱い

### 方針: 開発用に限定、本番はmigrations only

```sql
-- schema.sql 冒頭に警告を追加
-- ========================================
-- ⚠️ WARNING: このファイルはローカル開発専用です
-- 本番環境では supabase/migrations/ のみを使用してください
--
-- このファイルの USING(true) ポリシーは開発用です
-- 本番では絶対に使用しないでください
-- ========================================
```

### 推奨: schema.sql の役割

| 用途 | 可否 |
|------|------|
| ローカル開発の初期化 | OK |
| 本番DBの構築 | **NG** |
| テーブル構造の参照 | OK（ただしmigrationsが正） |

---

## 5. UUID関数の統一

### 方針: `gen_random_uuid()` に統一

```sql
-- pgcrypto拡張を有効化（マイグレーション冒頭で）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 新規テーブル作成時
CREATE TABLE example (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ← これを使う
  ...
);
```

### 既存の uuid_generate_v4() を置き換える必要はない
- 既存データには影響なし
- 今後の新規テーブル・カラムで統一すればOK

---

## 6. 個人データの分離

### 問題のマイグレーション

```sql
-- 20251225080000_add_current_balance.sql より
UPDATE accounts SET current_balance = 409056 WHERE name = '三井住友';
UPDATE accounts SET current_balance = 55331 WHERE name = '楽天銀行';
```

### 対策

1. **seed.sql に移動** → 開発/デモ用データとして分離
2. **本番では手動入力** → UIから設定

```
supabase/
├── migrations/      # スキーマ変更のみ（データなし）
├── seed.sql         # 開発用初期データ（本番では使わない）
└── schema.sql       # 開発用（本番では使わない）
```

---

## 7. SSR寄せのルール（再掲）

| 操作 | 実装場所 | 理由 |
|------|---------|------|
| SELECT | クライアント直接OK | RLSで保護 |
| INSERT | Route Handler推奨 | user_id自動付与、監査ログ |
| UPDATE | Route Handler推奨 | 同上 |
| DELETE | Route Handler推奨 | 同上 |
| Pro機能 | **Route Handler必須** | フロント突破防止 |

### Pro制限の実装場所

```typescript
// ❌ フロントだけ（突破される）
if (!isPro) return <LockedUI />;

// ✅ Route Handler で強制
// src/app/api/transactions/route.ts
export async function POST(request: Request) {
  const user = await getUser();
  const subscription = await getSubscription(user.id);

  if (subscription.plan === 'free') {
    const count = await getMonthlyTransactionCount(user.id);
    if (count >= 50) {
      return NextResponse.json(
        { error: 'Free plan limit reached' },
        { status: 403 }
      );
    }
  }

  // 実際の処理...
}
```

---

## 8. チェックリスト

### マイグレーション適用前

- [ ] バックアップ取得: `supabase db dump -f backup.sql`
- [ ] ローカル環境でテスト完了
- [ ] 自分のuser_id を取得済み

### マイグレーション適用後

- [ ] 全テーブルに user_id が存在
- [ ] 全テーブルの USING(true) ポリシーが削除済み
- [ ] 新ポリシーが正しく適用されている
- [ ] 既存データに user_id が設定されている
- [ ] budgets の UNIQUE制約が (user_id, category_id) になっている

### 動作確認

- [ ] 自分のデータが正常に表示される
- [ ] 別ユーザーでログインすると空（データなし）
- [ ] INSERT時に他人のaccount_idを指定するとエラー
- [ ] INSERT時に他人のcategory_idを指定するとエラー

---

## 9. 次のステップ

1. 認証実装（`docs/product/multi-tenant-and-auth.md` 参照）
2. マイグレーションファイル作成
3. ローカルテスト
4. 本番適用

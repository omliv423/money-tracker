# 実装ロードマップ

> 作成日: 2024-12-31
> 目的: 安全な一般公開に向けた段階的実装計画

## 概要

```
現状              MVP              β公開            本番公開
┌────┐          ┌────┐          ┌────┐          ┌────┐
│認証なし│ ────→ │認証+RLS│ ────→ │課金機能│ ────→ │本番運用│
│RLS全開放│      │基本機能│       │β招待制│       │一般公開│
└────┘          └────┘          └────┘          └────┘
   │               │               │               │
   │  Week 1-2     │  Week 3-4     │  Week 5-6     │
   │               │               │               │
```

## Phase 1: MVP（認証 + RLS）

**目標**: 認証なしで誰でもアクセス可能な状態を解消し、自分だけが使える安全な状態にする

### Week 1: 認証基盤

#### Day 1-2: Supabase Auth 設定

- [ ] Supabase Dashboard で Email Auth を有効化
- [ ] Magic Link を設定
- [ ] Redirect URLs を設定 (localhost + Vercel)
- [ ] `@supabase/ssr` パッケージをインストール
  ```bash
  npm install @supabase/ssr
  ```

#### Day 3-4: 認証コード実装

- [ ] `src/lib/supabase/client.ts` 作成（ブラウザ用）
- [ ] `src/lib/supabase/server.ts` 作成（サーバー用）
- [ ] `src/middleware.ts` 作成（ルート保護）
- [ ] `src/components/providers/AuthProvider.tsx` 作成

**ファイル一覧**:
```
src/
├── lib/
│   └── supabase/
│       ├── client.ts    # 新規
│       └── server.ts    # 新規
├── middleware.ts        # 新規
└── components/
    └── providers/
        └── AuthProvider.tsx  # 新規
```

#### Day 5-6: 認証UI

- [ ] `src/app/login/page.tsx` 作成
- [ ] `src/app/signup/page.tsx` 作成
- [ ] `src/app/auth/callback/route.ts` 作成
- [ ] `src/app/layout.tsx` に AuthProvider 追加
- [ ] ヘッダーにログアウトボタン追加

#### Day 7: テスト

- [ ] ログイン・ログアウトの動作確認
- [ ] 未認証でのアクセスがリダイレクトされることを確認
- [ ] Magic Link でのログイン確認
- [ ] セッション永続化の確認

### Week 2: RLS + データ移行

#### Day 1-2: DBマイグレーション（user_id追加）

- [ ] バックアップ取得
  ```bash
  supabase db dump -f backup_$(date +%Y%m%d).sql
  ```
- [ ] マイグレーションファイル作成
  - `supabase/migrations/20250101000000_add_user_id.sql`
- [ ] ローカル環境でテスト
- [ ] 本番環境に適用
  ```bash
  supabase db push
  ```

#### Day 3-4: RLSポリシー実装

- [ ] 既存の `USING (true)` ポリシーを削除
- [ ] 新しいRLSポリシーを適用
  - `supabase/migrations/20250101000001_add_rls_policies.sql`
- [ ] Supabase Dashboard でポリシー確認

#### Day 5: 既存データ移行

- [ ] 自分のアカウントでログイン
- [ ] user_id を取得
- [ ] 既存データに user_id を設定
  ```sql
  UPDATE accounts SET user_id = 'YOUR-USER-ID' WHERE user_id IS NULL;
  -- 他のテーブルも同様
  ```

#### Day 6: フロントエンド対応

- [ ] 全 INSERT に user_id を追加
- [ ] 既存の `src/lib/supabase.ts` を新しいクライアントに置き換え
- [ ] 型定義更新 (`src/types/supabase.ts`)

#### Day 7: 検証

- [ ] 全機能の動作確認
- [ ] RLSが機能していることを確認（別ユーザーでテスト）
- [ ] エラーがないことを確認

### Week 1-2 完了時点でのチェックリスト

- [ ] 未認証ユーザーはログイン画面にリダイレクト
- [ ] 認証済みユーザーのみデータにアクセス可能
- [ ] 他ユーザーのデータは見えない
- [ ] 全テーブルでRLSが有効
- [ ] 既存データが自分のアカウントに紐付いている

---

## Phase 2: β公開準備

**目標**: 信頼できる少数ユーザーにテスト利用してもらう

### Week 3: 新規ユーザー対応

#### Day 1-2: 初回ユーザーセットアップ

- [ ] 新規登録時の初期データ作成（トリガーまたはクライアント）
  - デフォルト口座
  - 共有カテゴリの参照
- [ ] ウェルカム画面の作成（オプション）

#### Day 3-4: 共有カテゴリ

- [ ] システムデフォルトカテゴリを `user_id = NULL` で作成
- [ ] カテゴリ選択UIで共有カテゴリも表示
- [ ] ユーザー独自カテゴリとの混在対応

#### Day 5-6: エラーハンドリング

- [ ] ネットワークエラー時のリトライ
- [ ] RLSエラー時の適切なメッセージ
- [ ] ローディング状態の統一

#### Day 7: ドキュメント

- [ ] 利用規約作成
- [ ] プライバシーポリシー作成
- [ ] 基本的な使い方ガイド

### Week 4: Stripe 導入

#### Day 1-2: Stripe 設定

- [ ] Stripe アカウント作成
- [ ] Products & Prices 設定
- [ ] Customer Portal 設定
- [ ] Webhook 設定（テスト環境）

#### Day 3-4: DB & API

- [ ] `subscriptions` テーブル作成
- [ ] Checkout API 実装
- [ ] Customer Portal API 実装
- [ ] Webhook ハンドラー実装

#### Day 5-6: UI

- [ ] `/settings/billing` ページ作成
- [ ] プラン比較表示
- [ ] アップグレードボタン
- [ ] 現在のプラン表示

#### Day 7: テスト

- [ ] テストカードでの決済確認
- [ ] Webhook の動作確認
- [ ] 解約フローの確認

### Week 3-4 完了時点でのチェックリスト

- [ ] 新規ユーザーが登録・利用開始できる
- [ ] 共有カテゴリが全ユーザーに表示される
- [ ] Stripe テスト環境で課金フローが動作
- [ ] 利用規約・プライバシーポリシーが存在

---

## Phase 3: β公開

**目標**: 限定ユーザーでの実運用テスト

### Week 5: 機能制限 + 安定化

#### Day 1-2: Free プラン制限

- [ ] 取引数制限（月50件）
- [ ] 口座数制限（3口座）
- [ ] 定期取引制限（3件）
- [ ] 制限に達した時のUI

#### Day 3-4: 監視・ログ

- [ ] 監査ログテーブル作成
- [ ] 重要操作のログ記録
- [ ] エラー監視（Sentry 等）設定

#### Day 5-6: パフォーマンス

- [ ] 遅いクエリの特定・改善
- [ ] インデックスの最適化
- [ ] 不要な再レンダリングの削除

#### Day 7: βテスター招待

- [ ] 招待メールのテンプレート作成
- [ ] 5-10名程度を招待
- [ ] フィードバック収集の仕組み

### Week 6: フィードバック対応

#### Day 1-3: バグ修正

- [ ] βテスターからの報告対応
- [ ] クリティカルなバグ修正
- [ ] UX改善

#### Day 4-5: Stripe 本番設定

- [ ] 本番キーに切り替え
- [ ] Webhook エンドポイント更新
- [ ] テスト決済実施

#### Day 6-7: ドキュメント完成

- [ ] FAQ作成
- [ ] お問い合わせ対応フロー
- [ ] 特定商取引法に基づく表記

---

## Phase 4: 本番公開

**目標**: 一般公開して収益化開始

### Week 7+: 本番運用

- [ ] ランディングページ作成
- [ ] SEO対策
- [ ] SNS告知
- [ ] 継続的なバグ修正・改善

---

## 重要な落とし穴と回避策

### 1. RLS適用忘れ

**リスク**: 新しいテーブル追加時にRLSを設定し忘れ、データ漏洩

**回避策**:
- テーブル作成時は必ずRLS有効化とポリシー設定をセットで行う
- チェックリストをテンプレート化

```sql
-- テーブル作成テンプレート
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- columns
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own data"
  ON new_table FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. INSERT時のuser_id忘れ

**リスク**: user_idなしでINSERTするとRLSでブロックされてエラー

**回避策**:
- カスタムフックでuser_idを自動付与
```typescript
function useAuthenticatedInsert<T extends { user_id: string }>(table: string) {
  const { user } = useAuth();
  return async (data: Omit<T, "user_id">) => {
    if (!user) throw new Error("Not authenticated");
    return supabase.from(table).insert({ ...data, user_id: user.id });
  };
}
```

### 3. service_role key の漏洩

**リスク**: Webhook用のservice_role keyがフロントエンドに露出

**回避策**:
- 環境変数名に `NEXT_PUBLIC_` を付けない
- コードレビューで確認
- GitHub Secret Scanning を有効化

### 4. セッション切れによるエラー

**リスク**: 長時間操作後にセッション切れで保存失敗

**回避策**:
- `autoRefreshToken: true` を設定
- エラー時にリトライ機能を実装
- セッション切れ時はログイン画面へ案内

### 5. マイグレーション失敗

**リスク**: 本番DBのマイグレーションで問題発生

**回避策**:
- 必ず事前にバックアップ
- ローカル環境で十分にテスト
- 段階的に適用（user_id追加 → RLS適用）

### 6. Stripe Webhook 署名検証スキップ

**リスク**: 不正なWebhookリクエストでサブスクリプション状態を改ざん

**回避策**:
- 必ず `stripe.webhooks.constructEvent()` で署名検証
- HTTPS以外は拒否

### 7. 料金プラン変更の影響

**リスク**: プラン変更時に既存ユーザーの機能が突然制限

**回避策**:
- 既存ユーザーは旧プランを維持（グランドファザリング）
- 事前告知を徹底

---

## タスク優先度マトリクス

| タスク | 重要度 | 緊急度 | 優先度 |
|--------|--------|--------|--------|
| 認証実装 | 高 | 高 | **最優先** |
| RLS設定 | 高 | 高 | **最優先** |
| 既存データ移行 | 高 | 高 | **最優先** |
| エラーハンドリング | 中 | 中 | 中 |
| 課金機能 | 高 | 低 | 中 |
| 機能制限 | 中 | 低 | 低 |
| ランディングページ | 低 | 低 | 低 |

---

## 依存関係図

```
                    ┌─────────────────┐
                    │ @supabase/ssr   │
                    │ パッケージ追加   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │ client.ts │  │ server.ts │  │middleware │
      └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │ AuthProvider    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
      ┌───────────────┐            ┌───────────────┐
      │ Login/Signup  │            │ layout.tsx    │
      │ pages         │            │ 更新          │
      └───────────────┘            └───────────────┘
              │
              ▼
      ┌───────────────────────────────────────────┐
      │ user_id カラム追加 マイグレーション        │
      └────────────────────┬──────────────────────┘
                           │
                           ▼
      ┌───────────────────────────────────────────┐
      │ RLSポリシー適用 マイグレーション           │
      └────────────────────┬──────────────────────┘
                           │
                           ▼
      ┌───────────────────────────────────────────┐
      │ 既存データに user_id 設定                  │
      └────────────────────┬──────────────────────┘
                           │
                           ▼
      ┌───────────────────────────────────────────┐
      │ フロントエンド INSERT 修正                │
      └───────────────────────────────────────────┘
```

---

## クイックスタートコマンド

```bash
# Phase 1 開始
npm install @supabase/ssr

# バックアップ
supabase db dump -f backup_$(date +%Y%m%d).sql

# マイグレーション適用
supabase db push

# Phase 2 開始
npm install stripe

# 開発サーバー起動
npm run dev
```

---

## 成功指標

| フェーズ | 指標 |
|----------|------|
| MVP | 認証なしでアクセス不可、自分のデータのみ表示 |
| β公開 | 5+ ユーザーが1週間以上継続利用 |
| 本番公開 | 1+ 有料ユーザー獲得 |

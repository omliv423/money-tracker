# Current Architecture Analysis

> 調査日: 2024-12-31
> 対象リポジトリ: money-tracker

## 1. 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | 16.1.1 |
| 言語 | TypeScript | 5.x |
| UI | React | 19.2.3 |
| CSS | Tailwind CSS v4 | 4.x |
| コンポーネント | shadcn/ui (Radix UI) | - |
| アニメーション | Framer Motion | 12.x |
| データベース | Supabase (PostgreSQL) | - |
| 認証 | **なし（未実装）** | - |
| デプロイ | Vercel | - |
| PWA | @ducanh2912/next-pwa | 10.2.9 |
| チャート | Recharts | 3.6.0 |

## 2. ディレクトリ構成

```
money-tracker/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx            # ルートレイアウト（認証ガードなし）
│   │   ├── page.tsx              # ホーム（取引登録フォーム）
│   │   ├── transactions/         # 取引一覧・詳細
│   │   ├── reports/              # レポート (PL/BS/CF)
│   │   ├── settings/             # 設定画面群
│   │   ├── settlements/          # 立替精算
│   │   ├── cash-settlements/     # 現金精算
│   │   └── transfer/             # 資金移動
│   ├── components/
│   │   ├── layout/               # MainLayout, BottomNav
│   │   ├── transaction/          # TransactionForm等
│   │   ├── quick-entry/          # クイック入力
│   │   ├── recurring/            # 定期取引
│   │   └── ui/                   # shadcn/ui コンポーネント
│   ├── lib/
│   │   ├── supabase.ts           # Supabaseクライアント（anon keyのみ）
│   │   └── utils.ts              # ユーティリティ
│   └── types/
│       ├── supabase.ts           # DB型定義
│       └── database.ts           # 追加型定義
├── supabase/
│   ├── schema.sql                # 初期スキーマ
│   ├── migrations/               # マイグレーションファイル群
│   └── seed.sql                  # 初期データ
├── public/
│   ├── manifest.json             # PWA設定
│   └── icons/                    # アプリアイコン
├── next.config.ts                # PWA設定含む
└── .env.local                    # 環境変数（Supabase認証情報）
```

## 3. 主要機能一覧

| 機能 | 説明 | 実装ファイル |
|------|------|-------------|
| 取引登録 | 金額入力→詳細入力の2ステップフォーム | `src/components/transaction/TransactionForm.tsx` |
| 取引一覧 | フィルター付き一覧表示 | `src/app/transactions/page.tsx` |
| 取引編集 | 取引詳細の編集・削除 | `src/app/transactions/[id]/page.tsx` |
| PL (損益計算書) | 月次収支レポート | `src/app/reports/pl/page.tsx` |
| BS (貸借対照表) | 資産・負債一覧 | `src/app/reports/bs/page.tsx` |
| CF (キャッシュフロー) | 資金の流れ | `src/app/reports/cf/page.tsx` |
| 立替精算 | 立替金の管理・精算 | `src/app/settlements/page.tsx` |
| 定期取引 | 毎月の固定費テンプレート | `src/app/settings/recurring/` |
| クイック入力 | よく使う取引のショートカット | `src/components/quick-entry/` |
| 予算管理 | カテゴリ別月間予算設定 | `src/app/settings/budgets/` |
| 資金移動 | 口座間の振替 | `src/app/transfer/page.tsx` |
| マスタ管理 | 口座・カテゴリ・相手先の管理 | `src/app/settings/` |

## 4. データフロー

```
┌─────────────────────────────────────────────────────────────────┐
│  ブラウザ (PWA)                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Component (use client)                            │  │
│  │  - useState, useEffect でデータ取得                       │  │
│  │  - supabase.from('table').select/insert/update/delete   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @supabase/supabase-js (anon key)                        │  │
│  │  - NEXT_PUBLIC_SUPABASE_URL                              │  │
│  │  - NEXT_PUBLIC_SUPABASE_ANON_KEY                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼ HTTPS (PostgREST API)
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Project                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Row Level Security (RLS)                                 │  │
│  │  ⚠️ 現在: USING (true) → 全データ全アクセス可能           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL                                               │  │
│  │  - 10+ テーブル（後述）                                    │  │
│  │  - user_id カラムなし                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Supabase利用状況

### 5.1 利用している機能

| 機能 | 利用状況 |
|------|---------|
| Database (PostgreSQL) | **利用中** - 主要データ保存 |
| Auth | **未利用** - 認証なし |
| Storage | **未利用** |
| Edge Functions | **未利用** |
| Realtime | **未利用** |

### 5.2 クライアント初期化

**ファイル**: `src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

**問題点**:
- anon key のみ使用（認証セッションなし）
- 全てのDBアクセスがクライアントサイドから直接実行
- Server Component / API Route / middleware は未使用

### 5.3 環境変数

**ファイル**: `.env.local.example`

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 6. 認証の現状

### 6.1 認証実装: **完全に未実装**

調査結果:
- `auth`, `session`, `login`, `signIn`, `signOut` のキーワード検索: **該当なし**
- `middleware.ts`: **存在しない**
- `layout.tsx`: 認証プロバイダなし
- Supabase Auth: **未使用**

### 6.2 アクセス制御: **なし**

- 全ページが誰でもアクセス可能
- URLを知っていれば全データが閲覧・編集・削除可能
- anon key が公開されているため、PostgREST API へ直接アクセス可能

## 7. データベーステーブル一覧

| テーブル名 | 目的 | user_id | RLSポリシー |
|-----------|------|---------|------------|
| `accounts` | 口座・財布 | なし | `USING (true)` |
| `categories` | カテゴリ | なし | `USING (true)` |
| `counterparties` | 取引相手 | なし | `USING (true)` |
| `transactions` | 取引ヘッダ | なし | `USING (true)` |
| `transaction_lines` | 取引明細 | なし | `USING (true)` |
| `settlements` | 精算記録 | なし | `USING (true)` |
| `recurring_transactions` | 定期取引 | なし | `USING (true)` |
| `recurring_transaction_lines` | 定期取引明細 | なし | `USING (true)` |
| `quick_entries` | クイック入力 | なし | `USING (true)` |
| `budgets` | 予算設定 | なし | `USING (true)` |

**全テーブルで `USING (true)` ポリシー = 認証なしで全データアクセス可能**

## 8. セキュリティリスク一覧

### 8.1 致命的リスク (Critical)

| リスク | 影響 | 発生条件 |
|--------|------|---------|
| **全データ漏洩** | 全ユーザーの財務データが閲覧可能 | URLまたはanon keyを知っている |
| **データ改ざん** | 任意のデータを変更・削除可能 | 上記同様 |
| **なりすまし** | 他人のデータを操作可能 | 認証がないため誰でも |

### 8.2 具体的な攻撃シナリオ

#### シナリオ1: PostgREST API直接アクセス

```bash
# anon key を使ってcurlで全取引を取得
curl 'https://xxx.supabase.co/rest/v1/transactions?select=*' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

結果: 全取引データがJSON形式で返却される

#### シナリオ2: データ削除攻撃

```bash
# 全取引を削除
curl -X DELETE 'https://xxx.supabase.co/rest/v1/transactions?id=gt.0' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

結果: 全取引データが削除される

#### シナリオ3: URL推測によるアクセス

VercelのデプロイURLは推測可能なパターン:
- `https://money-tracker-xxx.vercel.app`

一度アクセスできれば、ブラウザのDevToolsからanon keyを抽出可能

### 8.3 高リスク (High)

| リスク | 説明 |
|--------|------|
| CSRF | 認証がないため保護不要（逆に言えば保護できない） |
| セッション管理なし | ログアウト機能がない |
| 監査ログなし | 誰がいつ何をしたか追跡不可能 |

### 8.4 中リスク (Medium)

| リスク | 説明 |
|--------|------|
| レート制限なし | DoS攻撃に脆弱 |
| 入力検証がクライアントのみ | サーバーサイドのvalidationなし |
| エラー情報漏洩 | Supabaseエラーがそのまま表示される可能性 |

## 9. 現状の要約

### できていること
- 機能面は充実（PL/BS/CF、立替精算、定期取引、予算管理など）
- PWA対応でモバイルフレンドリー
- TypeScript型安全
- DBスキーマはしっかり設計されている

### 致命的に不足していること
1. **認証システム** - 誰でもアクセス可能
2. **RLSポリシー** - `USING (true)` で全開放
3. **user_idカラム** - マルチテナント化不可能
4. **ミドルウェア** - ルート保護なし
5. **サーバーサイド処理** - 全てクライアントサイド

## 10. 次のステップ

公開に向けて最低限必要な対応:

1. **Phase 1: 認証基盤** (最優先)
   - Supabase Auth導入
   - 全テーブルにuser_idカラム追加
   - RLSポリシーを `auth.uid() = user_id` に変更

2. **Phase 2: フロントエンド保護**
   - middleware.ts でルート保護
   - 認証状態管理のContext追加
   - ログイン/ログアウトUI

3. **Phase 3: データ移行**
   - 既存データを自分のuser_idに紐付け

詳細は `docs/security/rls-plan.md` および `docs/implementation/roadmap.md` を参照。

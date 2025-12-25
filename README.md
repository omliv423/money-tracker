# Money Tracker

個人財務管理PWAアプリ - PL/BS/CFの観点で家計を管理

## 特徴

- スマホでサッと支払いを記録
- 1つの支払いを複数カテゴリ/立替に按分可能
- PL（損益計算書）/ BS（貸借対照表）/ CF（キャッシュフロー）形式でレポート
- 個人支出と共同支出（彼女との共同カード等）を分離
- 立替金の管理・精算機能
- PWA対応でスマホのホーム画面に追加可能

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | Next.js 14 (App Router) |
| スタイリング | Tailwind CSS + shadcn/ui |
| アニメーション | Framer Motion |
| データベース | Supabase (PostgreSQL) |
| ホスティング | Vercel |
| PWA | @ducanh2912/next-pwa |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの作成

1. https://supabase.com にアクセスしてプロジェクト作成
2. SQL Editorで以下を実行:
   - `supabase/schema.sql`
   - `supabase/seed.sql`

### 3. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集してSupabaseの認証情報を設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

## Vercelへのデプロイ

1. GitHubリポジトリをVercelにインポート
2. 環境変数を設定（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
3. デプロイ

## プロジェクト構成

```
src/
├── app/                    # ページ
│   ├── page.tsx           # 記録入力（メイン）
│   ├── transactions/      # 取引一覧
│   ├── reports/           # レポート
│   ├── settlements/       # 精算管理
│   └── settings/          # 設定
├── components/
│   ├── layout/            # レイアウト（ボトムナビ等）
│   ├── transaction/       # 取引関連コンポーネント
│   └── ui/                # shadcn/uiコンポーネント
├── lib/
│   └── supabase.ts        # Supabase接続
└── types/
    └── database.ts        # 型定義

supabase/
├── schema.sql             # DBスキーマ
└── seed.sql               # 初期データ
```

## ライセンス

MIT

# Money Tracker 開発計画

## プロジェクト方針

### コスト方針（重要）

**本プロジェクトは無料で運用することを最優先とする。**

以下のサービスの無料枠内で運用し、コストが発生するような選択は避ける：

| サービス | プラン | 制限 |
|---------|--------|------|
| Vercel | Hobby（無料） | 100GB帯域/月、商用利用不可 |
| Supabase | Free | 500MB DB、1GB ストレージ、7日間非アクティブでpause |
| GitHub | Free | 無制限パブリックリポジトリ |

**禁止事項：**
- 有料プランへのアップグレード
- 有料のサードパーティサービスの導入
- 有料のAPIやSDKの使用

**注意事項：**
- Supabaseの7日間pause対策として、必要であれば週1でpingするcronジョブを設定可能（GitHub Actions無料枠内）
- 本番環境で商用利用が必要になった場合は、その時点で再検討

---

## 概要

スマホで日々の支払いを記録し、PL/BS/CFの観点で家計を管理するPWAアプリ

## 要件

### 機能要件

1. **支出記録**
   - スマホでサッと入力できるUI
   - 1つの支払いを複数カテゴリ/立替に按分可能
   - 日付、説明、口座、カテゴリを記録

2. **レポート**
   - PL（損益計算書）: 月次の収入・支出・収支
   - BS（貸借対照表）: 資産・負債・純資産の状況
   - CF（キャッシュフロー）: お金の流れ

3. **立替管理**
   - 個人支出と共同支出（彼女との共同カード）を分離
   - 誰にいくら立替しているかを追跡
   - 精算記録機能

4. **マスタ管理**
   - 口座（銀行、カード、現金、PayPay等）
   - カテゴリ（食費、交通費、住居費等）

### 非機能要件

- モバイルファースト（スマホ操作を最優先）
- PWA対応（ホーム画面に追加可能）
- オフライン対応（将来的に検討）
- ダークテーマベース

---

## 技術スタック

| 役割 | 技術 | 選定理由 |
|------|------|----------|
| フロントエンド | Next.js 14 (App Router) | Vercelと相性◎、SSR/SSG対応 |
| スタイリング | Tailwind CSS + shadcn/ui | 高速開発、モダンなデザイン |
| アニメーション | Framer Motion | 宣言的なアニメーション |
| データベース | Supabase (PostgreSQL) | 無料枠が generous、リアルタイム対応 |
| ホスティング | Vercel | Next.jsと最適統合、無料 |
| PWA | @ducanh2912/next-pwa | Next.js App Router対応 |

---

## データベース設計

### accounts（口座・財布）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| name | TEXT | 口座名（楽天銀行、PayPay等） |
| type | TEXT | 種別（bank/cash/card/investment/points） |
| owner | TEXT | 所有者（self/shared） |
| initial_balance | INTEGER | 初期残高（円） |
| is_active | BOOLEAN | 有効フラグ |

### categories（カテゴリ）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| name | TEXT | カテゴリ名 |
| type | TEXT | 種別（income/expense/transfer） |
| is_active | BOOLEAN | 有効フラグ |

### transactions（取引ヘッダ）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| date | DATE | 取引日 |
| description | TEXT | 説明 |
| account_id | UUID | 口座ID |
| total_amount | INTEGER | 合計金額（円） |

### transaction_lines（取引明細）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| transaction_id | UUID | 取引ID |
| amount | INTEGER | 金額（円） |
| category_id | UUID | カテゴリID |
| line_type | TEXT | 種別（income/expense/asset/liability） |
| counterparty | TEXT | 立替先（彼女、友人名等） |
| is_settled | BOOLEAN | 精算済みフラグ |

### settlements（精算記録）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| date | DATE | 精算日 |
| counterparty | TEXT | 相手 |
| amount | INTEGER | 金額（円） |
| note | TEXT | メモ |

---

## 実装フェーズ

### Phase 1: 基盤構築 ✅ 完了
- [x] Next.js プロジェクト作成
- [x] Tailwind CSS + shadcn/ui 設定
- [x] PWA設定
- [x] デザインシステム構築
- [x] Supabase接続設定・型定義
- [x] データベーススキーマ作成

### Phase 2: 基本機能 🔄 進行中
- [x] ボトムナビゲーション
- [x] 記録入力画面（UI）
- [ ] Supabase接続・データ保存
- [ ] 取引一覧画面
- [ ] 取引編集・削除

### Phase 3: レポート機能
- [ ] PL画面（月次収支）
- [ ] BS画面（資産・負債・純資産）
- [ ] CF画面（キャッシュフロー）
- [ ] 月選択・期間フィルター

### Phase 4: 精算機能
- [ ] 立替残高一覧
- [ ] 精算登録
- [ ] 精算履歴

### Phase 5: 設定・その他
- [ ] カテゴリ管理
- [ ] 口座管理
- [ ] データエクスポート

---

## 画面構成

```
/                 → 記録入力（メイン画面）
/transactions     → 取引一覧
/transactions/[id]→ 取引詳細・編集
/reports          → レポートトップ
/reports/pl       → 損益計算書
/reports/bs       → 貸借対照表
/reports/cf       → キャッシュフロー
/settlements      → 立替・精算管理
/settings         → 設定
/settings/accounts    → 口座管理
/settings/categories  → カテゴリ管理
```

---

## デザイン方針

### カラーパレット
- **背景**: ダークテーマベース（#0a0a0a）
- **アクセント（収入）**: ミントグリーン（#10b981）
- **アクセント（支出）**: コーラルレッド（#f43f5e）
- **サーフェス**: グラスモーフィズム風半透明

### タイポグラフィ
- **見出し**: Space Grotesk（ジオメトリック体）
- **本文**: Inter
- **数字**: Tabular Lining（等幅）

### インタラクション
- 入力時のマイクロアニメーション
- リストのスタガードアニメーション
- スワイプ操作対応

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2024-12-25 | Phase 1 完了、初期リリース |

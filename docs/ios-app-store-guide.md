# iOS App Store 公開ガイド

Money Tracker を App Store に公開するための手順書。

## 前提条件

- macOS + Xcode（最新版推奨）
- Apple Developer Program 登録（$99/年）
- Apple ID

## 1. Capacitor プロジェクトのセットアップ（完了済み）

```bash
# iOS プラットフォームを追加
npx cap add ios

# 同期
npx cap sync ios

# Xcode を開く
npx cap open ios
```

## 2. Apple Developer Program 登録

1. https://developer.apple.com/programs/ にアクセス
2. 「Enroll」をクリック
3. Apple ID でサインイン
4. 年額 $99 を支払い
5. 登録完了まで最大48時間待つ

## 3. Xcode での設定

### 3.1 署名設定

1. Xcode で `ios/App/App.xcworkspace` を開く
2. 左サイドバーで「App」プロジェクトを選択
3. 「Signing & Capabilities」タブを選択
4. 「Team」で Apple Developer アカウントを選択
5. 「Bundle Identifier」が `com.moneytracker.app` であることを確認

### 3.2 アプリ情報設定

1. 「General」タブを選択
2. 以下を設定：
   - Display Name: `Money Tracker`
   - Bundle Identifier: `com.moneytracker.app`
   - Version: `1.0.0`
   - Build: `1`

### 3.3 アイコン確認

アイコンは自動で設定済み：
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## 4. App Store Connect でアプリ作成

1. https://appstoreconnect.apple.com にアクセス
2. 「マイApp」→「＋」→「新規App」
3. 以下を入力：

| 項目 | 値 |
|------|-----|
| プラットフォーム | iOS |
| 名前 | Money Tracker |
| プライマリ言語 | 日本語 |
| バンドルID | com.moneytracker.app |
| SKU | moneytracker001 |
| ユーザーアクセス | フルアクセス |

## 5. App Store 掲載情報の入力

### 5.1 スクリーンショット

以下のデバイスサイズが必須：

| デバイス | サイズ | 必須 |
|---------|--------|------|
| iPhone 15 Pro Max | 1290 x 2796 px | ✅ |
| iPhone 8 Plus | 1242 x 2208 px | ✅ |
| iPad Pro 12.9" | 2048 x 2732 px | iPadサポート時 |

**撮影方法：**
```bash
# Xcode シミュレーターで撮影
# Simulator → File → Save Screen (⌘S)
```

### 5.2 アプリ説明文

```
Money Tracker - シンプルで強力な家計簿アプリ

【特徴】
• PL（損益計算書）で収支を可視化
• BS（貸借対照表）で資産・負債を管理
• CF（キャッシュフロー）で現金の流れを把握
• パートナーとの共有機能
• 定期取引の自動登録
• クイック入力でサッと記録

【こんな方におすすめ】
• 家計を本格的に管理したい
• 夫婦・カップルでお金を共有したい
• 複式簿記の考え方で管理したい
```

### 5.3 キーワード

```
家計簿,お金,管理,PL,BS,CF,資産,負債,収支,共有,カップル
```

### 5.4 プライバシーポリシー URL

```
https://money-tracker-six-eta.vercel.app/terms
```

### 5.5 年齢レーティング

- すべて「いいえ」を選択
- 結果: 4+

## 6. ビルド・アップロード

### 6.1 アーカイブ作成

1. Xcode で対象デバイスを「Any iOS Device」に変更
2. Product → Archive
3. ビルド完了を待つ

### 6.2 App Store にアップロード

1. Archives ウィンドウが開く
2. 「Distribute App」をクリック
3. 「App Store Connect」を選択
4. 「Upload」を選択
5. オプションはデフォルトのまま
6. 「Upload」をクリック

### 6.3 アップロード確認

- 処理完了まで15-30分
- App Store Connect のメールを確認
- 「TestFlight」タブでビルドを確認

## 7. 審査申請

### 7.1 ビルドの選択

1. App Store Connect → 該当アプリ
2. 「App Store」タブ → バージョン情報
3. 「ビルド」セクションで「＋」をクリック
4. アップロードしたビルドを選択

### 7.2 審査情報の入力

**App Review 情報：**
- サインイン情報: （テストアカウントを作成して入力）
- 連絡先情報: 自分の連絡先

### 7.3 提出

1. すべての情報を入力
2. 「審査へ提出」をクリック

## 8. 審査プロセス

| ステージ | 通常期間 |
|---------|---------|
| Waiting for Review | 数時間〜1日 |
| In Review | 数時間〜2日 |
| 結果通知 | - |

### よくあるリジェクト理由

1. **クラッシュ** - 十分にテストする
2. **不完全な機能** - すべての機能が動作すること
3. **プライバシーポリシー不備** - URL が有効であること
4. **スクリーンショット不一致** - 実際のアプリと一致すること

## 9. アプリ更新時

Web アプリ (Vercel) を更新するだけで、アプリの内容は自動更新されます。
App Store の再審査は不要です。

ただし、以下の場合は再審査が必要：
- アプリ名の変更
- アイコンの変更
- 説明文の大幅な変更
- ネイティブ機能の追加

## コマンドまとめ

```bash
# iOS 同期
npx cap sync ios

# Xcode を開く
npx cap open ios

# アイコン再生成
npx tsx scripts/generate-icons.ts
```

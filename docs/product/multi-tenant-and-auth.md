# マルチテナント化と認証設計

> 作成日: 2024-12-31
> 目的: Supabase Authを使った認証とマルチテナント化の設計

## 1. 認証方式の比較

### 1.1 利用可能な認証方式

| 方式 | メリット | デメリット | 推奨度 |
|------|---------|-----------|--------|
| **メール + パスワード** | シンプル、馴染みがある | パスワード管理が必要 | ★★★★☆ |
| **Magic Link** | パスワード不要、セキュア | メール到着待ちが必要 | ★★★★★ |
| **OAuth (Google)** | ワンクリック、パスワード不要 | Google依存 | ★★★★☆ |
| **OAuth (Apple)** | iOS必須（Apple要件） | 実装が複雑 | ★★★☆☆ |
| **SMS OTP** | 電話番号で認証 | コストがかかる | ★★☆☆☆ |

### 1.2 推奨構成

**MVP段階**: Magic Link + メールパスワード
- Magic Link: メイン（パスワード不要で離脱率低下）
- メールパスワード: バックアップ（Magic Linkに抵抗がある人向け）

**β公開以降**: Google OAuth追加
- ワンクリックログインで利便性向上

### 1.3 Supabase Auth 設定

Supabase Dashboard → Authentication → Providers で有効化:

```
[x] Email (Magic Link & Password)
[ ] Phone (SMS OTP) - オプション
[x] Google OAuth - β以降
[ ] Apple OAuth - iOS App リリース時
```

## 2. 認証フロー設計

### 2.1 ユーザーフロー

```
┌─────────────────────────────────────────────────────────┐
│  Landing Page (未実装 - 要作成)                          │
│  ┌─────────────┐    ┌─────────────┐                    │
│  │ ログイン    │    │ 新規登録    │                    │
│  └─────┬───────┘    └─────┬───────┘                    │
└────────┼──────────────────┼────────────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│  /login (要作成)                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ メールアドレス: [________________]                │  │
│  │                                                   │  │
│  │ [Magic Linkで続ける] ← 推奨                       │  │
│  │ [パスワードでログイン]                            │  │
│  │ [Googleでログイン] ← β以降                        │  │
│  │                                                   │  │
│  │ アカウントをお持ちでない方は [登録]              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │
         ▼ Magic Link送信
┌─────────────────────────────────────────────────────────┐
│  メール確認画面                                          │
│  「メールを送信しました。リンクをクリックしてください」   │
└─────────────────────────────────────────────────────────┘
         │
         ▼ メール内リンクをクリック
┌─────────────────────────────────────────────────────────┐
│  /auth/callback (要作成)                                 │
│  - セッション確立                                        │
│  - 初回ユーザーなら初期データ作成                        │
│  - ホーム画面へリダイレクト                              │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  / (ホーム画面 - 既存)                                   │
│  ✓ 認証済みユーザーのみアクセス可能                      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 新規登録フロー

```
1. /signup でメールアドレス入力
2. Supabase が確認メール送信
3. ユーザーがリンクをクリック
4. /auth/callback でセッション確立
5. 初回ログイン検出 → 初期データ作成
   - デフォルト口座（現金、銀行口座など）
   - デフォルトカテゴリ（共有カテゴリをコピー or 紐付け）
6. ホーム画面へリダイレクト
```

## 3. ルート保護（Middleware）

### 3.1 Next.js Middleware

**ファイル**: `src/middleware.ts` (新規作成)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未認証ユーザーを /login にリダイレクト
  if (!user && !request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/signup") &&
      !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 認証済みユーザーが /login にアクセスしたらホームへ
  if (user && (request.nextUrl.pathname.startsWith("/login") ||
               request.nextUrl.pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除く全ルートにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico, icons, manifest (PWA)
     * - api (将来のAPIルート)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api).*)",
  ],
};
```

### 3.2 ルート構成

| パス | アクセス | 説明 |
|------|---------|------|
| `/login` | 未認証のみ | ログイン画面 |
| `/signup` | 未認証のみ | 新規登録画面 |
| `/auth/callback` | 全員 | OAuth/Magic Link コールバック |
| `/` | 認証済みのみ | ホーム（取引登録） |
| `/transactions/*` | 認証済みのみ | 取引一覧・詳細 |
| `/reports/*` | 認証済みのみ | レポート |
| `/settings/*` | 認証済みのみ | 設定 |
| その他全て | 認証済みのみ | - |

## 4. セッション管理

### 4.1 アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  ブラウザ                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Supabase Client (supabase-js)                  │   │
│  │  - セッショントークンを localStorage に保存      │   │
│  │  - 自動リフレッシュ (autoRefreshToken: true)     │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Cookie (httpOnly)                               │   │
│  │  - SSR/Middleware でセッション確認用            │   │
│  │  - @supabase/ssr で自動管理                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Server                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Middleware                                      │   │
│  │  - Cookie からセッション読み取り                 │   │
│  │  - 認証チェック & リダイレクト                   │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Server Components (オプション)                  │   │
│  │  - セッション情報をpropsで渡す                   │   │
│  │  - サーバーサイドでデータ取得                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 クライアントサイド実装

**ファイル**: `src/lib/supabase/client.ts` (新規)

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 4.3 サーバーサイド実装

**ファイル**: `src/lib/supabase/server.ts` (新規)

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
```

### 4.4 トークン更新

| 責務 | 実装場所 | 方法 |
|------|---------|------|
| アクセストークン更新 | クライアント | `autoRefreshToken: true` で自動 |
| リフレッシュトークン | Supabase | サーバー側で管理 |
| セッション永続化 | クライアント | `persistSession: true` で localStorage |
| Cookieとの同期 | @supabase/ssr | 自動（onAuthStateChange） |

### 4.5 ログアウト

```typescript
// ログアウト処理
async function handleLogout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  // Cookieもクリアされる
  router.push("/login");
}
```

## 5. 認証コンテキスト

### 5.1 AuthProvider

**ファイル**: `src/components/providers/AuthProvider.tsx` (新規)

```typescript
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // 初期セッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // セッション変更監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 5.2 レイアウトへの組み込み

**ファイル**: `src/app/layout.tsx` (更新)

```typescript
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 5.3 コンポーネントでの使用

```typescript
"use client";
import { useAuth } from "@/components/providers/AuthProvider";

export function Header() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <header>
      {user ? (
        <span>{user.email}</span>
      ) : (
        <Link href="/login">ログイン</Link>
      )}
    </header>
  );
}
```

## 6. 認証画面の実装

### 6.1 ログイン画面

**ファイル**: `src/app/login/page.tsx` (新規)

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("メールを送信しました。リンクをクリックしてください。");
    }
    setLoading(false);
  };

  const handlePassword = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
    }
    // 成功時は middleware がリダイレクト
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">ログイン</h1>

        <Input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {mode === "password" && (
          <Input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {mode === "magic" ? (
          <>
            <Button onClick={handleMagicLink} disabled={loading} className="w-full">
              Magic Linkで続ける
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode("password")}
              className="w-full"
            >
              パスワードでログイン
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handlePassword} disabled={loading} className="w-full">
              ログイン
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode("magic")}
              className="w-full"
            >
              Magic Linkで続ける
            </Button>
          </>
        )}

        <p className="text-center text-sm">
          アカウントをお持ちでない方は{" "}
          <a href="/signup" className="text-primary underline">
            登録
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 6.2 コールバック処理

**ファイル**: `src/app/auth/callback/route.ts` (新規)

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 初回ユーザーかチェックして初期データ作成
      // (別途実装)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // エラー時はログインページへ
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

## 7. 既存データの移行方針

### 7.1 移行シナリオ

現在のデータは開発者（あなた）のものなので:

1. 最初のユーザー登録を自分で行う
2. そのuser_idを取得
3. 全既存データにそのuser_idを設定

### 7.2 移行スクリプト

```sql
-- ========================================
-- Migration: Assign existing data to first user
-- ⚠️ 自分のuser_idに置き換えて実行
-- ========================================

-- あなたのuser_id (Supabase Dashboard → Authentication → Users で確認)
DO $$
DECLARE
  my_user_id UUID := 'YOUR-USER-ID-HERE';  -- ← 置き換え
BEGIN
  -- 全テーブルのuser_idを更新
  UPDATE accounts SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE categories SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE counterparties SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE transactions SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE settlements SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE recurring_transactions SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE quick_entries SET user_id = my_user_id WHERE user_id IS NULL;
  UPDATE budgets SET user_id = my_user_id WHERE user_id IS NULL;

  RAISE NOTICE 'Migration completed for user: %', my_user_id;
END $$;
```

### 7.3 移行手順

1. ローカル環境でテスト
2. バックアップを取得: `supabase db dump -f backup.sql`
3. マイグレーション適用
4. 動作確認
5. 本番環境に適用

## 8. 初回ユーザー向け初期データ

### 8.1 初期化トリガー

**オプション A: クライアントサイドで初期化**

```typescript
// /auth/callback で呼び出し
async function initializeNewUser(userId: string) {
  const supabase = createClient();

  // 既にデータがあるかチェック
  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count === 0) {
    // 初期口座を作成
    await supabase.from("accounts").insert([
      { user_id: userId, name: "現金", type: "cash" },
      { user_id: userId, name: "銀行口座", type: "bank" },
    ]);
  }
}
```

**オプション B: PostgreSQL トリガー（推奨）**

```sql
-- 新規ユーザー登録時に自動で初期データ作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- デフォルト口座
  INSERT INTO public.accounts (user_id, name, type)
  VALUES
    (NEW.id, '現金', 'cash'),
    (NEW.id, '銀行口座', 'bank'),
    (NEW.id, 'クレジットカード', 'card');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users への INSERT トリガー
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 8.2 共有カテゴリの扱い

- システムカテゴリ（`user_id = NULL`）は全ユーザーで共有
- ユーザーは自分専用のカテゴリも作成可能
- カテゴリ一覧取得時は両方を取得

```typescript
const { data } = await supabase
  .from("categories")
  .select("*")
  .or(`user_id.eq.${userId},user_id.is.null`)
  .order("name");
```

## 9. セキュリティチェックリスト

### 9.1 認証

- [ ] Supabase Auth が有効
- [ ] Magic Link が設定済み
- [ ] メール確認が必須
- [ ] パスワード要件が適切（最低8文字など）

### 9.2 ルート保護

- [ ] middleware.ts が存在し機能している
- [ ] 全保護ルートで認証チェック
- [ ] ログイン・登録ページは未認証者のみ

### 9.3 セッション

- [ ] httpOnly Cookie を使用
- [ ] 自動トークンリフレッシュが有効
- [ ] ログアウト時にセッション完全クリア

### 9.4 データアクセス

- [ ] 全 INSERT に user_id を含める
- [ ] RLS ポリシーが有効
- [ ] 他ユーザーのデータにアクセス不可を確認

## 10. 追加パッケージ

```bash
npm install @supabase/ssr
```

`package.json` への追加:
```json
{
  "dependencies": {
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.89.0"
  }
}
```

## 11. 環境変数

**更新不要** - 既存の環境変数で動作:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 12. 次のステップ

1. `@supabase/ssr` パッケージをインストール
2. `src/middleware.ts` を作成
3. `src/lib/supabase/client.ts` と `server.ts` を作成
4. `src/components/providers/AuthProvider.tsx` を作成
5. `src/app/login/page.tsx` と `/signup/page.tsx` を作成
6. `src/app/auth/callback/route.ts` を作成
7. `src/app/layout.tsx` に AuthProvider を追加
8. 既存の `src/lib/supabase.ts` を新しいクライアントに移行

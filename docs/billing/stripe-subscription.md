# Stripe サブスクリプション導入計画

> 作成日: 2024-12-31
> 目的: 課金機能の設計と実装手順

## 1. 料金プラン設計

### 1.1 最小構成（MVP）

| プラン | 月額 | 年額 | 機能 |
|--------|------|------|------|
| **Free** | ¥0 | ¥0 | 基本機能（制限あり） |
| **Pro** | ¥500 | ¥5,000 | 全機能（制限なし） |

### 1.2 機能制限

| 機能 | Free | Pro |
|------|------|-----|
| 取引登録 | 月50件まで | 無制限 |
| 口座数 | 3口座まで | 無制限 |
| レポート期間 | 過去12ヶ月 | 全期間 |
| 定期取引 | 3件まで | 無制限 |
| クイック入力 | 3件まで | 無制限 |
| 予算管理 | 3カテゴリまで | 無制限 |
| **パートナー共有** | ❌ | ✅（1名まで） |
| CSVエクスポート | ✅ | ✅ |
| Excelエクスポート | ❌ | ✅ |

### 1.3 パートナー共有機能（Pro限定）

Proユーザーはパートナー1名を招待し、同じ家計データを共有できます。

**できること**:
- 同じ取引データの閲覧・登録・編集
- 共有口座の管理
- レポートの共有閲覧
- それぞれのデバイスからアクセス

**仕組み**:
```
┌─────────────────────────────────────────────────────────┐
│ Household（家計グループ）                                │
│                                                         │
│  ┌─────────────┐         ┌─────────────┐              │
│  │ Owner (Pro) │ ──────→ │ Partner     │              │
│  │ 小笠原      │  招待    │ あさみ       │              │
│  └─────────────┘         └─────────────┘              │
│         │                       │                      │
│         └───────────┬───────────┘                      │
│                     ▼                                   │
│              ┌─────────────┐                           │
│              │ 共有データ   │                           │
│              │ - 取引       │                           │
│              │ - 口座       │                           │
│              │ - カテゴリ   │                           │
│              └─────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

**注意点**:
- Proを解約すると共有は解除される（パートナーはアクセス不可に）
- パートナーは無料で利用可能（Proユーザーの枠内）
- オーナーのみがパートナーを招待/削除可能

### 1.4 将来の拡張案

| プラン | 月額 | 対象 |
|--------|------|------|
| **Team** | ¥1,500 | 家族・カップル向け（2-5名） |
| **Business** | ¥3,000 | 個人事業主・フリーランス |

## 2. Stripe 設定

### 2.1 Stripe Dashboard での設定

1. **Products 作成**
   - Product: "Money Tracker Pro"
   - Prices:
     - Monthly: ¥500/月 (price_xxx_monthly)
     - Yearly: ¥5,000/年 (price_xxx_yearly)

2. **Customer Portal 設定**
   - Settings → Billing → Customer portal
   - 解約・プラン変更を許可

3. **Webhook 設定**
   - Endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

### 2.2 環境変数

```bash
# .env.local に追加
STRIPE_SECRET_KEY=sk_live_xxx  # 本番用
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# テスト環境用
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## 3. データベース設計

### 3.1 subscriptions テーブル

```sql
-- サブスクリプション管理テーブル
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'free',  -- 'free', 'active', 'canceled', 'past_due'
  plan TEXT NOT NULL DEFAULT 'free',    -- 'free', 'pro'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- インデックス
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLSポリシー
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERTはサーバーサイド（service_role）のみ
-- UPDATEもサーバーサイドのみ
```

### 3.2 households テーブル（パートナー共有用）

```sql
-- 家計グループ（1つのProアカウントにつき1つ）
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '我が家の家計',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id)  -- 1ユーザー1グループのみ
);

-- 家計グループのメンバー
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'removed'
  UNIQUE(household_id, user_id)
);

-- インデックス
CREATE INDEX idx_households_owner ON households(owner_id);
CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);

-- RLSポリシー
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- households: オーナーまたはアクティブメンバーが閲覧可能
CREATE POLICY "Household visible to members"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = households.id
      AND household_members.user_id = auth.uid()
      AND household_members.status = 'active'
    )
  );

-- households: オーナーのみ作成・更新・削除可能
CREATE POLICY "Owner can manage household"
  ON households FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- household_members: メンバーは自分の参加情報を閲覧可能
CREATE POLICY "Members can view membership"
  ON household_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM households
      WHERE households.id = household_members.household_id
      AND households.owner_id = auth.uid()
    )
  );
```

### 3.3 データアクセスの変更（household対応）

パートナー共有を実現するため、既存テーブルのRLSポリシーを拡張します。

```sql
-- 例: transactions テーブル
-- 従来: auth.uid() = user_id のみ
-- 変更後: 自分のデータ OR 同じhouseholdのデータ

CREATE OR REPLACE FUNCTION get_household_id(uid UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    -- オーナーとして所有するhousehold
    (SELECT id FROM households WHERE owner_id = uid),
    -- メンバーとして参加しているhousehold
    (SELECT household_id FROM household_members
     WHERE user_id = uid AND status = 'active')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- transactions の新しいRLSポリシー
CREATE POLICY "Users can access own or household transactions"
  ON transactions FOR ALL
  USING (
    -- 自分のデータ
    user_id = auth.uid()
    -- または同じhouseholdのデータ（Proのみ）
    OR (
      get_household_id(auth.uid()) IS NOT NULL
      AND get_household_id(user_id) = get_household_id(auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      get_household_id(auth.uid()) IS NOT NULL
      AND get_household_id(user_id) = get_household_id(auth.uid())
    )
  );
```

### 3.4 新規ユーザー時の初期化

```sql
-- 新規ユーザー登録時にFreeプランのsubscription作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 既存の初期化処理...

  -- subscription レコード作成
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'free', 'free');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 4. API 実装

### 4.1 Checkout Session 作成

**ファイル**: `src/app/api/stripe/checkout/route.ts`

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await request.json();

    // 既存のStripe Customerを取得または作成
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // Customer IDを保存
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Checkout Session 作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get("origin")}/settings/billing?success=true`,
      cancel_url: `${request.headers.get("origin")}/settings/billing?canceled=true`,
      metadata: { user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

### 4.2 Customer Portal

**ファイル**: `src/app/api/stripe/portal/route.ts`

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${request.headers.get("origin")}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
```

### 4.3 Webhook ハンドラー

**ファイル**: `src/app/api/webhooks/stripe/route.ts`

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

// service_role を使用（RLSバイパス）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // CustomerのmetadataからユーザーIDを取得
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error("No user_id in customer metadata");
    return;
  }

  const status = subscription.status === "active" ? "active" : subscription.status;
  const plan = subscription.status === "active" ? "pro" : "free";

  await supabaseAdmin
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status,
      plan,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "free",
      plan: "free",
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // TODO: メール通知など
}
```

## 5. Pro判定の実装

### 5.1 サブスクリプション状態の取得

**ファイル**: `src/lib/subscription.ts`

```typescript
import { createClient } from "@/lib/supabase/client";

export type SubscriptionPlan = "free" | "pro";

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { plan: "free", isActive: false, cancelAtPeriodEnd: false, periodEnd: null };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!subscription) {
    return { plan: "free", isActive: false, cancelAtPeriodEnd: false, periodEnd: null };
  }

  return {
    plan: subscription.plan as SubscriptionPlan,
    isActive: subscription.status === "active",
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    periodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null,
  };
}

export function isPro(status: SubscriptionStatus): boolean {
  return status.plan === "pro" && status.isActive;
}
```

### 5.2 React Hook

**ファイル**: `src/hooks/useSubscription.ts`

```typescript
"use client";

import { useEffect, useState } from "react";
import { getSubscriptionStatus, type SubscriptionStatus, isPro } from "@/lib/subscription";

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubscriptionStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  return {
    status,
    loading,
    isPro: status ? isPro(status) : false,
    isFree: status ? status.plan === "free" : true,
  };
}
```

### 5.3 UI での使用例

```typescript
"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export function BudgetSection() {
  const { isPro, loading } = useSubscription();

  if (loading) return <div>Loading...</div>;

  if (!isPro) {
    return (
      <div className="p-4 bg-muted rounded-lg text-center">
        <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          予算管理はProプランの機能です
        </p>
        <Button asChild size="sm">
          <a href="/settings/billing">アップグレード</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Pro機能のUI */}
    </div>
  );
}
```

### 5.4 機能制限の実装

```typescript
// 取引登録時の制限チェック
async function checkTransactionLimit(userId: string): Promise<boolean> {
  const supabase = createClient();

  // サブスクリプション確認
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .single();

  if (sub?.plan === "pro") return true;  // Pro は無制限

  // Free は月50件まで
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  return (count ?? 0) < 50;
}
```

## 6. 課金画面

**ファイル**: `src/app/settings/billing/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const PRICE_IDS = {
  monthly: "price_xxx_monthly",  // Stripeで作成したID
  yearly: "price_xxx_yearly",
};

export default function BillingPage() {
  const { status, loading, isPro } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (priceId: string) => {
    setIsLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const { url } = await res.json();
    window.location.href = url;
  };

  const handleManage = async () => {
    setIsLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    window.location.href = url;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">プラン設定</h1>

      {/* 現在のプラン表示 */}
      <div className="p-4 bg-card rounded-lg border">
        <p className="text-sm text-muted-foreground">現在のプラン</p>
        <p className="text-xl font-bold">
          {isPro ? "Pro" : "Free"}
        </p>
        {status?.periodEnd && (
          <p className="text-sm text-muted-foreground">
            {status.cancelAtPeriodEnd
              ? `${status.periodEnd.toLocaleDateString()} に終了予定`
              : `次回更新: ${status.periodEnd.toLocaleDateString()}`}
          </p>
        )}
      </div>

      {isPro ? (
        <Button onClick={handleManage} disabled={isLoading}>
          プランを管理
        </Button>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Monthly */}
          <div className="p-6 bg-card rounded-lg border space-y-4">
            <h3 className="font-bold">Pro 月額</h3>
            <p className="text-3xl font-bold">¥500<span className="text-sm">/月</span></p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 取引無制限</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 予算管理</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> CSVエクスポート</li>
            </ul>
            <Button
              onClick={() => handleUpgrade(PRICE_IDS.monthly)}
              disabled={isLoading}
              className="w-full"
            >
              月額プランを開始
            </Button>
          </div>

          {/* Yearly */}
          <div className="p-6 bg-card rounded-lg border border-primary space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Pro 年額</h3>
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">2ヶ月分お得</span>
            </div>
            <p className="text-3xl font-bold">¥5,000<span className="text-sm">/年</span></p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 全機能利用可能</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> 優先サポート</li>
            </ul>
            <Button
              onClick={() => handleUpgrade(PRICE_IDS.yearly)}
              disabled={isLoading}
              className="w-full"
            >
              年額プランを開始
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 7. 乱用防止

### 7.1 レートリミット

**ファイル**: `src/middleware.ts` に追加

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),  // 1分間に100リクエスト
});

// middleware 内で
const { success, limit, reset, remaining } = await ratelimit.limit(
  user?.id ?? request.ip ?? "anonymous"
);

if (!success) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "X-RateLimit-Limit": limit.toString() } }
  );
}
```

### 7.2 上限チェック（Free プラン）

```typescript
// 各操作前にチェック
const limits = {
  transactions_per_month: 50,
  accounts: 3,
  recurring_transactions: 3,
  quick_entries: 3,
};

async function checkLimit(
  table: keyof typeof limits,
  userId: string,
  plan: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  if (plan === "pro") {
    return { allowed: true, current: 0, limit: Infinity };
  }

  const supabase = createClient();
  const limit = limits[table];

  let count = 0;
  if (table === "transactions_per_month") {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { count: c } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());
    count = c ?? 0;
  } else {
    const { count: c } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    count = c ?? 0;
  }

  return { allowed: count < limit, current: count, limit };
}
```

### 7.3 監査ログ

```sql
-- 監査ログテーブル
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'transaction.create', 'subscription.upgrade', etc.
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS: 読み取りのみ許可
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);
```

```typescript
// 監査ログ記録
async function logAudit(
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createClient();
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
}

// 使用例
await logAudit(user.id, "transaction.create", "transactions", tx.id, { amount: 1000 });
await logAudit(user.id, "subscription.upgrade", "subscriptions", null, { plan: "pro" });
```

## 8. 追加パッケージ

```bash
npm install stripe @upstash/ratelimit @upstash/redis
```

## 9. 環境変数まとめ

```bash
# .env.local

# Supabase (既存)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx  # 追加（Webhook用）

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Upstash Redis (レートリミット用)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

## 10. テストチェックリスト

- [ ] Stripe テストモードで Checkout 動作確認
- [ ] Webhook が正しく DB を更新
- [ ] 解約フローの動作確認
- [ ] Free → Pro アップグレード
- [ ] Pro → Free ダウングレード（期間終了時）
- [ ] 支払い失敗時の挙動
- [ ] レートリミットの動作
- [ ] 機能制限の動作

## 11. 注意事項

### 11.1 本番移行時

1. Stripe テストキー → 本番キーに変更
2. Webhook エンドポイントを本番URLに更新
3. `SUPABASE_SERVICE_ROLE_KEY` は絶対にフロントに公開しない

### 11.2 法的要件

- 特定商取引法に基づく表記
- プライバシーポリシー
- 利用規約
- 解約・返金ポリシー

## 12. 次のステップ

1. Stripe アカウント作成・設定
2. `subscriptions` テーブル作成
3. API routes 実装
4. 課金画面作成
5. 機能制限の実装
6. テスト

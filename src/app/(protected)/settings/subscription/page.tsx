"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS } from "@/lib/stripe";

function SubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subscription, isLoading, isPremium, plan, refetch } = useSubscription();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const syncSubscription = async () => {
      if (searchParams.get("success") === "true") {
        // Sync subscription from Stripe (in case webhook is delayed)
        try {
          await fetch("/api/stripe/sync", { method: "POST" });
        } catch (e) {
          console.error("Sync error:", e);
        }
        setMessage({ type: "success", text: "プレミアムプランへのアップグレードありがとうございます！" });
        refetch();
      } else if (searchParams.get("canceled") === "true") {
        setMessage({ type: "error", text: "決済がキャンセルされました" });
      }
    };
    syncSubscription();
  }, [searchParams, refetch]);

  const handleUpgrade = async () => {
    setIsCheckingOut(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage({ type: "error", text: "エラーが発生しました。もう一度お試しください。" });
      setIsCheckingOut(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsManaging(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create portal session");
      }
    } catch (error) {
      console.error("Portal error:", error);
      setMessage({ type: "error", text: "エラーが発生しました。もう一度お試しください。" });
      setIsManaging(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold">プラン</h1>
            <p className="text-xs text-muted-foreground">
              プランの確認・変更
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 text-green-600"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {message.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{message.text}</span>
          </motion.div>
        )}

        {/* Current Plan */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">現在のプラン</p>
              <div className="flex items-center gap-2 mt-1">
                {isPremium && <Crown className="w-5 h-5 text-yellow-500" />}
                <span className="font-bold text-lg">
                  {isPremium ? "プレミアム" : "無料プラン"}
                </span>
              </div>
            </div>
            {isPremium && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">次回更新日</p>
                <p className="font-medium">
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("ja-JP")
                    : "-"}
                </p>
              </div>
            )}
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="bg-yellow-500/10 text-yellow-600 text-sm p-3 rounded-lg">
              期間終了後に解約されます
            </div>
          )}
        </div>

        {/* Plan Comparison */}
        <div className="space-y-4">
          {/* Free Plan */}
          <div
            className={`bg-card rounded-xl p-5 border-2 transition-colors ${
              !isPremium ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">{PLANS.free.name}</h3>
                <p className="text-2xl font-bold mt-1">
                  ¥0<span className="text-sm font-normal text-muted-foreground">/月</span>
                </p>
              </div>
              {!isPremium && (
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  現在のプラン
                </span>
              )}
            </div>
            <ul className="space-y-2">
              {PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Plan */}
          <div
            className={`bg-card rounded-xl p-5 border-2 transition-colors ${
              isPremium ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{PLANS.premium.name}</h3>
                  <Crown className="w-4 h-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold mt-1">
                  ¥{PLANS.premium.price}<span className="text-sm font-normal text-muted-foreground">/月</span>
                </p>
              </div>
              {isPremium && (
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  現在のプラン
                </span>
              )}
            </div>
            <ul className="space-y-2 mb-4">
              {PLANS.premium.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            {!isPremium ? (
              <Button
                onClick={handleUpgrade}
                disabled={isCheckingOut}
                className="w-full"
              >
                {isCheckingOut ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                プレミアムにアップグレード
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isManaging}
                className="w-full"
              >
                {isManaging ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                プランを管理
              </Button>
            )}
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground text-center">
          決済はStripeで安全に処理されます
        </p>
      </div>
    </MainLayout>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </MainLayout>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { PLANS, type PlanType } from "@/lib/stripe";

interface Subscription {
  id: string;
  plan: PlanType;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setSubscription(data as Subscription);
    } else if (error && error.code !== "PGRST116") {
      console.error("Error fetching subscription:", error);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isPremium = subscription?.plan === "premium" && subscription?.status === "active";
  const plan = subscription?.plan || "free";
  const planDetails = PLANS[plan];

  const checkLimit = useCallback(
    (feature: keyof typeof PLANS.free.limits, currentCount: number) => {
      const limit = planDetails.limits[feature];
      return currentCount < limit;
    },
    [planDetails]
  );

  return {
    subscription,
    isLoading,
    isPremium,
    plan,
    planDetails,
    checkLimit,
    refetch: fetchSubscription,
  };
}

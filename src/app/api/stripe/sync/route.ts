import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

interface StripeSubscriptionItem {
  current_period_start: number;
  current_period_end: number;
}

interface StripeSubscriptionData {
  id: string;
  cancel_at_period_end: boolean;
  items: {
    data: StripeSubscriptionItem[];
  };
}

// Sync subscription status from Stripe
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get subscription record
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ synced: false, reason: "No customer ID" });
    }

    // Get subscriptions from Stripe
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: subscription.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (stripeSubscriptions.data.length > 0) {
      const stripeSub = stripeSubscriptions.data[0] as unknown as StripeSubscriptionData;
      const item = stripeSub.items.data[0];

      // Update subscription in database
      await supabase
        .from("subscriptions")
        .update({
          stripe_subscription_id: stripeSub.id,
          plan: "premium",
          status: "active",
          current_period_start: new Date(item.current_period_start * 1000).toISOString(),
          current_period_end: new Date(item.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return NextResponse.json({ synced: true, plan: "premium" });
    }

    return NextResponse.json({ synced: false, reason: "No active subscription" });
  } catch (error) {
    console.error("Stripe sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    );
  }
}

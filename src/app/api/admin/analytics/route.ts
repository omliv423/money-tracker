import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase/admin";

// Admin emails that can access analytics
const ADMIN_EMAILS = ["moneytracker001@gmail.com"];

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const untypedClient = createUntypedAdminClient();

    // Fetch analytics data in parallel
    const [
      usersResult,
      subscriptionsResult,
      transactionsResult,
      recentEventsResult,
      dailyActiveResult,
    ] = await Promise.all([
      // Total users and recent signups (using untyped client for auth schema)
      untypedClient.from("auth.users").select("id, email, created_at").order("created_at", { ascending: false }).limit(100),

      // Subscription breakdown
      adminClient
        .from("subscriptions")
        .select("plan, status")
        .then(({ data }) => {
          const stats = { free: 0, premium: 0, total: 0 };
          data?.forEach((s) => {
            stats.total++;
            if (s.plan === "premium" && s.status === "active") {
              stats.premium++;
            } else {
              stats.free++;
            }
          });
          return stats;
        }),

      // Transaction stats
      adminClient
        .from("transactions")
        .select("id, created_at, total_amount")
        .order("created_at", { ascending: false })
        .limit(1000)
        .then(({ data }) => {
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

          return {
            total: data?.length || 0,
            last7Days: data?.filter((t) => new Date(t.created_at) > sevenDaysAgo).length || 0,
            last30Days: data?.filter((t) => new Date(t.created_at) > thirtyDaysAgo).length || 0,
          };
        }),

      // Recent events
      adminClient
        .from("analytics_events")
        .select("event_name, created_at, user_id, page_path")
        .order("created_at", { ascending: false })
        .limit(50),

      // Daily active users (last 30 days)
      adminClient
        .from("analytics_events")
        .select("user_id, created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .then(({ data }) => {
          const dailyMap = new Map<string, Set<string>>();
          data?.forEach((event) => {
            if (event.user_id) {
              const date = event.created_at.split("T")[0];
              if (!dailyMap.has(date)) {
                dailyMap.set(date, new Set());
              }
              dailyMap.get(date)!.add(event.user_id);
            }
          });
          return Array.from(dailyMap.entries())
            .map(([date, users]) => ({ date, count: users.size }))
            .sort((a, b) => b.date.localeCompare(a.date));
        }),
    ]);

    // Calculate user stats
    const users = usersResult.data || [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const userStats = {
      total: users.length,
      last7Days: users.filter((u) => new Date(u.created_at) > sevenDaysAgo).length,
      last30Days: users.filter((u) => new Date(u.created_at) > thirtyDaysAgo).length,
      recentSignups: users.slice(0, 10).map((u) => ({
        email: u.email,
        createdAt: u.created_at,
      })),
    };

    return NextResponse.json({
      users: userStats,
      subscriptions: subscriptionsResult,
      transactions: transactionsResult,
      recentEvents: recentEventsResult.data || [],
      dailyActiveUsers: dailyActiveResult,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

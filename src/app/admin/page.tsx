"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowLeft,
  RefreshCw,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AnalyticsData {
  users: {
    total: number;
    last7Days: number;
    last30Days: number;
    recentSignups: { email: string; createdAt: string }[];
  };
  subscriptions: {
    free: number;
    premium: number;
    total: number;
  };
  transactions: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  recentEvents: {
    event_name: string;
    created_at: string;
    user_id: string | null;
    page_path: string | null;
  }[];
  dailyActiveUsers: { date: string; count: number }[];
}

const ADMIN_EMAILS = ["moneytracker001@gmail.com"];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        if (res.status === 401) {
          setError("アクセス権限がありません");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
        router.push("/");
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => router.push("/")}>ホームに戻る</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-xl font-bold">管理者ダッシュボード</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            更新
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="総ユーザー数"
            value={data.users.total}
            subtext={`+${data.users.last7Days} (7日)`}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            icon={Crown}
            label="プレミアム"
            value={data.subscriptions.premium}
            subtext={`${Math.round((data.subscriptions.premium / Math.max(data.subscriptions.total, 1)) * 100)}%`}
            color="text-yellow-500"
            bgColor="bg-yellow-500/10"
          />
          <StatCard
            icon={TrendingUp}
            label="総取引数"
            value={data.transactions.total}
            subtext={`+${data.transactions.last7Days} (7日)`}
            color="text-green-500"
            bgColor="bg-green-500/10"
          />
          <StatCard
            icon={Activity}
            label="アクティブ (7日)"
            value={data.dailyActiveUsers.slice(0, 7).reduce((sum, d) => sum + d.count, 0) / 7 | 0}
            subtext="平均 DAU"
            color="text-purple-500"
            bgColor="bg-purple-500/10"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              最近の登録
            </h2>
            <div className="space-y-2">
              {data.users.recentSignups.map((user, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <span className="truncate max-w-[200px]">{user.email}</span>
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(user.createdAt), "M/d HH:mm", { locale: ja })}
                  </span>
                </div>
              ))}
              {data.users.recentSignups.length === 0 && (
                <p className="text-muted-foreground text-sm">データなし</p>
              )}
            </div>
          </div>

          {/* Recent Events */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              最近のイベント
            </h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.recentEvents.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="font-medium">{event.event_name}</span>
                    {event.page_path && (
                      <span className="text-muted-foreground text-xs ml-2">
                        {event.page_path}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(event.created_at), "M/d HH:mm", { locale: ja })}
                  </span>
                </div>
              ))}
              {data.recentEvents.length === 0 && (
                <p className="text-muted-foreground text-sm">データなし</p>
              )}
            </div>
          </div>

          {/* Daily Active Users Chart */}
          <div className="bg-card rounded-xl border border-border p-5 md:col-span-2">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              日別アクティブユーザー (過去30日)
            </h2>
            <div className="flex items-end gap-1 h-32">
              {data.dailyActiveUsers.slice(0, 30).reverse().map((day, i) => {
                const maxCount = Math.max(...data.dailyActiveUsers.map((d) => d.count), 1);
                const height = (day.count / maxCount) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {day.date}: {day.count}人
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>30日前</span>
              <span>今日</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtext: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xs ${color} mt-1`}>{subtext}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Wallet, Tag, Info, ArrowRight, CreditCard, Store, RefreshCw, Zap, PiggyBank, LogOut, Users, Landmark, FileText } from "lucide-react";

const settingsItems = [
  {
    title: "パートナー共有",
    description: "パートナーと家計を共有",
    icon: Users,
    href: "/settings/household",
  },
  {
    title: "入出金消し込み",
    description: "入金・引き落とし済みを記録",
    icon: CreditCard,
    href: "/cash-settlements",
  },
  {
    title: "定期取引",
    description: "毎月の固定費をテンプレート登録",
    icon: RefreshCw,
    href: "/settings/recurring",
  },
  {
    title: "クイック入力",
    description: "よく使う取引パターンを登録",
    icon: Zap,
    href: "/settings/quick-entries",
  },
  {
    title: "年間収支計画",
    description: "年間の収入・支出予算を計画",
    icon: PiggyBank,
    href: "/reports/annual-plan",
  },
  {
    title: "資産・負債",
    description: "投資や住宅ローン等の残高を登録",
    icon: Landmark,
    href: "/settings/balance-items",
  },
  {
    title: "口座管理",
    description: "銀行口座やカードを追加・編集",
    icon: Wallet,
    href: "/settings/accounts",
  },
  {
    title: "カテゴリ管理",
    description: "支出カテゴリを追加・編集（親子対応）",
    icon: Tag,
    href: "/settings/categories",
  },
  {
    title: "相手先管理",
    description: "取引先・店舗を追加・編集",
    icon: Store,
    href: "/settings/counterparties",
  },
  {
    title: "利用規約",
    description: "サービス利用規約",
    icon: FileText,
    href: "/terms",
  },
  {
    title: "アプリについて",
    description: "バージョン情報",
    icon: Info,
    href: "/settings/about",
  },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">設定</h1>

        {/* User Profile */}
        {user && (
          <div className="bg-card rounded-xl p-4 border border-border flex items-center gap-4">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user.user_metadata?.full_name || user.email}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors group"
              >
                <div className="p-2 rounded-lg bg-secondary">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            );
          })}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          ログアウト
        </Button>

        {/* App Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Money Tracker v0.1.0</p>
        </div>
      </div>
    </MainLayout>
  );
}

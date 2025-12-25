import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { Wallet, Tag, Database, Info, ArrowRight, CreditCard, Store } from "lucide-react";

const settingsItems = [
  {
    title: "カード決済消し込み",
    description: "カード引き落とし済みを記録",
    icon: CreditCard,
    href: "/cash-settlements",
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
    title: "データ管理",
    description: "エクスポート・インポート",
    icon: Database,
    href: "/settings/data",
  },
  {
    title: "アプリについて",
    description: "バージョン情報",
    icon: Info,
    href: "/settings/about",
  },
];

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">設定</h1>

        <div className="space-y-2">
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

        {/* App Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Money Tracker v0.1.0</p>
        </div>
      </div>
    </MainLayout>
  );
}

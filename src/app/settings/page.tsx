import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { Wallet, Tag, Database, Info, ArrowRight, CreditCard, Store, RefreshCw, Zap, PiggyBank } from "lucide-react";

const settingsItems = [
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
    title: "予算管理",
    description: "カテゴリ別の月間予算を設定",
    icon: PiggyBank,
    href: "/settings/budgets",
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

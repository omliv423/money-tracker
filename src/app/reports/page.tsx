import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { TrendingUp, TrendingDown, Scale, ArrowRight } from "lucide-react";

const reportCards = [
  {
    title: "損益計算書 (PL)",
    description: "収入と支出のバランスを確認",
    icon: TrendingUp,
    href: "/reports/pl",
    color: "text-income",
  },
  {
    title: "貸借対照表 (BS)",
    description: "資産・負債・純資産を確認",
    icon: Scale,
    href: "/reports/bs",
    color: "text-primary",
  },
  {
    title: "キャッシュフロー (CF)",
    description: "お金の流れを確認",
    icon: TrendingDown,
    href: "/reports/cf",
    color: "text-expense",
  },
];

export default function ReportsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">レポート</h1>

        <div className="grid gap-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="bg-card rounded-xl p-5 border border-border hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg bg-secondary ${card.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-heading font-semibold">{card.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">今月の収入</p>
            <p className="font-heading text-2xl font-bold text-income tabular-nums">
              ¥0
            </p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground">今月の支出</p>
            <p className="font-heading text-2xl font-bold text-expense tabular-nums">
              ¥0
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

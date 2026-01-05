"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Receipt,
  PieChart,
  Wallet,
  TrendingUp,
  Users,
  CalendarClock,
  Zap,
  ArrowLeft,
} from "lucide-react";

export default function HowToUsePage() {
  const features = [
    {
      icon: Receipt,
      title: "取引を記録",
      description:
        "収入・支出を記録します。発生日と支払日を分けて登録できるので、クレジットカードの利用も正確に管理できます。",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: PieChart,
      title: "PL（損益計算書）",
      description:
        "月ごとの収入と支出を一覧で確認。カテゴリ別の内訳も見られるので、お金の使い方が見える化されます。",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      icon: Wallet,
      title: "BS（貸借対照表）",
      description:
        "資産・負債・純資産の現在残高を確認。口座残高やクレジットカードの未払い残高が一目でわかります。",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      icon: TrendingUp,
      title: "CF（キャッシュフロー）",
      description:
        "実際のお金の動きを追跡。収入・支出・精算など、現金の流れを把握できます。",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: Users,
      title: "パートナーと共有",
      description:
        "家族やパートナーと家計を共有。招待リンクを送るだけで、同じデータを一緒に管理できます。",
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      icon: CalendarClock,
      title: "定期取引",
      description:
        "毎月の固定費を登録しておけば、ワンタップで記録できます。家賃、光熱費、サブスクなどに便利。",
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      icon: Zap,
      title: "クイック入力",
      description:
        "よく使う取引をテンプレートとして保存。コンビニ、カフェなど、日常の支出をサッと記録。",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col safe-area-top">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Link
            href="/login"
            className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-lg font-bold">使い方</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 mb-8"
        >
          <h2 className="font-heading text-2xl font-bold">
            Money Trackerで
            <br />
            できること
          </h2>
          <p className="text-muted-foreground text-sm">
            シンプルな操作で、家計の財務を見える化
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex gap-4 p-4 rounded-xl border border-border/50 bg-card/50"
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center`}
              >
                <feature.icon className={`w-5 h-5 ${feature.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-bold text-sm mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-12 px-8 bg-primary text-primary-foreground rounded-xl font-medium shadow-soft hover:opacity-90 transition-opacity"
          >
            無料で始める
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Googleアカウントで簡単登録
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-6 px-6">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <Link href="/login" className="hover:text-foreground transition-colors">
          ホーム
        </Link>
        <Link href="/how-to-use" className="hover:text-foreground transition-colors">
          使い方
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          利用規約
        </Link>
        <Link href="/support" className="hover:text-foreground transition-colors">
          サポート
        </Link>
        <Link href="/pricing" className="hover:text-foreground transition-colors">
          料金
        </Link>
      </nav>
      <p className="text-center text-xs text-muted-foreground/50 mt-4">
        © 2025 Money Tracker
      </p>
    </footer>
  );
}

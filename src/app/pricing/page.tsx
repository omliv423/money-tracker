"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  ChevronDown,
  Wallet,
  Users,
  CalendarClock,
  Zap,
  PieChart,
  Infinity,
} from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col safe-area-top">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/login"
            className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-lg font-bold">料金プラン</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h2 className="font-heading text-2xl font-bold">プレミアムプラン</h2>
          </div>
          <p className="text-3xl font-bold mb-2">
            ¥400<span className="text-base font-normal text-muted-foreground">/月</span>
          </p>
          <p className="text-muted-foreground text-sm">
            プレミアムになると次の特典を利用できるようになります。
          </p>
        </motion.section>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-1 mb-10"
        >
          <FeatureItem
            icon={Infinity}
            title="口座を無制限に登録可能に"
            note="無料プランは3口座まで"
          />
          <FeatureItem
            icon={PieChart}
            title="すべてのレポートにアクセス"
            note="PL・BS・CF・年間計画など"
          />
          <FeatureItem
            icon={Users}
            title="パートナーとの共有機能"
            note="招待リンクで家計を共有"
          />
          <FeatureItem
            icon={CalendarClock}
            title="定期取引の登録"
            note="毎月の固定費をワンタップで記録"
          />
          <FeatureItem
            icon={Zap}
            title="クイック入力の登録"
            note="よく使う取引をテンプレート化"
          />
          <FeatureItem
            icon={Wallet}
            title="按分機能"
            note="1つの支出を複数カテゴリに分割"
          />
        </motion.section>

        {/* Free Plan Comparison */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-secondary/30 rounded-xl p-5 mb-10"
        >
          <h3 className="font-bold mb-3">無料プランでできること</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              口座3つまで登録
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              取引の記録・編集
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              基本的なレポート表示
            </li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            まずは無料で始めて、必要に応じてアップグレードできます。
          </p>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-10"
        >
          <p className="text-sm text-muted-foreground mb-4">
            プレミアムプランに登録するにはログインが必要です
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-12 px-8 bg-primary text-primary-foreground rounded-xl font-medium shadow-soft hover:opacity-90 transition-opacity"
          >
            ログインして始める
          </Link>
        </motion.div>

        {/* FAQ */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-10"
        >
          <h3 className="font-heading text-lg font-bold mb-4">購入に関するFAQ</h3>
          <div className="space-y-2">
            <FAQItem
              question="無料プランとプレミアムの違いは？"
              answer="無料プランは口座3つまで、基本機能のみ利用可能です。プレミアムでは口座無制限、すべてのレポート、パートナー共有、定期取引、クイック入力などすべての機能が使えます。"
            />
            <FAQItem
              question="いつでもキャンセルできる？"
              answer="はい、いつでもキャンセル可能です。キャンセル後も、支払い済みの期間が終了するまでプレミアム機能を利用できます。"
            />
            <FAQItem
              question="支払いは自動更新される？"
              answer="はい、毎月自動更新されます。キャンセルしない限り、翌月も自動的に課金されます。"
            />
            <FAQItem
              question="決済の安全性について"
              answer="決済はStripeを通じて行われます。クレジットカード情報は当サービスのサーバーには保存されず、Stripeのセキュアなシステムで処理されます。"
            />
            <FAQItem
              question="Stripeとは？"
              answer="Stripeは世界中で利用されている決済プラットフォームです。Amazon、Google、Shopifyなど多くの企業が採用しており、高いセキュリティ基準を満たしています。"
            />
          </div>
        </motion.section>

        {/* Legal Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <Link
            href="/terms"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            利用規約
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ElementType;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        {note && (
          <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
        )}
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/50 transition-colors"
      >
        <span className="font-medium text-sm">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {answer}
          </p>
        </div>
      )}
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

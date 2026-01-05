"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Check, Crown } from "lucide-react";
import { PLANS } from "@/lib/stripe";

export default function PricingPage() {
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
          <h1 className="font-heading text-lg font-bold">料金プラン</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-heading text-2xl font-bold mb-2">
            シンプルな料金体系
          </h2>
          <p className="text-muted-foreground text-sm">
            まずは無料で始めて、必要に応じてアップグレード
          </p>
        </motion.div>

        {/* Plans */}
        <div className="space-y-4">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-5 border-2 border-border"
          >
            <div className="mb-4">
              <h3 className="font-bold text-lg">{PLANS.free.name}</h3>
              <p className="text-3xl font-bold mt-2">
                ¥0
                <span className="text-sm font-normal text-muted-foreground">
                  /月
                </span>
              </p>
            </div>
            <ul className="space-y-3 mb-5">
              {PLANS.free.features.map((feature, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm text-muted-foreground"
                >
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block w-full text-center py-3 border border-border rounded-xl font-medium text-sm hover:bg-secondary transition-colors"
            >
              無料で始める
            </Link>
          </motion.div>

          {/* Premium Plan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-5 border-2 border-primary relative overflow-hidden"
          >
            {/* Badge */}
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-xl">
              おすすめ
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{PLANS.premium.name}</h3>
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-3xl font-bold mt-2">
                ¥{PLANS.premium.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /月
                </span>
              </p>
            </div>
            <ul className="space-y-3 mb-5">
              {PLANS.premium.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block w-full text-center py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
            >
              プレミアムで始める
            </Link>
          </motion.div>
        </div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-4"
        >
          <div className="bg-secondary/50 rounded-xl p-4">
            <h4 className="font-medium text-sm mb-2">お支払いについて</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• クレジットカード決済（Stripe）</li>
              <li>• いつでもキャンセル可能</li>
              <li>• 解約後も期間終了まで利用可能</li>
            </ul>
          </div>
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

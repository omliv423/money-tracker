"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function SupportPage() {
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
          <h1 className="font-heading text-lg font-bold">サポート</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        {/* Contact Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h2 className="font-heading text-xl font-bold mb-4">お問い合わせ</h2>
          <div className="bg-card rounded-xl border border-border/50 p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3">
                  ご質問、不具合報告、ご要望など、お気軽にお問い合わせください。
                </p>
                <a
                  href="mailto:moneytracker001@gmail.com"
                  className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  moneytracker001@gmail.com
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-heading text-xl font-bold mb-4">よくある質問</h2>
          <div className="space-y-3">
            <FAQItem
              question="無料で使えますか？"
              answer="はい、基本機能は無料でお使いいただけます。プレミアムプランでは、より多くの機能をご利用いただけます。"
            />
            <FAQItem
              question="データは安全ですか？"
              answer="はい。データはSupabaseの安全なクラウドに保存され、SSL暗号化で保護されています。お客様のデータは第三者と共有されません。"
            />
            <FAQItem
              question="パートナーとの共有はどうやりますか？"
              answer="設定 > パートナー共有 から招待リンクを作成できます。リンクを共有すると、同じ家計データを一緒に管理できます。"
            />
            <FAQItem
              question="口座の自動連携はできますか？"
              answer="現在、口座の自動連携には対応していません。手入力で家計を管理したい方向けのアプリです。"
            />
            <FAQItem
              question="データのエクスポートはできますか？"
              answer="はい。設定 > データエクスポート から取引データをCSV形式でダウンロードできます。Excelやスプレッドシートで開くことができます。"
            />
            <FAQItem
              question="退会するとデータはどうなりますか？"
              answer="退会するとすべてのデータが削除され、復元できません。退会前に設定 > データエクスポート からバックアップをお勧めします。"
            />
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <Footer />
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

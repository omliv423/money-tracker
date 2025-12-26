"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { TrendingUp, TrendingDown, Scale, ArrowRight } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/lib/supabase";

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
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMonthlyData() {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      // Fetch transaction lines for this month with category info
      const { data: lines } = await supabase
        .from("transaction_lines")
        .select(`
          amount,
          line_type,
          category:categories(id, name, type),
          transaction:transactions(date)
        `);

      let income = 0;
      let expense = 0;

      (lines || []).forEach((line: any) => {
        if (!line.transaction) return;
        // Exclude transfer categories (資金移動)
        if (line.category?.type === "transfer") return;

        const txDate = line.transaction.date;
        if (txDate >= monthStart && txDate <= monthEnd) {
          if (line.line_type === "income") {
            income += line.amount;
          } else if (line.line_type === "expense") {
            expense += line.amount;
          }
        }
      });

      setMonthlyIncome(income);
      setMonthlyExpense(expense);
      setIsLoading(false);
    }

    fetchMonthlyData();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">レポート</h1>

        <div className="grid gap-4">
          {reportCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={card.href}
                  className="block bg-card rounded-xl p-5 border border-border hover:bg-accent transition-colors group"
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
              </motion.div>
            );
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <p className="text-sm text-muted-foreground">今月の収入</p>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse mt-1" />
            ) : (
              <p className="font-heading text-2xl font-bold text-income tabular-nums">
                ¥{monthlyIncome.toLocaleString("ja-JP")}
              </p>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <p className="text-sm text-muted-foreground">今月の支出</p>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse mt-1" />
            ) : (
              <p className="font-heading text-2xl font-bold text-expense tabular-nums">
                ¥{monthlyExpense.toLocaleString("ja-JP")}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}

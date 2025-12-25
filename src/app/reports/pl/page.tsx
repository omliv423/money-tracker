"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, differenceInMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

interface TransactionLine {
  id: string;
  amount: number;
  line_type: string;
  amortization_months: number | null;
  amortization_start: string | null;
  amortization_end: string | null;
  category: { id: string; name: string } | null;
  transaction: { date: string } | null;
}

interface CategorySummary {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export default function PLReportPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [incomeByCategory, setIncomeByCategory] = useState<CategorySummary[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<CategorySummary[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch all transaction lines with their transactions
      // We need to check both regular transactions in this month
      // AND amortized transactions that span this month
      const { data: lines, error } = await supabase
        .from("transaction_lines")
        .select(`
          id,
          amount,
          line_type,
          amortization_months,
          amortization_start,
          amortization_end,
          category:categories(id, name),
          transaction:transactions(date)
        `);

      if (error) {
        console.error("Error fetching data:", error);
        setIsLoading(false);
        return;
      }

      const incomeMap = new Map<string, CategorySummary>();
      const expenseMap = new Map<string, CategorySummary>();

      (lines || []).forEach((line) => {
        const typedLine = line as unknown as TransactionLine;
        if (!typedLine.transaction || !typedLine.category) return;

        const txDate = new Date(typedLine.transaction.date);
        const categoryId = typedLine.category.id;
        const categoryName = typedLine.category.name;

        let amountForMonth = 0;

        // Check if this is an amortized expense
        if (
          typedLine.amortization_months &&
          typedLine.amortization_months > 1 &&
          typedLine.amortization_start &&
          typedLine.amortization_end
        ) {
          const amortStart = new Date(typedLine.amortization_start);
          const amortEnd = new Date(typedLine.amortization_end);

          // Check if the current month falls within the amortization period
          if (
            isWithinInterval(monthStart, { start: amortStart, end: amortEnd }) ||
            isWithinInterval(monthEnd, { start: amortStart, end: amortEnd }) ||
            (monthStart <= amortStart && monthEnd >= amortEnd)
          ) {
            // Calculate the monthly amount
            amountForMonth = Math.round(typedLine.amount / typedLine.amortization_months);
          }
        } else {
          // Regular transaction - check if it's in the current month
          if (txDate >= monthStart && txDate <= monthEnd) {
            amountForMonth = typedLine.amount;
          }
        }

        if (amountForMonth === 0) return;

        // Add to appropriate category
        if (typedLine.line_type === "income") {
          const existing = incomeMap.get(categoryId) || {
            categoryId,
            categoryName,
            amount: 0,
          };
          existing.amount += amountForMonth;
          incomeMap.set(categoryId, existing);
        } else if (typedLine.line_type === "expense") {
          const existing = expenseMap.get(categoryId) || {
            categoryId,
            categoryName,
            amount: 0,
          };
          existing.amount += amountForMonth;
          expenseMap.set(categoryId, existing);
        }
      });

      const incomeList = Array.from(incomeMap.values()).sort((a, b) => b.amount - a.amount);
      const expenseList = Array.from(expenseMap.values()).sort((a, b) => b.amount - a.amount);

      setIncomeByCategory(incomeList);
      setExpenseByCategory(expenseList);
      setTotalIncome(incomeList.reduce((sum, c) => sum + c.amount, 0));
      setTotalExpense(expenseList.reduce((sum, c) => sum + c.amount, 0));
      setIsLoading(false);
    }

    fetchData();
  }, [currentMonth]);

  const netIncome = totalIncome - totalExpense;

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-xl font-bold">損益計算書 (PL)</h1>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-heading text-lg font-bold min-w-[120px] text-center">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-income" />
              <p className="text-xs text-muted-foreground">収入</p>
            </div>
            <p className="font-heading text-lg font-bold tabular-nums text-income">
              ¥{totalIncome.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-expense" />
              <p className="text-xs text-muted-foreground">支出</p>
            </div>
            <p className="font-heading text-lg font-bold tabular-nums text-expense">
              ¥{totalExpense.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">収支</p>
            <p className={`font-heading text-lg font-bold tabular-nums ${netIncome >= 0 ? "text-income" : "text-expense"}`}>
              {netIncome >= 0 ? "+" : ""}¥{netIncome.toLocaleString("ja-JP")}
            </p>
          </motion.div>
        </div>

        {/* Income Breakdown */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            収入の内訳
          </h2>
          {incomeByCategory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">収入なし</p>
          ) : (
            <div className="space-y-2">
              {incomeByCategory.map((cat, index) => (
                <motion.div
                  key={cat.categoryId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                >
                  <span>{cat.categoryName}</span>
                  <span className="font-heading font-bold tabular-nums text-income">
                    ¥{cat.amount.toLocaleString("ja-JP")}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            支出の内訳
          </h2>
          {expenseByCategory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">支出なし</p>
          ) : (
            <div className="space-y-2">
              {expenseByCategory.map((cat, index) => (
                <motion.div
                  key={cat.categoryId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                >
                  <span>{cat.categoryName}</span>
                  <span className="font-heading font-bold tabular-nums text-expense">
                    ¥{cat.amount.toLocaleString("ja-JP")}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

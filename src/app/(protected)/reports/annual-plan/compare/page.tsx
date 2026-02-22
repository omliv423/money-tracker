"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, type Tables } from "@/lib/supabase";
import { startOfMonth, endOfMonth, format } from "date-fns";

type Category = Tables<"categories">;

interface AnnualBudgetItem {
  category_id: string;
  planned_amount: number;
}

interface TransactionLine {
  amount: number;
  line_type: string;
  category_id: string | null;
  transaction: { date: string } | null;
}

interface CompareData {
  categoryId: string;
  categoryName: string;
  planned: number;
  actual: number;
  diff: number;
  percentage: number;
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [budgetItems, setBudgetItems] = useState<AnnualBudgetItem[]>([]);
  const [transactionLines, setTransactionLines] = useState<TransactionLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fiscalYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const fetchData = async () => {
    setIsLoading(true);

    const targetDate = new Date(fiscalYear, selectedMonth - 1, 1);
    const monthStart = format(startOfMonth(targetDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(targetDate), "yyyy-MM-dd");

    const [budgetResponse, linesResponse, categoriesResponse] = await Promise.all([
      (supabase as any)
        .from("annual_budget_items")
        .select("category_id, planned_amount")
        .eq("fiscal_year", fiscalYear)
        .eq("month", selectedMonth),
      supabase
        .from("transaction_lines")
        .select(`
          amount,
          line_type,
          category_id,
          transaction:transactions(date)
        `)
        .in("line_type", ["income", "expense"]),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("type")
        .order("name"),
    ]);

    setBudgetItems(budgetResponse.data || []);

    // 月でフィルタリング
    const filteredLines = (linesResponse.data || []).filter((line: any) => {
      const txDate = line.transaction?.date;
      return txDate && txDate >= monthStart && txDate <= monthEnd;
    });
    setTransactionLines(filteredLines as TransactionLine[]);
    setCategories(categoriesResponse.data || []);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fiscalYear, selectedMonth]);

  // カテゴリ別に実績を集計
  const getActualByCategory = (categoryId: string): number => {
    return transactionLines
      .filter((line) => line.category_id === categoryId)
      .reduce((sum, line) => sum + line.amount, 0);
  };

  // 比較データを生成
  const incomeData: CompareData[] = useMemo(() => {
    const incomeCats = categories.filter((c) => c.type === "income" && c.parent_id === null);
    return incomeCats.map((cat) => {
      const planned = budgetItems.find((b) => b.category_id === cat.id)?.planned_amount || 0;
      const actual = getActualByCategory(cat.id);
      const diff = actual - planned;
      const percentage = planned > 0 ? (actual / planned) * 100 : 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        planned,
        actual,
        diff,
        percentage,
      };
    }).filter((d) => d.planned > 0 || d.actual > 0);
  }, [categories, budgetItems, transactionLines]);

  const expenseData: CompareData[] = useMemo(() => {
    const expenseCats = categories.filter((c) => c.type === "expense" && c.parent_id === null);
    return expenseCats.map((cat) => {
      const planned = budgetItems.find((b) => b.category_id === cat.id)?.planned_amount || 0;
      const actual = getActualByCategory(cat.id);
      const diff = actual - planned;
      const percentage = planned > 0 ? (actual / planned) * 100 : 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        planned,
        actual,
        diff,
        percentage,
      };
    }).filter((d) => d.planned > 0 || d.actual > 0);
  }, [categories, budgetItems, transactionLines]);

  const incomeTotals = useMemo(() => ({
    planned: incomeData.reduce((sum, d) => sum + d.planned, 0),
    actual: incomeData.reduce((sum, d) => sum + d.actual, 0),
  }), [incomeData]);

  const expenseTotals = useMemo(() => ({
    planned: expenseData.reduce((sum, d) => sum + d.planned, 0),
    actual: expenseData.reduce((sum, d) => sum + d.actual, 0),
  }), [expenseData]);

  const netPlanned = incomeTotals.planned - expenseTotals.planned;
  const netActual = incomeTotals.actual - expenseTotals.actual;

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

  const renderCompareCards = (
    type: "income" | "expense",
    data: CompareData[],
    totals: { planned: number; actual: number },
    icon: React.ReactNode,
    title: string
  ) => {
    const isExpense = type === "expense";
    const totalPercentage = totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;
    const remaining = totals.planned - totals.actual;
    const isTotalWarning = isExpense ? totalPercentage > 100 : totalPercentage < 100;
    const barWidth = Math.min(totalPercentage, 100);
    const totalBarColor = isExpense
      ? (totalPercentage > 100 ? "bg-red-500" : "bg-emerald-500")
      : (totalPercentage >= 100 ? "bg-emerald-500" : "bg-orange-500");

    return (
      <div className="space-y-3">
        {/* セクションヘッダー + サマリーカード */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            {icon}
            <h2 className="font-medium">{title}</h2>
          </div>
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-0.5">
              <div className="text-sm text-muted-foreground">
                予算 <span className="tabular-nums">¥{totals.planned.toLocaleString()}</span>
              </div>
              <div className="text-lg font-bold tabular-nums">
                {isExpense ? "支出" : "収入"} ¥{totals.actual.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">残り</div>
              <div className={`text-lg font-bold tabular-nums ${remaining < 0 ? "text-red-500" : ""}`}>
                {remaining < 0 ? "-" : ""}¥{Math.abs(remaining).toLocaleString()}
              </div>
            </div>
          </div>
          {/* プログレスバー */}
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${totalBarColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={`text-xs font-medium tabular-nums ${isTotalWarning ? (isExpense ? "text-red-500" : "text-orange-500") : "text-emerald-500"}`}>
              {totalPercentage.toFixed(0)}%
            </span>
            {totalPercentage > 100 && (
              <span className="text-xs text-red-500">
                {isExpense ? "超過" : ""}
              </span>
            )}
          </div>
        </div>

        {/* カテゴリ別カード */}
        {data.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground">
            データがありません
          </div>
        ) : (
          data.map((item) => {
            const itemRemaining = item.planned - item.actual;
            const itemBarWidth = Math.min(item.percentage, 100);
            const itemBarColor = isExpense
              ? (item.percentage > 100 ? "bg-red-500" : "bg-emerald-500")
              : (item.percentage >= 100 ? "bg-emerald-500" : "bg-orange-500");

            return (
              <div
                key={item.categoryId}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div className="text-sm font-medium mb-2">{item.categoryName}</div>
                <div className="flex items-end justify-between mb-2">
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground tabular-nums">
                      予算 ¥{item.planned.toLocaleString()}
                    </div>
                    <div className="text-base font-bold tabular-nums">
                      ¥{item.actual.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">残り</div>
                    <div className={`text-sm font-semibold tabular-nums ${itemRemaining < 0 ? "text-red-500" : ""}`}>
                      {itemRemaining < 0 ? "-" : ""}¥{Math.abs(itemRemaining).toLocaleString()}
                    </div>
                  </div>
                </div>
                {/* プログレスバー */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${itemBarColor}`}
                    style={{ width: `${item.planned > 0 ? itemBarWidth : 0}%` }}
                  />
                </div>
                <div className="text-right mt-1">
                  <span className={`text-xs font-medium tabular-nums ${
                    isExpense
                      ? (item.percentage > 100 ? "text-red-500" : "text-emerald-500")
                      : (item.percentage >= 100 ? "text-emerald-500" : "text-orange-500")
                  }`}>
                    {item.planned > 0 ? `${item.percentage.toFixed(0)}%` : "-"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-xl font-bold">計画vs実績</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth((m) => (m > 1 ? m - 1 : 12))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-lg w-28 text-center whitespace-nowrap">
              {fiscalYear}年{selectedMonth}月
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth((m) => (m < 12 ? m + 1 : 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-sm text-muted-foreground mb-1">収入</div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-muted-foreground">計画</span>
                <span className="ml-2 text-muted-foreground">¥{incomeTotals.planned.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">実績</span>
                <span className="ml-2 font-bold text-income">¥{incomeTotals.actual.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-sm text-muted-foreground mb-1">支出</div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-muted-foreground">計画</span>
                <span className="ml-2 text-muted-foreground">¥{expenseTotals.planned.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">実績</span>
                <span className="ml-2 font-bold text-expense">¥{expenseTotals.actual.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-sm text-muted-foreground mb-1">収支</div>
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-muted-foreground">計画</span>
                <span className="ml-2 text-muted-foreground">
                  {netPlanned >= 0 ? "+" : ""}¥{netPlanned.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">実績</span>
                <span className={`ml-2 font-bold ${netActual >= 0 ? "text-income" : "text-expense"}`}>
                  {netActual >= 0 ? "+" : ""}¥{netActual.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 収入比較 */}
        {renderCompareCards(
          "income",
          incomeData,
          incomeTotals,
          <TrendingUp className="w-5 h-5 text-income" />,
          "収入"
        )}

        {/* 支出比較 */}
        {renderCompareCards(
          "expense",
          expenseData,
          expenseTotals,
          <TrendingDown className="w-5 h-5 text-expense" />,
          "支出"
        )}
      </div>
    </MainLayout>
  );
}

export default function AnnualPlanComparePage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        </MainLayout>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Check } from "lucide-react";
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

  const renderCompareTable = (
    type: "income" | "expense",
    data: CompareData[],
    totals: { planned: number; actual: number },
    icon: React.ReactNode,
    title: string
  ) => {
    const isExpense = type === "expense";

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          {icon}
          <h2 className="font-medium">{title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium">カテゴリ</th>
                <th className="text-right p-3 font-medium">計画</th>
                <th className="text-right p-3 font-medium">実績</th>
                <th className="text-right p-3 font-medium">差分</th>
                <th className="text-right p-3 font-medium">達成率</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    データがありません
                  </td>
                </tr>
              ) : (
                <>
                  {data.map((item) => {
                    // 支出の場合：超過は警告、収入の場合：未達は警告
                    const isWarning = isExpense
                      ? item.percentage > 100
                      : item.planned > 0 && item.percentage < 100;
                    const isGood = isExpense
                      ? item.percentage <= 100
                      : item.percentage >= 100;

                    return (
                      <tr key={item.categoryId} className="border-b border-border">
                        <td className="p-3 font-medium">{item.categoryName}</td>
                        <td className="text-right p-3 tabular-nums text-muted-foreground">
                          ¥{item.planned.toLocaleString()}
                        </td>
                        <td className="text-right p-3 tabular-nums font-medium">
                          ¥{item.actual.toLocaleString()}
                        </td>
                        <td className={`text-right p-3 tabular-nums ${item.diff >= 0 ? (isExpense ? "text-expense" : "text-income") : (isExpense ? "text-income" : "text-expense")}`}>
                          {item.diff >= 0 ? "+" : ""}¥{item.diff.toLocaleString()}
                        </td>
                        <td className={`text-right p-3 tabular-nums font-medium ${isWarning ? "text-orange-500" : isGood ? "text-income" : ""}`}>
                          {item.planned > 0 ? `${item.percentage.toFixed(0)}%` : "-"}
                        </td>
                        <td className="p-3">
                          {isWarning && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                          {isGood && item.planned > 0 && <Check className="w-4 h-4 text-income" />}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-medium">
                    <td className="p-3">合計</td>
                    <td className="text-right p-3 tabular-nums">
                      ¥{totals.planned.toLocaleString()}
                    </td>
                    <td className="text-right p-3 tabular-nums">
                      ¥{totals.actual.toLocaleString()}
                    </td>
                    <td className={`text-right p-3 tabular-nums ${
                      totals.actual - totals.planned >= 0
                        ? (isExpense ? "text-expense" : "text-income")
                        : (isExpense ? "text-income" : "text-expense")
                    }`}>
                      {totals.actual - totals.planned >= 0 ? "+" : ""}
                      ¥{(totals.actual - totals.planned).toLocaleString()}
                    </td>
                    <td className="text-right p-3 tabular-nums">
                      {totals.planned > 0
                        ? `${((totals.actual / totals.planned) * 100).toFixed(0)}%`
                        : "-"}
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
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
        {renderCompareTable(
          "income",
          incomeData,
          incomeTotals,
          <TrendingUp className="w-5 h-5 text-income" />,
          "収入"
        )}

        {/* 支出比較 */}
        {renderCompareTable(
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

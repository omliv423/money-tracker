"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, type Tables } from "@/lib/supabase";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

type Category = Tables<"categories">;

interface AnnualBudgetItem {
  category_id: string;
  planned_amount: number;
}

interface TransactionLine {
  amount: number;
  line_type: string;
  category_id: string | null;
  transaction: { date: string; description: string } | null;
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
  const [transactionLines, setTransactionLines] = useState<TransactionLine[]>(
    []
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const fiscalYear = parseInt(
    searchParams.get("year") || String(new Date().getFullYear())
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
  );

  const fetchData = async () => {
    setIsLoading(true);

    const targetDate = new Date(fiscalYear, selectedMonth - 1, 1);
    const monthStart = format(startOfMonth(targetDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(targetDate), "yyyy-MM-dd");

    const [budgetResponse, linesResponse, categoriesResponse] =
      await Promise.all([
        (supabase as any)
          .from("annual_budget_items")
          .select("category_id, planned_amount")
          .eq("fiscal_year", fiscalYear)
          .eq("month", selectedMonth),
        supabase
          .from("transaction_lines")
          .select(
            `
          amount,
          line_type,
          category_id,
          transaction:transactions!inner(date, description)
        `
          )
          .in("line_type", ["income", "expense"])
          .gte("transaction.date", monthStart)
          .lte("transaction.date", monthEnd),
        supabase
          .from("categories")
          .select("*")
          .eq("is_active", true)
          .order("type")
          .order("name"),
      ]);

    setBudgetItems(budgetResponse.data || []);
    setTransactionLines((linesResponse.data || []) as TransactionLine[]);
    setCategories(categoriesResponse.data || []);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fiscalYear, selectedMonth]);

  const toggleCard = (categoryId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // 親カテゴリ + その子カテゴリのID一覧を取得
  const getCategoryIds = (parentId: string): string[] => {
    const childIds = categories
      .filter((c) => c.parent_id === parentId)
      .map((c) => c.id);
    return [parentId, ...childIds];
  };

  const getActualByCategory = (categoryId: string): number => {
    const ids = getCategoryIds(categoryId);
    return transactionLines
      .filter((line) => line.category_id && ids.includes(line.category_id))
      .reduce((sum, line) => sum + line.amount, 0);
  };

  const getLinesByCategory = (categoryId: string): TransactionLine[] => {
    const ids = getCategoryIds(categoryId);
    return transactionLines
      .filter((line) => line.category_id && ids.includes(line.category_id))
      .sort((a, b) => {
        const dateA = a.transaction?.date || "";
        const dateB = b.transaction?.date || "";
        return dateB.localeCompare(dateA);
      });
  };

  const incomeData: CompareData[] = useMemo(() => {
    const incomeCats = categories.filter(
      (c) => c.type === "income" && c.parent_id === null
    );
    return incomeCats
      .map((cat) => {
        const planned =
          budgetItems.find((b) => b.category_id === cat.id)?.planned_amount ||
          0;
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
      })
      .filter((d) => d.planned > 0 || d.actual > 0);
  }, [categories, budgetItems, transactionLines]);

  const expenseData: CompareData[] = useMemo(() => {
    const expenseCats = categories.filter(
      (c) => c.type === "expense" && c.parent_id === null
    );
    return expenseCats
      .map((cat) => {
        const planned =
          budgetItems.find((b) => b.category_id === cat.id)?.planned_amount ||
          0;
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
      })
      .filter((d) => d.planned > 0 || d.actual > 0);
  }, [categories, budgetItems, transactionLines]);

  const incomeTotals = useMemo(
    () => ({
      planned: incomeData.reduce((sum, d) => sum + d.planned, 0),
      actual: incomeData.reduce((sum, d) => sum + d.actual, 0),
    }),
    [incomeData]
  );

  const expenseTotals = useMemo(
    () => ({
      planned: expenseData.reduce((sum, d) => sum + d.planned, 0),
      actual: expenseData.reduce((sum, d) => sum + d.actual, 0),
    }),
    [expenseData]
  );

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

  // 参考アプリ風：行レイアウト（アイコン | 予算・支出 | 残り | >）
  const renderBudgetRow = (
    item: CompareData,
    isExpense: boolean,
    icon: React.ReactNode,
    label: string,
    isLast: boolean
  ) => {
    const remaining = item.planned - item.actual;
    const barWidth = item.planned > 0 ? Math.min(item.percentage, 100) : 0;
    const isOver = isExpense ? item.percentage > 100 : item.percentage < 100;
    const isExpanded = expandedCards.has(item.categoryId);
    const lines = isExpanded ? getLinesByCategory(item.categoryId) : [];

    return (
      <div key={item.categoryId}>
        <button
          type="button"
          className={`w-full text-left active:bg-muted/60 transition-colors ${!isLast && !isExpanded ? "border-b border-border" : ""}`}
          onClick={() => toggleCard(item.categoryId)}
        >
          <div className="flex items-center gap-3 px-4 py-4">
            {/* 左: アイコン + カテゴリ名 */}
            <div className="flex flex-col items-center w-12 shrink-0">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: isExpense
                    ? "oklch(0.55 0.18 25 / 10%)"
                    : "oklch(0.6 0.15 160 / 10%)",
                }}
              >
                {icon}
              </div>
              <span className="mt-1 text-[10px] leading-tight text-muted-foreground text-center line-clamp-2">
                {label}
              </span>
            </div>

            {/* 中央: 予算・支出 + プログレスバー */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">予算 </span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    ¥{item.planned.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">残り</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">支出 </span>
                  <span className="tabular-nums text-xl font-bold tracking-tight">
                    ¥{item.actual.toLocaleString()}
                  </span>
                </div>
                <span
                  className={`tabular-nums text-xl font-bold tracking-tight ${remaining < 0 ? "text-expense" : ""}`}
                >
                  {remaining < 0 ? "-" : ""}¥
                  {Math.abs(remaining).toLocaleString()}
                </span>
              </div>
              {/* プログレスバー */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      barWidth > 0
                        ? isOver
                          ? "var(--expense)"
                          : "var(--income)"
                        : "transparent",
                  }}
                />
              </div>
            </div>

            {/* 右: シェブロン */}
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 ml-1"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </motion.div>
          </div>
        </button>

        {/* 展開時の明細 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div
                className={`bg-muted/30 pl-[4.5rem] pr-4 py-1 ${!isLast ? "border-b border-border" : ""}`}
              >
                {lines.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    取引がありません
                  </p>
                ) : (
                  lines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-2 ${idx !== lines.length - 1 ? "border-b border-border/40" : ""}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="tabular-nums text-xs text-muted-foreground shrink-0 w-8">
                          {line.transaction?.date
                            ? format(parseISO(line.transaction.date), "M/d", {
                                locale: ja,
                              })
                            : "-"}
                        </span>
                        <span className="truncate text-sm text-foreground/70">
                          {line.transaction?.description || "（メモなし）"}
                        </span>
                      </div>
                      <span className="tabular-nums text-sm font-medium shrink-0 ml-3">
                        ¥{line.amount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSection = (
    type: "income" | "expense",
    data: CompareData[],
    totals: { planned: number; actual: number },
    sectionIcon: React.ReactNode,
    title: string
  ) => {
    const isExpense = type === "expense";
    const totalPercentage =
      totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;
    const remaining = totals.planned - totals.actual;
    const barWidth = Math.min(totalPercentage, 100);
    const isOver = isExpense ? totalPercentage > 100 : totalPercentage < 100;

    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* 全体サマリー行 */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="flex flex-col items-center w-12 shrink-0">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: isExpense
                  ? "oklch(0.55 0.18 25 / 12%)"
                  : "oklch(0.6 0.15 160 / 12%)",
              }}
            >
              <Wallet
                className={`h-5 w-5 ${isExpense ? "text-expense" : "text-income"}`}
              />
            </div>
            <span className="mt-1 text-[10px] font-medium text-muted-foreground">
              全体
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-muted-foreground">予算 </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  ¥{totals.planned.toLocaleString()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">残り</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-muted-foreground">
                  {isExpense ? "支出" : "収入"}{" "}
                </span>
                <span
                  className={`tabular-nums text-xl font-bold tracking-tight ${isExpense ? "text-expense" : "text-income"}`}
                >
                  ¥{totals.actual.toLocaleString()}
                </span>
              </div>
              <span
                className={`tabular-nums text-xl font-bold tracking-tight ${remaining < 0 ? "text-expense" : ""}`}
              >
                {remaining < 0 ? "-" : ""}¥
                {Math.abs(remaining).toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                className="h-full rounded-full"
                style={{
                  background: isOver ? "var(--expense)" : "var(--income)",
                }}
              />
            </div>
          </div>
        </div>

        {/* セクションラベル */}
        <div className="bg-muted/40 px-4 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">
            カテゴリー別{title}
          </span>
        </div>

        {/* カテゴリ行リスト */}
        {data.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            データがありません
          </div>
        ) : (
          data.map((item, index) => {
            const firstChar = item.categoryName.charAt(0);
            const icon = (
              <span
                className={`text-sm font-bold ${isExpense ? "text-expense" : "text-income"}`}
              >
                {firstChar}
              </span>
            );
            return renderBudgetRow(
              item,
              isExpense,
              icon,
              item.categoryName,
              index === data.length - 1
            );
          })
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-5 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-heading text-xl font-bold tracking-tight">
              計画 vs 実績
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setSelectedMonth((m) => (m > 1 ? m - 1 : 12))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums text-sm font-semibold w-24 text-center">
              {fiscalYear}年{selectedMonth}月
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setSelectedMonth((m) => (m < 12 ? m + 1 : 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 収入セクション */}
        {renderSection(
          "income",
          incomeData,
          incomeTotals,
          <TrendingUp className="h-5 w-5 text-income" />,
          "収入"
        )}

        {/* 支出セクション */}
        {renderSection(
          "expense",
          expenseData,
          expenseTotals,
          <TrendingDown className="h-5 w-5 text-expense" />,
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

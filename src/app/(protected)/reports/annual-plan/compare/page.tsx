"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  }),
};

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
          transaction:transactions(date, description)
        `
          )
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

  // カテゴリ別に実績を集計
  const getActualByCategory = (categoryId: string): number => {
    return transactionLines
      .filter((line) => line.category_id === categoryId)
      .reduce((sum, line) => sum + line.amount, 0);
  };

  // カテゴリ別の取引明細を取得（日付降順）
  const getLinesByCategory = (categoryId: string): TransactionLine[] => {
    return transactionLines
      .filter((line) => line.category_id === categoryId)
      .sort((a, b) => {
        const dateA = a.transaction?.date || "";
        const dateB = b.transaction?.date || "";
        return dateB.localeCompare(dateA);
      });
  };

  // 比較データを生成
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

  const renderCompareCards = (
    type: "income" | "expense",
    data: CompareData[],
    totals: { planned: number; actual: number },
    icon: React.ReactNode,
    title: string
  ) => {
    const isExpense = type === "expense";
    const totalPercentage =
      totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;
    const remaining = totals.planned - totals.actual;
    const barWidth = Math.min(totalPercentage, 100);

    // テーマカラーに合わせた判定
    const isOverBudget = isExpense
      ? totalPercentage > 100
      : totalPercentage < 100;

    return (
      <div className="space-y-2.5">
        {/* セクションサマリーカード */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          {/* 背景アクセント */}
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.07]"
            style={{
              background: isExpense
                ? "var(--expense)"
                : "var(--income)",
            }}
          />

          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: isExpense
                    ? "oklch(0.55 0.18 25 / 12%)"
                    : "oklch(0.6 0.15 160 / 12%)",
                }}
              >
                {icon}
              </div>
              <h2 className="font-heading text-base font-semibold tracking-tight">
                {title}
              </h2>
            </div>

            <div className="mb-4 flex items-end justify-between">
              <div className="space-y-1">
                <p className="text-xs tracking-wide text-muted-foreground">
                  予算
                </p>
                <p className="tabular-nums text-sm text-muted-foreground">
                  ¥{totals.planned.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs tracking-wide text-muted-foreground">
                  {isExpense ? "支出" : "収入"}
                </p>
                <p
                  className={`tabular-nums text-xl font-bold tracking-tight ${isExpense ? "text-expense" : "text-income"}`}
                >
                  ¥{totals.actual.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs tracking-wide text-muted-foreground">
                  残り
                </p>
                <p
                  className={`tabular-nums text-sm font-semibold ${remaining < 0 ? "text-expense" : ""}`}
                >
                  {remaining < 0 ? "-" : ""}¥
                  {Math.abs(remaining).toLocaleString()}
                </p>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.2,
                }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: isOverBudget
                    ? "var(--expense)"
                    : "var(--income)",
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`tabular-nums text-xs font-semibold ${isOverBudget ? "text-expense" : "text-income"}`}
              >
                {totalPercentage.toFixed(0)}%
              </span>
              {isExpense && totalPercentage > 100 && (
                <span className="text-xs font-medium text-expense">
                  超過
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* カテゴリ別カード */}
        {data.length === 0 ? (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={1}
            className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
          >
            データがありません
          </motion.div>
        ) : (
          data.map((item, index) => {
            const itemRemaining = item.planned - item.actual;
            const itemBarWidth = Math.min(item.percentage, 100);
            const isItemOver = isExpense
              ? item.percentage > 100
              : item.percentage < 100;
            const isExpanded = expandedCards.has(item.categoryId);
            const lines = isExpanded
              ? getLinesByCategory(item.categoryId)
              : [];

            return (
              <motion.div
                key={item.categoryId}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={index + 1}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow duration-200 hover:shadow-[0_2px_8px_oklch(0.2_0.01_60/10%)]"
              >
                <button
                  type="button"
                  className="w-full px-4 py-3.5 text-left active:bg-accent/40 transition-colors"
                  onClick={() => toggleCard(item.categoryId)}
                >
                  {/* ヘッダー行: カテゴリ名 + シェブロン */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-tight">
                      {item.categoryName}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
                    </motion.div>
                  </div>

                  {/* 金額行 */}
                  <div className="mb-2.5 flex items-end justify-between">
                    <div>
                      <p className="tabular-nums text-[11px] text-muted-foreground">
                        予算 ¥{item.planned.toLocaleString()}
                      </p>
                      <p
                        className={`tabular-nums text-lg font-bold tracking-tight ${isExpense ? "text-expense" : "text-income"}`}
                      >
                        ¥{item.actual.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">
                        残り
                      </p>
                      <p
                        className={`tabular-nums text-sm font-semibold ${itemRemaining < 0 ? "text-expense" : ""}`}
                      >
                        {itemRemaining < 0 ? "-" : ""}¥
                        {Math.abs(itemRemaining).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${item.planned > 0 ? itemBarWidth : 0}%`,
                      }}
                      transition={{
                        duration: 0.6,
                        ease: [0.16, 1, 0.3, 1],
                        delay: 0.1 + index * 0.05,
                      }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background:
                          item.planned > 0
                            ? isItemOver
                              ? "var(--expense)"
                              : "var(--income)"
                            : "transparent",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-right">
                    <span
                      className={`tabular-nums text-[11px] font-semibold ${isItemOver ? "text-expense" : "text-income"}`}
                    >
                      {item.planned > 0
                        ? `${item.percentage.toFixed(0)}%`
                        : "-"}
                    </span>
                  </div>
                </button>

                {/* 展開時の明細リスト */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border bg-muted/30 px-4 py-2">
                        {lines.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">
                            取引がありません
                          </p>
                        ) : (
                          lines.map((line, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between py-2 ${idx !== lines.length - 1 ? "border-b border-border/50" : ""}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="tabular-nums text-[11px] text-muted-foreground shrink-0 w-8">
                                  {line.transaction?.date
                                    ? format(
                                        parseISO(line.transaction.date),
                                        "M/d",
                                        { locale: ja }
                                      )
                                    : "-"}
                                </span>
                                <span className="truncate text-sm text-foreground/70">
                                  {line.transaction?.description ||
                                    "（メモなし）"}
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
              </motion.div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between"
        >
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
          <div className="flex items-center gap-1.5">
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
        </motion.div>

        {/* トップサマリー 3カード */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              label: "収入",
              planned: incomeTotals.planned,
              actual: incomeTotals.actual,
              colorClass: "text-income",
              accent: "oklch(0.6 0.15 160 / 10%)",
            },
            {
              label: "支出",
              planned: expenseTotals.planned,
              actual: expenseTotals.actual,
              colorClass: "text-expense",
              accent: "oklch(0.55 0.18 25 / 10%)",
            },
            {
              label: "収支",
              planned: netPlanned,
              actual: netActual,
              colorClass: netActual >= 0 ? "text-income" : "text-expense",
              accent:
                netActual >= 0
                  ? "oklch(0.6 0.15 160 / 10%)"
                  : "oklch(0.55 0.18 25 / 10%)",
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={i}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-soft"
            >
              <div
                className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full"
                style={{ background: card.accent }}
              />
              <p className="relative mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {card.label}
              </p>
              <div className="relative space-y-1">
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    計画
                  </span>
                  <p className="tabular-nums text-xs text-muted-foreground">
                    {card.label === "収支" && card.planned >= 0 ? "+" : ""}
                    ¥{card.planned.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    実績
                  </span>
                  <p
                    className={`tabular-nums text-base font-bold tracking-tight ${card.colorClass}`}
                  >
                    {card.label === "収支" && card.actual >= 0 ? "+" : ""}¥
                    {card.actual.toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 収入比較 */}
        {renderCompareCards(
          "income",
          incomeData,
          incomeTotals,
          <TrendingUp className="h-4 w-4 text-income" />,
          "収入"
        )}

        {/* 支出比較 */}
        {renderCompareCards(
          "expense",
          expenseData,
          expenseTotals,
          <TrendingDown className="h-4 w-4 text-expense" />,
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

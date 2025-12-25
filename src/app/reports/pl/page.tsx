"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isWithinInterval,
} from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// カテゴリ別の色
const COLORS = [
  "#f43f5e", "#fb923c", "#facc15", "#4ade80", "#22d3ee",
  "#818cf8", "#e879f9", "#94a3b8", "#f87171", "#fbbf24",
];

interface TransactionLine {
  id: string;
  amount: number;
  line_type: string;
  amortization_months: number | null;
  amortization_start: string | null;
  amortization_end: string | null;
  category: { id: string; name: string; parent_id: string | null } | null;
  transaction: {
    date: string;
    counterparty: { id: string; name: string } | null;
  } | null;
}

interface CategorySummary {
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  amount: number;
  byCounterparty: Map<string, { name: string; amount: number }>;
}

interface ParentCategorySummary {
  categoryId: string;
  categoryName: string;
  amount: number;
  children: CategorySummary[];
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export default function PLReportPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [incomeByParent, setIncomeByParent] = useState<ParentCategorySummary[]>([]);
  const [expenseByParent, setExpenseByParent] = useState<ParentCategorySummary[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyData[]>([]);
  const [showChart, setShowChart] = useState<"pie" | "bar" | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch all transaction lines with categories (including parent_id) and counterparties
      const { data: lines, error } = await supabase.from("transaction_lines").select(`
          id,
          amount,
          line_type,
          amortization_months,
          amortization_start,
          amortization_end,
          category:categories(id, name, parent_id),
          transaction:transactions(date, counterparty:counterparties(id, name))
        `);

      // Fetch all categories for parent lookup
      const { data: allCategories } = await supabase.from("categories").select("*");

      if (error) {
        console.error("Error fetching data:", error);
        setIsLoading(false);
        return;
      }

      const categoryMap = new Map<string, { name: string; parent_id: string | null }>();
      (allCategories || []).forEach((cat: any) => {
        categoryMap.set(cat.id, { name: cat.name, parent_id: cat.parent_id });
      });

      const incomeMap = new Map<string, CategorySummary>();
      const expenseMap = new Map<string, CategorySummary>();

      (lines || []).forEach((line) => {
        const typedLine = line as unknown as TransactionLine;
        if (!typedLine.transaction || !typedLine.category) return;

        const txDate = new Date(typedLine.transaction.date);
        const categoryId = typedLine.category.id;
        const categoryName = typedLine.category.name;
        const parentId = typedLine.category.parent_id;
        const counterpartyId = typedLine.transaction.counterparty?.id || "unknown";
        const counterpartyName = typedLine.transaction.counterparty?.name || "不明";

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

          if (
            isWithinInterval(monthStart, { start: amortStart, end: amortEnd }) ||
            isWithinInterval(monthEnd, { start: amortStart, end: amortEnd }) ||
            (monthStart <= amortStart && monthEnd >= amortEnd)
          ) {
            amountForMonth = Math.round(typedLine.amount / typedLine.amortization_months);
          }
        } else {
          if (txDate >= monthStart && txDate <= monthEnd) {
            amountForMonth = typedLine.amount;
          }
        }

        if (amountForMonth === 0) return;

        // Only include income and expense in PL (skip asset/liability)
        if (typedLine.line_type !== "income" && typedLine.line_type !== "expense") {
          return;
        }

        const targetMap = typedLine.line_type === "income" ? incomeMap : expenseMap;

        const existing = targetMap.get(categoryId) || {
          categoryId,
          categoryName,
          parentId,
          amount: 0,
          byCounterparty: new Map(),
        };
        existing.amount += amountForMonth;

        // Track by counterparty
        const cpEntry = existing.byCounterparty.get(counterpartyId) || {
          name: counterpartyName,
          amount: 0,
        };
        cpEntry.amount += amountForMonth;
        existing.byCounterparty.set(counterpartyId, cpEntry);

        targetMap.set(categoryId, existing);
      });

      // Build hierarchical structure
      const buildHierarchy = (
        map: Map<string, CategorySummary>
      ): ParentCategorySummary[] => {
        const parentMap = new Map<string, ParentCategorySummary>();

        // First pass: group by parent
        map.forEach((summary) => {
          const actualParentId = summary.parentId;

          if (actualParentId) {
            // This is a child category
            const parent = categoryMap.get(actualParentId);
            if (parent) {
              const parentSummary = parentMap.get(actualParentId) || {
                categoryId: actualParentId,
                categoryName: parent.name,
                amount: 0,
                children: [],
              };
              parentSummary.amount += summary.amount;
              parentSummary.children.push(summary);
              parentMap.set(actualParentId, parentSummary);
            }
          } else {
            // This is a parent category or standalone
            const existing = parentMap.get(summary.categoryId);
            if (existing) {
              // Already has children, add this amount
              existing.amount += summary.amount;
            } else {
              parentMap.set(summary.categoryId, {
                categoryId: summary.categoryId,
                categoryName: summary.categoryName,
                amount: summary.amount,
                children: [],
              });
            }
          }
        });

        // Sort children by amount
        parentMap.forEach((parent) => {
          parent.children.sort((a, b) => b.amount - a.amount);
        });

        return Array.from(parentMap.values()).sort((a, b) => b.amount - a.amount);
      };

      const incomeHierarchy = buildHierarchy(incomeMap);
      const expenseHierarchy = buildHierarchy(expenseMap);

      setIncomeByParent(incomeHierarchy);
      setExpenseByParent(expenseHierarchy);
      setTotalIncome(incomeHierarchy.reduce((sum, c) => sum + c.amount, 0));
      setTotalExpense(expenseHierarchy.reduce((sum, c) => sum + c.amount, 0));

      // 過去6ヶ月分の月次推移を計算
      const monthlyData: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const targetMonth = subMonths(currentMonth, i);
        const mStart = startOfMonth(targetMonth);
        const mEnd = endOfMonth(targetMonth);

        let monthIncome = 0;
        let monthExpense = 0;

        (lines || []).forEach((line) => {
          const typedLine = line as unknown as TransactionLine;
          if (!typedLine.transaction || !typedLine.category) return;
          if (typedLine.line_type !== "income" && typedLine.line_type !== "expense") return;

          const txDate = new Date(typedLine.transaction.date);
          let amountForMonth = 0;

          if (
            typedLine.amortization_months &&
            typedLine.amortization_months > 1 &&
            typedLine.amortization_start &&
            typedLine.amortization_end
          ) {
            const amortStart = new Date(typedLine.amortization_start);
            const amortEnd = new Date(typedLine.amortization_end);
            if (
              isWithinInterval(mStart, { start: amortStart, end: amortEnd }) ||
              isWithinInterval(mEnd, { start: amortStart, end: amortEnd }) ||
              (mStart <= amortStart && mEnd >= amortEnd)
            ) {
              amountForMonth = Math.round(typedLine.amount / typedLine.amortization_months);
            }
          } else {
            if (txDate >= mStart && txDate <= mEnd) {
              amountForMonth = typedLine.amount;
            }
          }

          if (amountForMonth > 0) {
            if (typedLine.line_type === "income") {
              monthIncome += amountForMonth;
            } else {
              monthExpense += amountForMonth;
            }
          }
        });

        monthlyData.push({
          month: format(targetMonth, "M月", { locale: ja }),
          income: monthIncome,
          expense: monthExpense,
          net: monthIncome - monthExpense,
        });
      }
      setMonthlyTrend(monthlyData);
      setIsLoading(false);
    }

    fetchData();
  }, [currentMonth]);

  const netIncome = totalIncome - totalExpense;

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

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

  const renderCategoryItem = (
    parent: ParentCategorySummary,
    colorClass: string,
    index: number
  ) => {
    const isExpanded = expandedCategories.has(parent.categoryId);
    const hasChildren = parent.children.length > 0;

    return (
      <div key={parent.categoryId}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          onClick={() => hasChildren && toggleExpand(parent.categoryId)}
          className={`bg-card rounded-xl p-4 border border-border flex justify-between items-center ${
            hasChildren ? "cursor-pointer hover:bg-accent transition-colors" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            )}
            <span>{parent.categoryName}</span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground">
                ({parent.children.length})
              </span>
            )}
          </div>
          <span className={`font-heading font-bold tabular-nums ${colorClass}`}>
            ¥{parent.amount.toLocaleString("ja-JP")}
          </span>
        </motion.div>

        {/* Children */}
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-4 mt-2 space-y-2 border-l-2 border-primary/20 pl-4"
            >
              {parent.children.map((child) => (
                <motion.div
                  key={child.categoryId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-secondary/50 rounded-lg p-3 flex justify-between items-center"
                >
                  <span className="text-sm">{child.categoryName}</span>
                  <span className={`font-heading font-bold tabular-nums text-sm ${colorClass}`}>
                    ¥{child.amount.toLocaleString("ja-JP")}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

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
        <div className="grid grid-cols-3 gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-income flex-shrink-0" />
              <p className="text-xs text-muted-foreground">収入</p>
            </div>
            <p className="font-heading text-sm font-bold tabular-nums text-income whitespace-nowrap overflow-hidden">
              ¥{totalIncome.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-expense flex-shrink-0" />
              <p className="text-xs text-muted-foreground">支出</p>
            </div>
            <p className="font-heading text-sm font-bold tabular-nums text-expense whitespace-nowrap overflow-hidden">
              ¥{totalExpense.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">収支</p>
            <p
              className={`font-heading text-sm font-bold tabular-nums whitespace-nowrap overflow-hidden ${
                netIncome >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {netIncome >= 0 ? "+" : ""}¥{netIncome.toLocaleString("ja-JP")}
            </p>
          </motion.div>
        </div>

        {/* Chart Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowChart(showChart === "pie" ? null : "pie")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
              showChart === "pie"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-accent"
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span className="text-sm">費用の割合</span>
          </button>
          <button
            onClick={() => setShowChart(showChart === "bar" ? null : "bar")}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
              showChart === "bar"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-accent"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">月次推移</span>
          </button>
        </div>

        {/* Pie Chart - 費用の割合 */}
        <AnimatePresence>
          {showChart === "pie" && expenseByParent.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card rounded-xl p-4 border border-border"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">
                支出の内訳（カテゴリ別）
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByParent.map((cat) => ({
                        name: cat.categoryName,
                        value: cat.amount,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expenseByParent.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) =>
                        `¥${value.toLocaleString("ja-JP")}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {expenseByParent.map((cat, index) => (
                  <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate">{cat.categoryName}</span>
                    </div>
                    <span className="text-muted-foreground ml-1 flex-shrink-0">
                      {totalExpense > 0 ? `${((cat.amount / totalExpense) * 100).toFixed(0)}%` : "0%"}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bar Chart - 月次推移 */}
        <AnimatePresence>
          {showChart === "bar" && monthlyTrend.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card rounded-xl p-4 border border-border"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">
                過去6ヶ月の収支推移
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) =>
                        value >= 10000 ? `${(value / 10000).toFixed(0)}万` : value
                      }
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        `¥${value.toLocaleString("ja-JP")}`
                      }
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value === "income" ? "収入" : value === "expense" ? "支出" : "収支"
                      }
                    />
                    <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Income Breakdown */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            収入の内訳
            <span className="text-xs">（タップで展開）</span>
          </h2>
          {incomeByParent.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">収入なし</p>
          ) : (
            <div className="space-y-2">
              {incomeByParent.map((parent, index) =>
                renderCategoryItem(parent, "text-income", index)
              )}
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            支出の内訳
            <span className="text-xs">（タップで展開）</span>
          </h2>
          {expenseByParent.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">支出なし</p>
          ) : (
            <div className="space-y-2">
              {expenseByParent.map((parent, index) =>
                renderCategoryItem(parent, "text-expense", index)
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

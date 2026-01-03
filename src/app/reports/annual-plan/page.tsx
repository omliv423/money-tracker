"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Edit, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";

type Category = Tables<"categories">;

interface AnnualBudgetItem {
  id: string;
  fiscal_year: number;
  month: number;
  category_id: string;
  budget_type: string;
  planned_amount: number;
  notes: string | null;
}

export default function AnnualPlanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [budgetItems, setBudgetItems] = useState<AnnualBudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  const fetchData = async () => {
    setIsLoading(true);

    const [budgetResponse, categoriesResponse] = await Promise.all([
      (supabase as any)
        .from("annual_budget_items")
        .select("*")
        .eq("fiscal_year", fiscalYear),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("type")
        .order("name"),
    ]);

    setBudgetItems(budgetResponse.data || []);
    setCategories(categoriesResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fiscalYear]);

  // 収入カテゴリと支出カテゴリを分離
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income" && c.parent_id === null),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense" && c.parent_id === null),
    [categories]
  );

  // 月別・カテゴリ別の計画額を集計
  const getPlannedAmount = (categoryId: string, month: number): number => {
    const item = budgetItems.find(
      (b) => b.category_id === categoryId && b.month === month
    );
    return item?.planned_amount || 0;
  };

  // カテゴリの年間合計
  const getCategoryTotal = (categoryId: string): number => {
    return budgetItems
      .filter((b) => b.category_id === categoryId)
      .reduce((sum, b) => sum + b.planned_amount, 0);
  };

  // 月別合計（収入/支出）
  const getMonthTotal = (month: number, type: "income" | "expense"): number => {
    const targetCategories = type === "income" ? incomeCategories : expenseCategories;
    return targetCategories.reduce((sum, cat) => sum + getPlannedAmount(cat.id, month), 0);
  };

  // 年間合計（収入/支出）
  const getYearTotal = (type: "income" | "expense"): number => {
    const targetCategories = type === "income" ? incomeCategories : expenseCategories;
    return targetCategories.reduce((sum, cat) => sum + getCategoryTotal(cat.id), 0);
  };

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const incomeTotal = getYearTotal("income");
  const expenseTotal = getYearTotal("expense");
  const netTotal = incomeTotal - expenseTotal;

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-xl font-bold">年間収支計画</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiscalYear((y) => y - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-lg w-20 text-center">{fiscalYear}年</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiscalYear((y) => y + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/reports/annual-plan/edit?year=${fiscalYear}`}>
            <Button size="sm">
              <Edit className="w-4 h-4 mr-2" />
              計画を編集
            </Button>
          </Link>
          <Link href={`/reports/annual-plan/compare?year=${fiscalYear}`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              実績と比較
            </Button>
          </Link>
        </div>

        {/* 年間サマリー */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="bg-card rounded-xl p-4 border border-border flex items-center justify-between sm:block">
            <div className="flex items-center gap-2 sm:mb-2">
              <TrendingUp className="w-4 h-4 text-income" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">年間収入</span>
            </div>
            <span className="font-heading text-xl font-bold text-income tabular-nums">
              ¥{incomeTotal.toLocaleString()}
            </span>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border flex items-center justify-between sm:block">
            <div className="flex items-center gap-2 sm:mb-2">
              <TrendingDown className="w-4 h-4 text-expense" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">年間支出</span>
            </div>
            <span className="font-heading text-xl font-bold text-expense tabular-nums">
              ¥{expenseTotal.toLocaleString()}
            </span>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border flex items-center justify-between sm:block">
            <div className="flex items-center gap-2 sm:mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">年間収支</span>
            </div>
            <span className={`font-heading text-xl font-bold tabular-nums ${netTotal >= 0 ? "text-income" : "text-expense"}`}>
              {netTotal >= 0 ? "+" : ""}¥{netTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 収入計画 */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-income" />
              <h2 className="font-medium">収入計画</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              年間: ¥{incomeTotal.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium sticky left-0 bg-muted/50">カテゴリ</th>
                  {months.map((m) => (
                    <th key={m} className="text-right p-3 font-medium min-w-[80px]">
                      {m}月
                    </th>
                  ))}
                  <th className="text-right p-3 font-medium min-w-[100px]">合計</th>
                </tr>
              </thead>
              <tbody>
                {incomeCategories.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-8 text-muted-foreground">
                      収入カテゴリがありません
                    </td>
                  </tr>
                ) : (
                  <>
                    {incomeCategories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap">{cat.name}</td>
                        {months.map((m) => {
                          const amount = getPlannedAmount(cat.id, m);
                          return (
                            <td key={m} className="text-right p-3 tabular-nums">
                              {amount > 0 ? `¥${(amount / 10000).toFixed(0)}万` : "-"}
                            </td>
                          );
                        })}
                        <td className="text-right p-3 tabular-nums font-medium">
                          ¥{getCategoryTotal(cat.id).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-medium">
                      <td className="p-3 sticky left-0 bg-muted/30">合計</td>
                      {months.map((m) => (
                        <td key={m} className="text-right p-3 tabular-nums">
                          ¥{(getMonthTotal(m, "income") / 10000).toFixed(0)}万
                        </td>
                      ))}
                      <td className="text-right p-3 tabular-nums text-income">
                        ¥{incomeTotal.toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 支出計画 */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-expense" />
              <h2 className="font-medium">支出計画</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              年間: ¥{expenseTotal.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium sticky left-0 bg-muted/50">カテゴリ</th>
                  {months.map((m) => (
                    <th key={m} className="text-right p-3 font-medium min-w-[80px]">
                      {m}月
                    </th>
                  ))}
                  <th className="text-right p-3 font-medium min-w-[100px]">合計</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-8 text-muted-foreground">
                      支出カテゴリがありません
                    </td>
                  </tr>
                ) : (
                  <>
                    {expenseCategories.map((cat) => (
                      <tr key={cat.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap">{cat.name}</td>
                        {months.map((m) => {
                          const amount = getPlannedAmount(cat.id, m);
                          return (
                            <td key={m} className="text-right p-3 tabular-nums">
                              {amount > 0 ? `¥${(amount / 10000).toFixed(0)}万` : "-"}
                            </td>
                          );
                        })}
                        <td className="text-right p-3 tabular-nums font-medium">
                          ¥{getCategoryTotal(cat.id).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-medium">
                      <td className="p-3 sticky left-0 bg-muted/30">合計</td>
                      {months.map((m) => (
                        <td key={m} className="text-right p-3 tabular-nums">
                          ¥{(getMonthTotal(m, "expense") / 10000).toFixed(0)}万
                        </td>
                      ))}
                      <td className="text-right p-3 tabular-nums text-expense">
                        ¥{expenseTotal.toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 月別収支 */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">月別収支</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium sticky left-0 bg-muted/50"></th>
                  {months.map((m) => (
                    <th key={m} className="text-right p-3 font-medium min-w-[80px]">
                      {m}月
                    </th>
                  ))}
                  <th className="text-right p-3 font-medium min-w-[100px]">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap">収入</td>
                  {months.map((m) => (
                    <td key={m} className="text-right p-3 tabular-nums text-income">
                      ¥{(getMonthTotal(m, "income") / 10000).toFixed(0)}万
                    </td>
                  ))}
                  <td className="text-right p-3 tabular-nums font-medium text-income">
                    ¥{incomeTotal.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap">支出</td>
                  {months.map((m) => (
                    <td key={m} className="text-right p-3 tabular-nums text-expense">
                      ¥{(getMonthTotal(m, "expense") / 10000).toFixed(0)}万
                    </td>
                  ))}
                  <td className="text-right p-3 tabular-nums font-medium text-expense">
                    ¥{expenseTotal.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-muted/30 font-medium">
                  <td className="p-3 sticky left-0 bg-muted/30">収支</td>
                  {months.map((m) => {
                    const net = getMonthTotal(m, "income") - getMonthTotal(m, "expense");
                    return (
                      <td key={m} className={`text-right p-3 tabular-nums ${net >= 0 ? "text-income" : "text-expense"}`}>
                        {net >= 0 ? "+" : ""}¥{(net / 10000).toFixed(0)}万
                      </td>
                    );
                  })}
                  <td className={`text-right p-3 tabular-nums ${netTotal >= 0 ? "text-income" : "text-expense"}`}>
                    {netTotal >= 0 ? "+" : ""}¥{netTotal.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

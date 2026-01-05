"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Save, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Category = Tables<"categories">;

interface AnnualBudgetItem {
  id?: string;
  fiscal_year: number;
  month: number;
  category_id: string;
  budget_type: string;
  planned_amount: number;
}

interface EditableItem {
  categoryId: string;
  amounts: { [month: number]: number };
}

function EditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [incomeItems, setIncomeItems] = useState<EditableItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<EditableItem[]>([]);

  const fiscalYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

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
        .is("parent_id", null)
        .order("type")
        .order("name"),
    ]);

    const budgetItems: AnnualBudgetItem[] = budgetResponse.data || [];
    const cats: Category[] = categoriesResponse.data || [];
    setCategories(cats);

    // 収入カテゴリの編集用データを構築
    const incomeCats = cats.filter((c) => c.type === "income");
    const incomeData: EditableItem[] = incomeCats.map((cat) => {
      const amounts: { [month: number]: number } = {};
      for (let m = 1; m <= 12; m++) {
        const item = budgetItems.find(
          (b) => b.category_id === cat.id && b.month === m
        );
        amounts[m] = item?.planned_amount || 0;
      }
      return { categoryId: cat.id, amounts };
    });
    setIncomeItems(incomeData);

    // 支出カテゴリの編集用データを構築
    const expenseCats = cats.filter((c) => c.type === "expense");
    const expenseData: EditableItem[] = expenseCats.map((cat) => {
      const amounts: { [month: number]: number } = {};
      for (let m = 1; m <= 12; m++) {
        const item = budgetItems.find(
          (b) => b.category_id === cat.id && b.month === m
        );
        amounts[m] = item?.planned_amount || 0;
      }
      return { categoryId: cat.id, amounts };
    });
    setExpenseItems(expenseData);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fiscalYear]);

  const handleAmountChange = (
    type: "income" | "expense",
    categoryId: string,
    month: number,
    value: string
  ) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, "")) || 0;
    const setItems = type === "income" ? setIncomeItems : setExpenseItems;

    setItems((prev) =>
      prev.map((item) =>
        item.categoryId === categoryId
          ? { ...item, amounts: { ...item.amounts, [month]: numValue } }
          : item
      )
    );
  };

  const handleCopyToAllMonths = (
    type: "income" | "expense",
    categoryId: string,
    sourceMonth: number
  ) => {
    const items = type === "income" ? incomeItems : expenseItems;
    const setItems = type === "income" ? setIncomeItems : setExpenseItems;
    const item = items.find((i) => i.categoryId === categoryId);
    if (!item) return;

    const sourceAmount = item.amounts[sourceMonth];
    const newAmounts: { [month: number]: number } = {};
    for (let m = 1; m <= 12; m++) {
      newAmounts[m] = sourceAmount;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.categoryId === categoryId ? { ...i, amounts: newAmounts } : i
      )
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    // 既存データを削除
    await (supabase as any)
      .from("annual_budget_items")
      .delete()
      .eq("user_id", user.id)
      .eq("fiscal_year", fiscalYear);

    // 新規データを作成
    const allItems: any[] = [];

    incomeItems.forEach((item) => {
      Object.entries(item.amounts).forEach(([month, amount]) => {
        if (amount > 0) {
          allItems.push({
            user_id: user.id,
            fiscal_year: fiscalYear,
            month: parseInt(month),
            category_id: item.categoryId,
            budget_type: "income",
            planned_amount: amount,
          });
        }
      });
    });

    expenseItems.forEach((item) => {
      Object.entries(item.amounts).forEach(([month, amount]) => {
        if (amount > 0) {
          allItems.push({
            user_id: user.id,
            fiscal_year: fiscalYear,
            month: parseInt(month),
            category_id: item.categoryId,
            budget_type: "expense",
            planned_amount: amount,
          });
        }
      });
    });

    if (allItems.length > 0) {
      await (supabase as any).from("annual_budget_items").insert(allItems);
    }

    setIsSaving(false);
    router.push(`/reports/annual-plan?year=${fiscalYear}`);
  };

  const getCategoryName = (categoryId: string): string => {
    return categories.find((c) => c.id === categoryId)?.name || "";
  };

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

  const renderEditTable = (
    type: "income" | "expense",
    items: EditableItem[],
    icon: React.ReactNode,
    title: string
  ) => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 min-w-[120px]">
                カテゴリ
              </th>
              {months.map((m) => (
                <th key={m} className="text-center p-2 font-medium min-w-[90px]">
                  {m}月
                </th>
              ))}
              <th className="p-2 min-w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-8 text-muted-foreground">
                  カテゴリがありません
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.categoryId} className="border-b border-border">
                  <td className="p-3 font-medium sticky left-0 bg-card whitespace-nowrap">
                    {getCategoryName(item.categoryId)}
                  </td>
                  {months.map((m) => (
                    <td key={m} className="p-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.amounts[m] > 0 ? item.amounts[m].toLocaleString() : ""}
                        onChange={(e) =>
                          handleAmountChange(type, item.categoryId, m, e.target.value)
                        }
                        placeholder="0"
                        className="h-8 text-right text-sm tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToAllMonths(type, item.categoryId, 1)}
                      title="1月の値を全月にコピー"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
            <h1 className="font-heading text-xl font-bold">
              {fiscalYear}年 計画編集
            </h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          各カテゴリの月別計画額を入力してください。
          <Copy className="w-3 h-3 inline mx-1" />
          ボタンで1月の値を全月にコピーできます。
        </p>

        {/* 収入計画 */}
        {renderEditTable(
          "income",
          incomeItems,
          <TrendingUp className="w-5 h-5 text-income" />,
          "収入計画"
        )}

        {/* 支出計画 */}
        {renderEditTable(
          "expense",
          expenseItems,
          <TrendingDown className="w-5 h-5 text-expense" />,
          "支出計画"
        )}

        {/* 保存ボタン（下部） */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "保存中..." : "保存する"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

export default function AnnualPlanEditPage() {
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
      <EditContent />
    </Suspense>
  );
}

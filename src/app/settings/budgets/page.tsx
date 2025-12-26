"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, PiggyBank, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, type Tables } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth } from "date-fns";

type Category = Tables<"categories">;
type Budget = Tables<"budgets">;

type CategoryWithBudget = {
  category: Category;
  budget: Budget | null;
  currentSpending: number;
};

export default function BudgetsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CategoryWithBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch expense categories
    const { data: categories } = await supabase
      .from("categories")
      .select("*")
      .eq("type", "expense")
      .eq("is_active", true)
      .is("parent_id", null) // Only parent categories
      .order("name");

    // Fetch budgets
    const { data: budgets } = await supabase.from("budgets").select("*");

    // Fetch current month's spending
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const { data: lines } = await supabase
      .from("transaction_lines")
      .select(`
        amount,
        category_id,
        line_type,
        transaction:transactions(date)
      `)
      .eq("line_type", "expense");

    // Calculate spending per category
    const spendingMap = new Map<string, number>();
    (lines || []).forEach((line: any) => {
      const txDate = line.transaction?.date;
      if (txDate && txDate >= monthStart && txDate <= monthEnd && line.category_id) {
        const current = spendingMap.get(line.category_id) || 0;
        spendingMap.set(line.category_id, current + line.amount);
      }
    });

    // Combine data
    const budgetMap = new Map(budgets?.map((b) => [b.category_id, b]) || []);
    const combined: CategoryWithBudget[] = (categories || []).map((cat) => ({
      category: cat,
      budget: budgetMap.get(cat.id) || null,
      currentSpending: spendingMap.get(cat.id) || 0,
    }));

    setItems(combined);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startEdit = (categoryId: string, currentAmount: number | null) => {
    setEditingId(categoryId);
    setEditAmount(currentAmount ? String(currentAmount) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
  };

  const saveBudget = async (categoryId: string) => {
    const amount = parseInt(editAmount, 10);
    if (isNaN(amount) || amount < 0) {
      cancelEdit();
      return;
    }

    setIsSaving(true);

    const existingBudget = items.find((i) => i.category.id === categoryId)?.budget;

    if (amount === 0) {
      // Delete budget
      if (existingBudget) {
        await supabase.from("budgets").delete().eq("id", existingBudget.id);
      }
    } else if (existingBudget) {
      // Update budget
      await supabase
        .from("budgets")
        .update({ monthly_amount: amount })
        .eq("id", existingBudget.id);
    } else {
      // Create budget
      await supabase.from("budgets").insert({
        category_id: categoryId,
        monthly_amount: amount,
      });
    }

    setIsSaving(false);
    cancelEdit();
    fetchData();
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
          <h1 className="font-heading text-xl font-bold">予算管理</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          カテゴリ別に月間予算を設定すると、使いすぎを防止できます
        </p>

        {/* Categories List */}
        <div className="space-y-2">
          <AnimatePresence>
            {items.map((item, index) => {
              const { category, budget, currentSpending } = item;
              const budgetAmount = budget?.monthly_amount || 0;
              const percentage = budgetAmount > 0 ? (currentSpending / budgetAmount) * 100 : 0;
              const isOverBudget = percentage > 100;
              const isEditing = editingId === category.id;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{category.name}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="0"
                          className="w-28 h-8 text-right"
                          autoFocus
                        />
                        <button
                          onClick={() => saveBudget(category.id)}
                          disabled={isSaving}
                          className="p-1 text-primary hover:bg-primary/20 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-muted-foreground hover:bg-accent rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(category.id, budgetAmount || null)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {budgetAmount > 0
                          ? `¥${budgetAmount.toLocaleString()}`
                          : "未設定"}
                      </button>
                    )}
                  </div>

                  {budgetAmount > 0 && (
                    <>
                      {/* Progress bar */}
                      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all ${
                            isOverBudget ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>

                      {/* Spending info */}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span
                          className={isOverBudget ? "text-destructive font-medium" : ""}
                        >
                          ¥{currentSpending.toLocaleString()} 使用
                        </span>
                        <span>
                          残り ¥{Math.max(0, budgetAmount - currentSpending).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Summary */}
        {items.some((i) => i.budget) && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <PiggyBank className="w-5 h-5 text-primary" />
              <span className="font-medium">今月のまとめ</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">予算合計</span>
                <span className="font-mono">
                  ¥{items.reduce((sum, i) => sum + (i.budget?.monthly_amount || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">使用済み</span>
                <span className="font-mono">
                  ¥{items.filter((i) => i.budget).reduce((sum, i) => sum + i.currentSpending, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">残り</span>
                <span className="font-mono font-medium">
                  ¥{Math.max(
                    0,
                    items.reduce((sum, i) => sum + (i.budget?.monthly_amount || 0), 0) -
                      items.filter((i) => i.budget).reduce((sum, i) => sum + i.currentSpending, 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

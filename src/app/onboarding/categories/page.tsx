"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Category = Tables<"categories">;

export default function OnboardingCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense">("expense");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    expense: true,
  });

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user?.id}`)
        .is("parent_id", null)
        .eq("is_active", true)
        .order("type")
        .order("name");

      if (data) {
        setCategories(data);
      }
      setIsLoading(false);
    }
    if (user) {
      fetchCategories();
    }
  }, [user]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || isSaving) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        user_id: user?.id,
        name: newCategoryName.trim(),
        type: newCategoryType,
        is_active: true,
      })
      .select()
      .single();

    if (data && !error) {
      setCategories([...categories, data]);
      setNewCategoryName("");
      setShowAddForm(false);
    }
    setIsSaving(false);
  };

  const handleComplete = () => {
    router.push("/");
  };

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  if (isLoading) {
    return (
      <OnboardingLayout currentStep={2} title="カテゴリを確認">
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
          />
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={2}
      title="カテゴリを確認"
      description="デフォルトのカテゴリを確認し、必要に応じて追加できます"
    >
      <div className="space-y-6">
        {/* Income Categories */}
        <div className="space-y-2">
          <button
            onClick={() =>
              setExpandedSections((s) => ({ ...s, income: !s.income }))
            }
            className="flex items-center gap-2 text-sm font-medium text-income"
          >
            {expandedSections.income ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            収入カテゴリ ({incomeCategories.length})
          </button>
          {expandedSections.income && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-2 gap-2"
            >
              {incomeCategories.map((category) => (
                <div
                  key={category.id}
                  className="p-3 rounded-xl border bg-income/10 border-income/30 text-sm flex items-center gap-2"
                >
                  <Check className="w-3 h-3 text-income" />
                  {category.name}
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Expense Categories */}
        <div className="space-y-2">
          <button
            onClick={() =>
              setExpandedSections((s) => ({ ...s, expense: !s.expense }))
            }
            className="flex items-center gap-2 text-sm font-medium text-expense"
          >
            {expandedSections.expense ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            支出カテゴリ ({expenseCategories.length})
          </button>
          {expandedSections.expense && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-2 gap-2"
            >
              {expenseCategories.map((category) => (
                <div
                  key={category.id}
                  className="p-3 rounded-xl border bg-expense/10 border-expense/30 text-sm flex items-center gap-2"
                >
                  <Check className="w-3 h-3 text-expense" />
                  {category.name}
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Add Custom Category */}
        {showAddForm ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border space-y-3"
          >
            <Input
              placeholder="カテゴリ名"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant={newCategoryType === "income" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewCategoryType("income")}
                className="flex-1"
              >
                収入
              </Button>
              <Button
                variant={newCategoryType === "expense" ? "default" : "outline"}
                size="sm"
                onClick={() => setNewCategoryType("expense")}
                className="flex-1"
              >
                支出
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCategoryName("");
                }}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || isSaving}
                className="flex-1"
              >
                {isSaving ? "追加中..." : "追加"}
              </Button>
            </div>
          </motion.div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            カテゴリを追加
          </Button>
        )}

        {/* Complete Button */}
        <div className="pt-4 space-y-2">
          <Button onClick={handleComplete} className="w-full h-12">
            <Check className="w-4 h-4 mr-2" />
            始める
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            カテゴリは後から設定で変更できます
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}

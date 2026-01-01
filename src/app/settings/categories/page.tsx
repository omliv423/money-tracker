"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, Tag, Trash2, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Category = Tables<"categories">;

interface CategoryWithChildren extends Category {
  children: Category[];
}

const categoryTypes = [
  { value: "expense", label: "支出" },
  { value: "income", label: "収入" },
];

export default function CategoriesSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("expense");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("type")
      .order("name");

    if (data) {
      setCategories(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    await supabase.from("categories").insert({
      user_id: user?.id,
      name: newName.trim(),
      type: newType,
      parent_id: newParentId,
    });

    setNewName("");
    setNewType("expense");
    setNewParentId(null);
    setShowAddDialog(false);
    setIsSaving(false);
    fetchCategories();
  };

  const handleToggleActive = async (category: Category) => {
    await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);
    fetchCategories();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    await supabase.from("categories").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchCategories();
  };

  // Build hierarchical structure
  const buildHierarchy = (cats: Category[]): CategoryWithChildren[] => {
    const parentCategories = cats.filter((c) => c.parent_id === null);
    return parentCategories.map((parent) => ({
      ...parent,
      children: cats.filter((c) => c.parent_id === parent.id),
    }));
  };

  const incomeCategories = buildHierarchy(categories.filter((c) => c.type === "income"));
  const expenseCategories = buildHierarchy(categories.filter((c) => c.type === "expense"));

  // Get parent categories for dropdown
  const parentCategoriesForType = categories.filter(
    (c) => c.type === newType && c.parent_id === null
  );

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

  const renderCategoryItem = (category: Category, isChild: boolean = false) => (
    <motion.div
      key={category.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-xl p-4 border border-border ${
        !category.is_active ? "opacity-50" : ""
      } ${isChild ? "ml-6 border-l-2 border-l-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isChild ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleActive(category)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              category.is_active
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {category.is_active ? "有効" : "無効"}
          </button>
          <button
            onClick={() => setDeleteId(category.id)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderCategoryList = (cats: CategoryWithChildren[], label: string, colorClass: string) => (
    <div>
      <h2 className={`text-sm font-medium mb-3 ${colorClass}`}>{label}</h2>
      {cats.length === 0 ? (
        <p className="text-center text-muted-foreground py-4 text-sm">カテゴリなし</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {cats.map((category) => (
              <div key={category.id}>
                {renderCategoryItem(category, false)}
                {category.children.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {category.children.map((child) => renderCategoryItem(child, true))}
                  </div>
                )}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
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
            <h1 className="font-heading text-xl font-bold">カテゴリ管理</h1>
          </div>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Income Categories */}
        {renderCategoryList(incomeCategories, "収入カテゴリ", "text-income")}

        {/* Expense Categories */}
        {renderCategoryList(expenseCategories, "支出カテゴリ", "text-expense")}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>カテゴリを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">名前</label>
              <Input
                placeholder="例: 食費"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">種類</label>
              <Select
                value={newType}
                onValueChange={(v) => {
                  setNewType(v);
                  setNewParentId(null); // Reset parent when type changes
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                親カテゴリ（任意）
              </label>
              <Select
                value={newParentId || "none"}
                onValueChange={(v) => setNewParentId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="親カテゴリなし（大分類として追加）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">親カテゴリなし（大分類として追加）</SelectItem>
                  {parentCategoriesForType.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}の子カテゴリとして追加
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : "追加する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このカテゴリを使用している取引がある場合、または子カテゴリがある場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

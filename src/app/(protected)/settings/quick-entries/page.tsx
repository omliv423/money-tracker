"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, Zap, Trash2, Edit2, X } from "lucide-react";
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
import { CategoryPicker } from "@/components/transaction/CategoryPicker";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type QuickEntry = Tables<"quick_entries"> & {
  account?: { name: string } | null;
  category?: { name: string } | null;
};
type Account = Tables<"accounts">;
type Category = Tables<"categories">;

export default function QuickEntriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<QuickEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formLineType, setFormLineType] = useState("expense");
  const [formCounterparty, setFormCounterparty] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [itemsRes, accountsRes, categoriesRes] = await Promise.all([
      supabase
        .from("quick_entries")
        .select(`
          *,
          account:accounts(name),
          category:categories(name)
        `)
        .eq("user_id", user?.id ?? "")
        .order("use_count", { ascending: false }),
      supabase.from("accounts").select("*").eq("is_active", true).order("name"),
      supabase.from("categories").select("*").eq("is_active", true).order("name"),
    ]);

    if (itemsRes.data) setItems(itemsRes.data as QuickEntry[]);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormAccountId("");
    setFormCategoryId("");
    setFormLineType("expense");
    setFormCounterparty("");
    setEditingId(null);
  };

  const openAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (item: QuickEntry) => {
    setFormName(item.name);
    setFormDescription(item.description || "");
    setFormAccountId(item.account_id || "");
    setFormCategoryId(item.category_id || "");
    setFormLineType(item.line_type);
    setFormCounterparty(item.counterparty || "");
    setEditingId(item.id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    setIsSaving(true);

    const data = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      account_id: formAccountId || null,
      category_id: formCategoryId || null,
      line_type: formLineType,
      counterparty: formCounterparty.trim() || null,
    };

    if (editingId) {
      await supabase.from("quick_entries").update(data).eq("id", editingId);
    } else {
      await supabase.from("quick_entries").insert({ ...data, user_id: user?.id });
    }

    setIsSaving(false);
    setShowDialog(false);
    resetForm();
    fetchData();
  };

  const handleToggleActive = async (item: QuickEntry) => {
    await supabase
      .from("quick_entries")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("quick_entries").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchData();
  };

  // カテゴリタイプを決定（income以外はexpenseカテゴリを使用）
  const categoryType = formLineType === "income" ? "income" : "expense";

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
            <h1 className="font-heading text-xl font-bold">クイック入力</h1>
          </div>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>クイック入力がありません</p>
            <p className="text-sm mt-1">よく使う取引パターンを登録しましょう</p>
          </div>
        )}

        {/* Items List */}
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-card rounded-xl p-4 border border-border ${
                  !item.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Zap className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                        {item.category && <span>{item.category.name}</span>}
                        {item.account && (
                          <>
                            <span>•</span>
                            <span>{item.account.name}</span>
                          </>
                        )}
                        {item.counterparty && (
                          <>
                            <span>•</span>
                            <span>{item.counterparty}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{item.use_count}回使用</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        item.is_active
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.is_active ? "有効" : "無効"}
                    </button>
                    <button
                      onClick={() => openEditDialog(item)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "クイック入力を編集" : "クイック入力を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                名前 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="例: 海南食堂"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                説明（デフォルトの取引名）
              </label>
              <Input
                placeholder="例: 海南食堂でランチ"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                口座
              </label>
              <Select value={formAccountId} onValueChange={setFormAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="口座を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                種別
              </label>
              <Select value={formLineType} onValueChange={setFormLineType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">支出</SelectItem>
                  <SelectItem value="income">収入</SelectItem>
                  <SelectItem value="asset">立替</SelectItem>
                  <SelectItem value="liability">借入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                カテゴリ
              </label>
              <CategoryPicker
                categories={categories}
                selectedId={formCategoryId}
                onSelect={setFormCategoryId}
                type={categoryType}
              />
            </div>
            {(formLineType === "asset" || formLineType === "liability") && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  相手先
                </label>
                <Input
                  placeholder="例: けいすけ"
                  value={formCounterparty}
                  onChange={(e) => setFormCounterparty(e.target.value)}
                />
              </div>
            )}
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>クイック入力を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
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

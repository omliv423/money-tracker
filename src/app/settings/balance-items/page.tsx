"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Trash2, Building, Car, Landmark, PiggyBank, CreditCard } from "lucide-react";
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

type BalanceItem = Tables<"balance_items">;

const itemTypes = [
  { value: "asset", label: "資産" },
  { value: "liability", label: "負債" },
];

const assetCategories = [
  { value: "investment", label: "投資（株・投信）", icon: TrendingUp },
  { value: "real_estate", label: "不動産", icon: Building },
  { value: "vehicle", label: "車・バイク", icon: Car },
  { value: "savings", label: "貯蓄性保険", icon: PiggyBank },
  { value: "other_asset", label: "その他資産", icon: Landmark },
];

const liabilityCategories = [
  { value: "mortgage", label: "住宅ローン", icon: Building },
  { value: "car_loan", label: "カーローン", icon: Car },
  { value: "education_loan", label: "教育ローン", icon: Landmark },
  { value: "credit", label: "クレジット残債", icon: CreditCard },
  { value: "other_liability", label: "その他負債", icon: TrendingDown },
];

const getCategoryIcon = (category: string | null) => {
  const allCategories = [...assetCategories, ...liabilityCategories];
  const found = allCategories.find(c => c.value === category);
  return found?.icon || Landmark;
};

const getCategoryLabel = (category: string | null) => {
  const allCategories = [...assetCategories, ...liabilityCategories];
  const found = allCategories.find(c => c.value === category);
  return found?.label || category || "未分類";
};

export default function BalanceItemsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<BalanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<BalanceItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("asset");
  const [formCategory, setFormCategory] = useState("");
  const [formBalance, setFormBalance] = useState("");
  const [formBalanceDate, setFormBalanceDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("balance_items")
      .select("*")
      .order("item_type")
      .order("name");

    if (data) {
      setItems(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormType("asset");
    setFormCategory("");
    setFormBalance("");
    setFormBalanceDate("");
    setFormNote("");
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formBalance) return;

    setIsSaving(true);
    await supabase.from("balance_items").insert({
      user_id: user?.id,
      name: formName.trim(),
      item_type: formType,
      category: formCategory || null,
      balance: parseInt(formBalance),
      balance_date: formBalanceDate || null,
      note: formNote || null,
    });

    resetForm();
    setShowAddDialog(false);
    setIsSaving(false);
    fetchItems();
  };

  const handleEdit = (item: BalanceItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormType(item.item_type);
    setFormCategory(item.category || "");
    setFormBalance(item.balance.toString());
    setFormBalanceDate(item.balance_date || "");
    setFormNote(item.note || "");
  };

  const handleSaveEdit = async () => {
    if (!editItem || !formName.trim() || !formBalance) return;

    setIsSaving(true);
    await supabase
      .from("balance_items")
      .update({
        name: formName.trim(),
        item_type: formType,
        category: formCategory || null,
        balance: parseInt(formBalance),
        balance_date: formBalanceDate || null,
        note: formNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editItem.id);

    resetForm();
    setEditItem(null);
    setIsSaving(false);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    await supabase.from("balance_items").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchItems();
  };

  const assets = items.filter(i => i.item_type === "asset" && i.is_active);
  const liabilities = items.filter(i => i.item_type === "liability" && i.is_active);
  const totalAssets = assets.reduce((sum, i) => sum + i.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, i) => sum + i.balance, 0);

  const categories = formType === "asset" ? assetCategories : liabilityCategories;

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

  const FormContent = () => (
    <div className="space-y-4 pt-4">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">種類</label>
        <Select value={formType} onValueChange={(v) => { setFormType(v); setFormCategory(""); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itemTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">名前</label>
        <Input
          placeholder="例: 住宅ローン、投資信託"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">カテゴリ</label>
        <Select value={formCategory} onValueChange={setFormCategory}>
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          残高（{formType === "asset" ? "資産額" : "借入残高"}）
        </label>
        <Input
          type="number"
          placeholder="0"
          value={formBalance}
          onChange={(e) => setFormBalance(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">残高基準日</label>
        <Input
          type="date"
          value={formBalanceDate}
          onChange={(e) => setFormBalanceDate(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">メモ（任意）</label>
        <Input
          placeholder="メモ"
          value={formNote}
          onChange={(e) => setFormNote(e.target.value)}
        />
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
            <h1 className="font-heading text-xl font-bold">資産・負債</h1>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          投資や住宅ローンなど、日常取引以外の資産・負債を登録できます。
          ここで登録した内容はBS（貸借対照表）に反映されます。
        </p>

        {/* Assets */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            資産
          </h2>
          {assets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              資産の登録なし
            </p>
          ) : (
            <div className="space-y-2">
              {assets.map((item, index) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleEdit(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-income" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(item.category)}
                            {item.balance_date && ` (${item.balance_date})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="font-heading font-bold tabular-nums text-income">
                          ¥{item.balance.toLocaleString("ja-JP")}
                        </span>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Liabilities */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            負債
          </h2>
          {liabilities.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              負債の登録なし
            </p>
          ) : (
            <div className="space-y-2">
              {liabilities.map((item, index) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleEdit(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-expense" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(item.category)}
                            {item.balance_date && ` (${item.balance_date})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="font-heading font-bold tabular-nums text-expense">
                          ¥{item.balance.toLocaleString("ja-JP")}
                        </span>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>資産・負債を追加</DialogTitle>
          </DialogHeader>
          <FormContent />
          <Button
            onClick={handleAdd}
            disabled={!formName.trim() || !formBalance || isSaving}
            className="w-full mt-4"
          >
            {isSaving ? "保存中..." : "追加する"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>資産・負債を編集</DialogTitle>
          </DialogHeader>
          <FormContent />
          <Button
            onClick={handleSaveEdit}
            disabled={!formName.trim() || !formBalance || isSaving}
            className="w-full mt-4"
          >
            {isSaving ? "保存中..." : "保存する"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除しますか？</AlertDialogTitle>
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

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Counterparty = Tables<"counterparties">;

export default function CounterpartiesSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCounterparties = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("counterparties")
      .select("*")
      .order("name");

    if (data) {
      setCounterparties(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCounterparties();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    await supabase.from("counterparties").insert({
      user_id: user?.id,
      name: newName.trim(),
    });

    setNewName("");
    setShowAddDialog(false);
    setIsSaving(false);
    fetchCounterparties();
  };

  const handleToggleActive = async (counterparty: Counterparty) => {
    await supabase
      .from("counterparties")
      .update({ is_active: !counterparty.is_active })
      .eq("id", counterparty.id);
    fetchCounterparties();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    await supabase.from("counterparties").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchCounterparties();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading text-xl font-bold">相手先管理</h1>
              <p className="text-xs text-muted-foreground">立替・精算の相手を管理</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Counterparties List */}
        {counterparties.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>相手先がありません</p>
            <p className="text-sm mt-1">よく利用する店舗やサービスを登録しましょう</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <AnimatePresence>
              {counterparties.map((counterparty, index) => (
                <motion.div
                  key={counterparty.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`bg-card rounded-xl p-4 border border-border ${
                    !counterparty.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{counterparty.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(counterparty)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          counterparty.is_active
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {counterparty.is_active ? "有効" : "無効"}
                      </button>
                      <button
                        onClick={() => setDeleteId(counterparty.id)}
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
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>相手先を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">名前</label>
              <Input
                placeholder="例: Amazon、コンビニ、スーパー"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
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
            <AlertDialogTitle>相手先を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この相手先を使用している取引がある場合は削除できません。
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

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, RefreshCw, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";

type RecurringTransaction = {
  id: string;
  name: string;
  description: string | null;
  account_id: string | null;
  total_amount: number;
  day_of_month: number | null;
  payment_delay_days: number;
  is_active: boolean;
  account?: { name: string } | null;
};

export default function RecurringTransactionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("recurring_transactions")
      .select(`
        id, name, description, account_id, total_amount,
        day_of_month, payment_delay_days, is_active,
        account:accounts(name)
      `)
      .eq("user_id", user?.id ?? "")
      .order("day_of_month", { ascending: true });

    if (data) {
      setItems(data as RecurringTransaction[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [user?.id]);

  const handleToggleActive = async (item: RecurringTransaction) => {
    await supabase
      .from("recurring_transactions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("recurring_transactions").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchItems();
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
            <h1 className="font-heading text-xl font-bold">定期取引</h1>
          </div>
          <Link href="/settings/recurring/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </Link>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>定期取引がありません</p>
            <p className="text-sm mt-1">毎月の固定費を登録しましょう</p>
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
                    <RefreshCw className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>毎月{item.day_of_month || "?"}日</span>
                        <span>•</span>
                        <span className="font-mono">
                          ¥{item.total_amount.toLocaleString()}
                        </span>
                        {item.account && (
                          <>
                            <span>•</span>
                            <span>{item.account.name}</span>
                          </>
                        )}
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
                    <Link
                      href={`/settings/recurring/${item.id}`}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>定期取引を削除しますか？</AlertDialogTitle>
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

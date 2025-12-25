"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChevronRight, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
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

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  account: { name: string } | null;
}

interface GroupedTransactions {
  date: string;
  transactions: Transaction[];
}

export default function TransactionsPage() {
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransactions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id,
        date,
        payment_date,
        description,
        total_amount,
        account:accounts(name)
      `)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching transactions:", error);
      setIsLoading(false);
      return;
    }

    // Group by date
    const grouped: Map<string, Transaction[]> = new Map();
    (data || []).forEach((tx) => {
      const dateKey = tx.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(tx as Transaction);
    });

    const result: GroupedTransactions[] = [];
    grouped.forEach((transactions, date) => {
      result.push({ date, transactions });
    });

    setGroupedTransactions(result);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    // Delete transaction lines first (due to foreign key)
    await supabase
      .from("transaction_lines")
      .delete()
      .eq("transaction_id", deleteId);

    // Then delete transaction
    await supabase
      .from("transactions")
      .delete()
      .eq("id", deleteId);

    setDeleteId(null);
    fetchTransactions();
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
        <h1 className="font-heading text-2xl font-bold">取引一覧</h1>

        {groupedTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>取引がありません</p>
            <p className="text-sm mt-2">記録画面から取引を追加してください</p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {groupedTransactions.map((group, groupIndex) => (
                <motion.div
                  key={group.date}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.05 }}
                >
                  {/* Date Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(group.date), "yyyy年M月d日(E)", { locale: ja })}
                    </span>
                  </div>

                  {/* Transactions */}
                  <div className="space-y-2">
                    {group.transactions.map((tx) => (
                      <motion.div
                        key={tx.id}
                        layout
                        className="bg-card rounded-xl border border-border overflow-hidden"
                      >
                        <div className="flex items-center">
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="flex-1 p-4 hover:bg-accent transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <p className="font-medium">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {tx.account?.name || "不明"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-heading font-bold tabular-nums text-expense">
                                  -¥{tx.total_amount.toLocaleString("ja-JP")}
                                </span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          </Link>
                          <button
                            onClick={() => setDeleteId(tx.id)}
                            className="p-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。取引と関連する明細がすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

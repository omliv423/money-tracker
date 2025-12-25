"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { CreditCard, Check, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
}

interface AccountPayable {
  accountId: string;
  accountName: string;
  totalAmount: number;
  transactions: Transaction[];
}

export default function CashSettlementsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [payablesByAccount, setPayablesByAccount] = useState<AccountPayable[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: unpaidTransactions } = await supabase
      .from("transactions")
      .select(`
        id,
        date,
        payment_date,
        description,
        total_amount,
        account:accounts(id, name)
      `)
      .eq("is_cash_settled", false)
      .order("date", { ascending: false });

    const accountPayableMap = new Map<string, AccountPayable>();

    (unpaidTransactions || []).forEach((tx: any) => {
      if (!tx.account) return;

      const accountId = tx.account.id;
      const accountName = tx.account.name;

      if (!accountPayableMap.has(accountId)) {
        accountPayableMap.set(accountId, {
          accountId,
          accountName,
          totalAmount: 0,
          transactions: [],
        });
      }

      const payable = accountPayableMap.get(accountId)!;
      payable.totalAmount += tx.total_amount;
      payable.transactions.push({
        id: tx.id,
        date: tx.date,
        payment_date: tx.payment_date,
        description: tx.description,
        total_amount: tx.total_amount,
      });
    });

    setPayablesByAccount(Array.from(accountPayableMap.values()));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const toggleTransactionSelection = (txId: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  const selectAllForAccount = (accountId: string) => {
    const account = payablesByAccount.find((a) => a.accountId === accountId);
    if (!account) return;

    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      account.transactions.forEach((tx) => next.add(tx.id));
      return next;
    });
  };

  const handleSettle = async () => {
    if (selectedTransactions.size === 0) return;

    setIsSettling(true);

    const ids = Array.from(selectedTransactions);
    await supabase
      .from("transactions")
      .update({ is_cash_settled: true })
      .in("id", ids);

    setSelectedTransactions(new Set());
    setIsSettling(false);
    fetchData();
  };

  const selectedTotal = payablesByAccount.reduce((sum, account) => {
    return sum + account.transactions
      .filter((tx) => selectedTransactions.has(tx.id))
      .reduce((s, tx) => s + tx.total_amount, 0);
  }, 0);

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
        <div>
          <h1 className="font-heading text-2xl font-bold">カード決済消し込み</h1>
          <p className="text-sm text-muted-foreground mt-1">
            カードから引き落とされた取引を消し込み
          </p>
        </div>

        {payablesByAccount.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>未払いの取引はありません</p>
          </div>
        ) : (
          <>
            {/* Accounts with unpaid transactions */}
            <div className="space-y-3">
              {payablesByAccount.map((account, index) => {
                const isExpanded = expandedAccounts.has(account.accountId);
                const selectedCount = account.transactions.filter(
                  (tx) => selectedTransactions.has(tx.id)
                ).length;

                return (
                  <motion.div
                    key={account.accountId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    {/* Account Header */}
                    <button
                      onClick={() => toggleAccountExpand(account.accountId)}
                      className="w-full p-4 flex justify-between items-center hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">{account.accountName}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.transactions.length}件
                            {selectedCount > 0 && (
                              <span className="text-primary ml-2">
                                ({selectedCount}件選択中)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold tabular-nums text-expense">
                          ¥{account.totalAmount.toLocaleString("ja-JP")}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Transactions List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 space-y-3 bg-secondary/30">
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">取引を選択</p>
                              <button
                                onClick={() => selectAllForAccount(account.accountId)}
                                className="text-xs text-primary hover:underline"
                              >
                                すべて選択
                              </button>
                            </div>

                            {account.transactions.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
                              >
                                <Checkbox
                                  checked={selectedTransactions.has(tx.id)}
                                  onCheckedChange={() => toggleTransactionSelection(tx.id)}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{tx.description}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {format(new Date(tx.date), "M/d", { locale: ja })}
                                    </span>
                                    {tx.payment_date && tx.payment_date !== tx.date && (
                                      <>
                                        <span>→</span>
                                        <span>
                                          {format(new Date(tx.payment_date), "M/d", { locale: ja })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <span className="font-heading font-bold tabular-nums text-sm">
                                  ¥{tx.total_amount.toLocaleString("ja-JP")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Settle Button */}
            {selectedTransactions.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border"
              >
                <div className="max-w-lg mx-auto">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedTransactions.size}件選択
                    </span>
                    <span className="font-heading font-bold tabular-nums">
                      ¥{selectedTotal.toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <Button
                    onClick={handleSettle}
                    disabled={isSettling}
                    className="w-full"
                    size="lg"
                  >
                    {isSettling ? (
                      "処理中..."
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        消し込む
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

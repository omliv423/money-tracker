"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { CreditCard, Check, ChevronDown, ChevronRight, Calendar, Wallet, ArrowDownLeft, ArrowUpRight, Undo2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Account = Tables<"accounts">;

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  settled_amount: number;
  type: "payable" | "receivable";
}

interface AccountGroup {
  accountId: string;
  accountName: string;
  totalAmount: number;
  transactions: Transaction[];
  type: "payable" | "receivable";
}

export default function CashSettlementsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [settledAccountGroups, setSettledAccountGroups] = useState<AccountGroup[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);
  const [activeTab, setActiveTab] = useState<"payable" | "receivable">("payable");
  const [statusTab, setStatusTab] = useState<"unsettled" | "settled">("unsettled");

  // 現預金口座（消し込み時の入出金先）
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>("");

  // 消し込み日（デフォルトは今日）
  const [settlementDate, setSettlementDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // 一部消し込み用のダイアログ状態
  const [partialSettleDialog, setPartialSettleDialog] = useState<{
    open: boolean;
    transaction: Transaction | null;
  }>({ open: false, transaction: null });
  const [partialAmount, setPartialAmount] = useState("");
  const [partialCashAccountId, setPartialCashAccountId] = useState<string>("");
  const [partialSettlementDate, setPartialSettlementDate] = useState<string>("");

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch both unsettled, settled transactions and cash accounts in parallel
    const userId = user?.id ?? "";
    const [unsettledResponse, settledResponse, accountsResponse] = await Promise.all([
      supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          settled_amount,
          account:accounts!transactions_account_id_fkey(id, name),
          transaction_lines(line_type, amount)
        `)
        .eq("is_cash_settled", false)
        .eq("user_id", userId)
        .order("date", { ascending: false }),
      supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          settled_amount,
          account:accounts!transactions_account_id_fkey(id, name),
          transaction_lines(line_type, amount)
        `)
        .eq("is_cash_settled", true)
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(100),
      supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .eq("user_id", userId)
        .order("name"),
    ]);

    const unpaidTransactions = unsettledResponse.data;
    const settledTransactions = settledResponse.data;

    // Set cash accounts
    if (accountsResponse.data) {
      setCashAccounts(accountsResponse.data);
      // Set default selected cash account if not already set
      if (!selectedCashAccountId && accountsResponse.data.length > 0) {
        setSelectedCashAccountId(accountsResponse.data[0].id);
      }
    }

    // Helper function to process transactions (for settled - show all)
    const processTransactions = (transactions: any[]) => {
      const payableMap = new Map<string, AccountGroup>();
      const receivableMap = new Map<string, AccountGroup>();

      transactions.forEach((tx: any) => {
        if (!tx.account) return;

        const accountId = tx.account.id;
        const accountName = tx.account.name;

        // 金額ベースで未払金か未収金かを判定
        // 未収金: 収入（売上等）、資産（立替金＝相手が返す）
        // 未払金: 支出（費用）、負債（借入＝自分が返す）
        let totalReceivable = 0;  // 入金予定（収入・立替金）
        let totalPayable = 0;     // 出金予定（支出・借入）

        (tx.transaction_lines || []).forEach((line: any) => {
          if (line.line_type === "income" || line.line_type === "asset") {
            totalReceivable += line.amount || 0;
          } else if (line.line_type === "expense" || line.line_type === "liability") {
            totalPayable += line.amount || 0;
          }
        });

        // 入金予定 > 出金予定 なら未収金、それ以外は未払金
        let txType: "payable" | "receivable" = totalReceivable > totalPayable ? "receivable" : "payable";

        const mapKey = `${txType}-${accountId}`;
        const targetMap = txType === "payable" ? payableMap : receivableMap;

        if (!targetMap.has(mapKey)) {
          targetMap.set(mapKey, {
            accountId,
            accountName,
            totalAmount: 0,
            transactions: [],
            type: txType,
          });
        }
        const group = targetMap.get(mapKey)!;
        group.totalAmount += tx.total_amount;
        group.transactions.push({
          id: tx.id,
          date: tx.date,
          payment_date: tx.payment_date,
          description: tx.description,
          total_amount: tx.total_amount,
          settled_amount: tx.settled_amount || 0,
          type: txType,
        });
      });

      return [
        ...Array.from(payableMap.values()),
        ...Array.from(receivableMap.values()),
      ];
    };

    // Process unsettled transactions (with remaining amount calculation)
    const payableMap = new Map<string, AccountGroup>();
    const receivableMap = new Map<string, AccountGroup>();

    (unpaidTransactions || []).forEach((tx: any) => {
      if (!tx.account) return;

      const accountId = tx.account.id;
      const accountName = tx.account.name;

      // 金額ベースで未払金か未収金かを判定
      // 未収金: 収入（売上等）、資産（立替金＝相手が返す）
      // 未払金: 支出（費用）、負債（借入＝自分が返す）
      let totalReceivable = 0;  // 入金予定（収入・立替金）
      let totalPayable = 0;     // 出金予定（支出・借入）

      (tx.transaction_lines || []).forEach((line: any) => {
        if (line.line_type === "income" || line.line_type === "asset") {
          totalReceivable += line.amount || 0;
        } else if (line.line_type === "expense" || line.line_type === "liability") {
          totalPayable += line.amount || 0;
        }
      });

      // 入金予定 > 出金予定 なら未収金、それ以外は未払金
      let txType: "payable" | "receivable" = totalReceivable > totalPayable ? "receivable" : "payable";

      const mapKey = `${txType}-${accountId}`;
      const targetMap = txType === "payable" ? payableMap : receivableMap;

      if (!targetMap.has(mapKey)) {
        targetMap.set(mapKey, {
          accountId,
          accountName,
          totalAmount: 0,
          transactions: [],
          type: txType,
        });
      }
      const group = targetMap.get(mapKey)!;
      const remainingAmount = tx.total_amount - (tx.settled_amount || 0);
      group.totalAmount += remainingAmount;
      group.transactions.push({
        id: tx.id,
        date: tx.date,
        payment_date: tx.payment_date,
        description: tx.description,
        total_amount: tx.total_amount,
        settled_amount: tx.settled_amount || 0,
        type: txType,
      });
    });

    const allUnsettledGroups = [
      ...Array.from(payableMap.values()),
      ...Array.from(receivableMap.values()),
    ];
    setAccountGroups(allUnsettledGroups);

    // Process settled transactions
    setSettledAccountGroups(processTransactions(settledTransactions || []));

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleAccountExpand = (groupKey: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
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

  const selectAllForAccount = (groupKey: string) => {
    const group = filteredGroups.find((g) => `${g.type}-${g.accountId}` === groupKey);
    if (!group) return;

    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      group.transactions.forEach((tx) => next.add(tx.id));
      return next;
    });
  };

  // 全額消し込み
  const handleSettle = async () => {
    if (selectedTransactions.size === 0) return;

    setIsSettling(true);

    const ids = Array.from(selectedTransactions);
    let totalSettleAmount = 0;

    // 選択された取引を全額消し込み
    for (const id of ids) {
      const tx = accountGroups
        .flatMap((g) => g.transactions)
        .find((t) => t.id === id);
      if (tx) {
        const remainingAmount = tx.total_amount - tx.settled_amount;
        totalSettleAmount += remainingAmount;

        await supabase
          .from("transactions")
          .update({
            settled_amount: tx.total_amount,
            is_cash_settled: true,
            settlement_account_id: selectedCashAccountId || null,
            settlement_date: settlementDate,
          })
          .eq("id", id);
      }
    }

    // 現預金口座の残高を更新
    if (selectedCashAccountId && totalSettleAmount > 0) {
      const selectedAccount = cashAccounts.find((a) => a.id === selectedCashAccountId);
      if (selectedAccount) {
        // current_balance がなければ opening_balance を初期値として使用
        const currentBalance = selectedAccount.current_balance ?? selectedAccount.opening_balance ?? 0;
        // 未払金 → 引き落とし (マイナス), 未収金 → 入金 (プラス)
        const newBalance = activeTab === "payable"
          ? currentBalance - totalSettleAmount
          : currentBalance + totalSettleAmount;

        await supabase
          .from("accounts")
          .update({ current_balance: newBalance })
          .eq("id", selectedCashAccountId);
      }
    }

    setSelectedTransactions(new Set());
    setIsSettling(false);
    fetchData();
  };

  // 一部消し込みダイアログを開く
  const openPartialSettleDialog = (tx: Transaction, defaultAmount?: number) => {
    setPartialSettleDialog({ open: true, transaction: tx });
    setPartialAmount(defaultAmount?.toString() || "");
    setPartialCashAccountId("");
    // デフォルトは支払予定日、なければ今日
    setPartialSettlementDate(tx.payment_date || new Date().toISOString().split("T")[0]);
  };

  // 一部消し込み
  const handlePartialSettle = async () => {
    if (!partialSettleDialog.transaction || !partialAmount) return;

    setIsSettling(true);
    const amount = parseInt(partialAmount, 10);
    const tx = partialSettleDialog.transaction;
    const newSettledAmount = tx.settled_amount + amount;

    // 全額消し込みかどうか判定
    const isFullySettled = newSettledAmount >= tx.total_amount;

    const cashAccountId = partialCashAccountId || selectedCashAccountId;

    await supabase
      .from("transactions")
      .update({
        settled_amount: newSettledAmount,
        is_cash_settled: isFullySettled,
        settlement_account_id: cashAccountId || null,
        settlement_date: partialSettlementDate || new Date().toISOString().split("T")[0],
      })
      .eq("id", tx.id);

    // 現預金口座の残高を更新
    if (cashAccountId && amount > 0) {
      const selectedAccount = cashAccounts.find((a) => a.id === cashAccountId);
      if (selectedAccount) {
        // current_balance がなければ opening_balance を初期値として使用
        const currentBalance = selectedAccount.current_balance ?? selectedAccount.opening_balance ?? 0;
        // 未払金 → 引き落とし (マイナス), 未収金 → 入金 (プラス)
        const newBalance = tx.type === "payable"
          ? currentBalance - amount
          : currentBalance + amount;

        await supabase
          .from("accounts")
          .update({ current_balance: newBalance })
          .eq("id", cashAccountId);
      }
    }

    setPartialSettleDialog({ open: false, transaction: null });
    setPartialAmount("");
    setPartialCashAccountId("");
    setPartialSettlementDate("");
    setIsSettling(false);
    fetchData();
  };

  // 消し込み取消（単一）
  const handleUnsettle = async (txId: string) => {
    setIsSettling(true);
    await supabase
      .from("transactions")
      .update({
        settled_amount: 0,
        is_cash_settled: false,
      })
      .eq("id", txId);
    setIsSettling(false);
    fetchData();
  };

  // 一括消し込み取消
  const handleBulkUnsettle = async () => {
    if (selectedTransactions.size === 0) return;

    setIsSettling(true);
    const ids = Array.from(selectedTransactions);

    for (const id of ids) {
      await supabase
        .from("transactions")
        .update({
          settled_amount: 0,
          is_cash_settled: false,
        })
        .eq("id", id);
    }

    setSelectedTransactions(new Set());
    setIsSettling(false);
    fetchData();
  };

  // フィルタリングされたグループ
  const currentGroups = statusTab === "unsettled" ? accountGroups : settledAccountGroups;
  const filteredGroups = currentGroups.filter((g) => g.type === activeTab);

  const selectedTotal = filteredGroups.reduce((sum, group) => {
    return sum + group.transactions
      .filter((tx) => selectedTransactions.has(tx.id))
      .reduce((s, tx) => s + (tx.total_amount - tx.settled_amount), 0);
  }, 0);

  // 合計額
  const totalPayables = currentGroups
    .filter((g) => g.type === "payable")
    .reduce((sum, g) => sum + g.totalAmount, 0);
  const totalReceivables = currentGroups
    .filter((g) => g.type === "receivable")
    .reduce((sum, g) => sum + g.totalAmount, 0);

  // 期限超過の取引数をカウント
  const today = new Date().toISOString().split("T")[0];
  const overdueCount = accountGroups
    .flatMap((g) => g.transactions)
    .filter((tx) => tx.payment_date && tx.payment_date < today)
    .length;

  // 取引が期限超過かどうかを判定するヘルパー関数
  const isOverdue = (tx: Transaction) => {
    return tx.payment_date && tx.payment_date < today;
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
        <div>
          <h1 className="font-heading text-2xl font-bold">入出金消し込み</h1>
          <p className="text-sm text-muted-foreground mt-1">
            入金・引き落とし済みの取引を消し込み
          </p>
        </div>

        <div className="space-y-6 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-6 lg:space-y-0">
          <div className="space-y-6">
            {/* Status Tab */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => {
                  setStatusTab("unsettled");
                  setSelectedTransactions(new Set());
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  statusTab === "unsettled"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } flex items-center justify-center gap-2`}
              >
                未消し込み
                {overdueCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {overdueCount > 9 ? "9+" : overdueCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setStatusTab("settled");
                  setSelectedTransactions(new Set());
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  statusTab === "settled"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                消し込み済み
              </button>
            </div>

            {/* Type Tab */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveTab("payable");
                  setSelectedTransactions(new Set());
                }}
                className={`p-3 rounded-xl border transition-colors flex items-center justify-center gap-2 ${
                  activeTab === "payable"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-accent"
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">{statusTab === "unsettled" ? "未払金" : "支払済"}</p>
                  <p className={`text-xs ${activeTab === "payable" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    ¥{totalPayables.toLocaleString("ja-JP")}
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("receivable");
                  setSelectedTransactions(new Set());
                }}
                className={`p-3 rounded-xl border transition-colors flex items-center justify-center gap-2 ${
                  activeTab === "receivable"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-accent"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">{statusTab === "unsettled" ? "未収金" : "入金済"}</p>
                  <p className={`text-xs ${activeTab === "receivable" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    ¥{totalReceivables.toLocaleString("ja-JP")}
                  </p>
                </div>
              </button>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {statusTab === "unsettled" ? (
                  activeTab === "payable" ? (
                    <>
                      <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>未払いの取引はありません</p>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>未収の取引はありません</p>
                    </>
                  )
                ) : (
                  activeTab === "payable" ? (
                    <>
                      <Check className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>支払済の取引はありません</p>
                    </>
                  ) : (
                    <>
                      <Check className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>入金済の取引はありません</p>
                    </>
                  )
                )}
              </div>
            ) : (
              <>
                {/* Accounts with transactions */}
                <div className="space-y-3">
                  {filteredGroups.map((group, index) => {
                    const groupKey = `${group.type}-${group.accountId}`;
                    const isExpanded = expandedAccounts.has(groupKey);
                    const selectedCount = group.transactions.filter(
                      (tx) => selectedTransactions.has(tx.id)
                    ).length;

                    return (
                      <motion.div
                        key={groupKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-card rounded-xl border border-border overflow-hidden"
                      >
                        {/* Account Header */}
                        <button
                          onClick={() => toggleAccountExpand(groupKey)}
                          className="w-full p-4 flex justify-between items-center hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {group.type === "payable" ? (
                              <CreditCard className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <Wallet className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div className="text-left">
                              <p className="font-medium">{group.accountName}</p>
                              <p className="text-xs text-muted-foreground">
                                {group.transactions.length}件
                                {selectedCount > 0 && (
                                  <span className="text-primary ml-2">
                                    ({selectedCount}件選択中)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-heading font-bold tabular-nums ${
                              group.type === "payable" ? "text-expense" : "text-income"
                            }`}>
                              ¥{group.totalAmount.toLocaleString("ja-JP")}
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
                                    onClick={() => selectAllForAccount(groupKey)}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    すべて選択
                                  </button>
                                </div>

                                {group.transactions.map((tx) => {
                                  const remainingAmount = tx.total_amount - tx.settled_amount;
                                  const txOverdue = statusTab === "unsettled" && isOverdue(tx);
                                  return (
                                    <div
                                      key={tx.id}
                                      className={`p-3 bg-card rounded-lg border ${
                                        txOverdue
                                          ? "border-amber-500/50 bg-amber-500/5"
                                          : "border-border"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={selectedTransactions.has(tx.id)}
                                          onCheckedChange={() => toggleTransactionSelection(tx.id)}
                                        />
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{tx.description}</p>
                                            {txOverdue && (
                                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                              {format(new Date(tx.date), "M/d", { locale: ja })}
                                            </span>
                                            {tx.payment_date && tx.payment_date !== tx.date && (
                                              <>
                                                <span>→</span>
                                                <span className={txOverdue ? "text-amber-600 font-medium" : ""}>
                                                  {format(new Date(tx.payment_date), "M/d", { locale: ja })}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-heading font-bold tabular-nums text-sm">
                                            ¥{statusTab === "unsettled" ? remainingAmount.toLocaleString("ja-JP") : tx.total_amount.toLocaleString("ja-JP")}
                                          </span>
                                          {statusTab === "unsettled" && tx.settled_amount > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              消込済: ¥{tx.settled_amount.toLocaleString("ja-JP")}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {/* 一部消し込みボタン / 取消ボタン */}
                                      <div className="mt-2 flex justify-end">
                                        {statusTab === "unsettled" ? (
                                          <button
                                            onClick={() => openPartialSettleDialog(tx, remainingAmount)}
                                            className="text-xs text-primary hover:underline"
                                          >
                                            一部消し込み
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleUnsettle(tx.id)}
                                            disabled={isSettling}
                                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                                          >
                                            <Undo2 className="w-3 h-3" />
                                            消し込み取消
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Settle/Unsettle Button */}
                {selectedTransactions.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border md:hidden"
                  >
                <div className="max-w-lg mx-auto space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedTransactions.size}件選択
                    </span>
                    <span className="font-heading font-bold tabular-nums">
                      ¥{selectedTotal.toLocaleString("ja-JP")}
                    </span>
                  </div>

                  {/* Cash Account Selector and Date - only for unsettled */}
                  {statusTab === "unsettled" && (
                    <>
                      {cashAccounts.length > 0 && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            {activeTab === "payable" ? "引き落とし口座" : "入金口座"}
                          </label>
                          <Select
                            value={selectedCashAccountId}
                            onValueChange={setSelectedCashAccountId}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="口座を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.name} (¥{(acc.current_balance ?? acc.opening_balance ?? 0).toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {activeTab === "payable" ? "引き落とし日" : "入金日"}
                        </label>
                        <Input
                          type="date"
                          value={settlementDate}
                          onChange={(e) => setSettlementDate(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </>
                  )}

                  {statusTab === "unsettled" ? (
                    <Button
                      onClick={handleSettle}
                      disabled={isSettling || (cashAccounts.length > 0 && !selectedCashAccountId)}
                      className="w-full"
                      size="lg"
                    >
                      {isSettling ? (
                        "処理中..."
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          全額消し込む
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBulkUnsettle}
                      disabled={isSettling}
                      variant="destructive"
                      className="w-full"
                      size="lg"
                    >
                      {isSettling ? (
                        "処理中..."
                      ) : (
                        <>
                          <Undo2 className="w-4 h-4 mr-2" />
                          消し込み取消
                        </>
                      )}
                    </Button>
                  )}
                </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="grid gap-3">
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground">未払金 合計</p>
                <p className="font-heading text-lg font-bold text-expense tabular-nums">
                  ¥{totalPayables.toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground">未収金 合計</p>
                <p className="font-heading text-lg font-bold text-income tabular-nums">
                  ¥{totalReceivables.toLocaleString("ja-JP")}
                </p>
              </div>
            </div>

            {selectedTransactions.size > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {selectedTransactions.size}件選択
                  </span>
                  <span className="font-heading font-bold tabular-nums">
                    ¥{selectedTotal.toLocaleString("ja-JP")}
                  </span>
                </div>

                {statusTab === "unsettled" && (
                  <>
                    {cashAccounts.length > 0 && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {activeTab === "payable" ? "引き落とし口座" : "入金口座"}
                        </label>
                        <Select
                          value={selectedCashAccountId}
                          onValueChange={setSelectedCashAccountId}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="口座を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {cashAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} (¥{(acc.current_balance ?? acc.opening_balance ?? 0).toLocaleString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {activeTab === "payable" ? "引き落とし日" : "入金日"}
                      </label>
                      <Input
                        type="date"
                        value={settlementDate}
                        onChange={(e) => setSettlementDate(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </>
                )}

                {statusTab === "unsettled" ? (
                  <Button
                    onClick={handleSettle}
                    disabled={isSettling || (cashAccounts.length > 0 && !selectedCashAccountId)}
                    className="w-full"
                    size="lg"
                  >
                    {isSettling ? (
                      "処理中..."
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        全額消し込む
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleBulkUnsettle}
                    disabled={isSettling}
                    variant="destructive"
                    className="w-full"
                    size="lg"
                  >
                    {isSettling ? (
                      "処理中..."
                    ) : (
                      <>
                        <Undo2 className="w-4 h-4 mr-2" />
                        消し込み取消
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 一部消し込みダイアログ */}
      <Dialog
        open={partialSettleDialog.open}
        onOpenChange={(open) => {
          setPartialSettleDialog({ open, transaction: partialSettleDialog.transaction });
          if (!open) {
            setPartialAmount("");
            setPartialCashAccountId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>一部消し込み</DialogTitle>
          </DialogHeader>
          {partialSettleDialog.transaction && (
            <div className="space-y-4 pt-4">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="font-medium">{partialSettleDialog.transaction.description}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  合計: ¥{partialSettleDialog.transaction.total_amount.toLocaleString("ja-JP")}
                  {partialSettleDialog.transaction.settled_amount > 0 && (
                    <span className="ml-2">
                      (消込済: ¥{partialSettleDialog.transaction.settled_amount.toLocaleString("ja-JP")})
                    </span>
                  )}
                </p>
                <p className="text-sm font-medium mt-1">
                  残額: ¥{(partialSettleDialog.transaction.total_amount - partialSettleDialog.transaction.settled_amount).toLocaleString("ja-JP")}
                </p>
              </div>

              {/* Cash Account Selector for Partial Settle */}
              {cashAccounts.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    {partialSettleDialog.transaction.type === "payable" ? "引き落とし口座" : "入金口座"}
                  </label>
                  <Select
                    value={partialCashAccountId || selectedCashAccountId}
                    onValueChange={setPartialCashAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="口座を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} (¥{(acc.current_balance ?? acc.opening_balance ?? 0).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {partialSettleDialog.transaction.type === "payable" ? "引き落とし日" : "入金日"}
                </label>
                <Input
                  type="date"
                  value={partialSettlementDate}
                  onChange={(e) => setPartialSettlementDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">消し込み金額</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">¥</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
              <Button
                onClick={handlePartialSettle}
                disabled={!partialAmount || parseInt(partialAmount, 10) <= 0 || isSettling}
                className="w-full"
              >
                {isSettling ? "処理中..." : "消し込む"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

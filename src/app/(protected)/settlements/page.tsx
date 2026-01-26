"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, ChevronDown, ChevronUp, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type Account = Tables<"accounts">;
type SettlementBalance = Tables<"settlement_balances">;

interface UnsettledLine {
  id: string;
  date: string;
  description: string;
  amount: number;
  settledAmount: number;
  unsettledAmount: number;
  lineType: "asset" | "liability";
  counterparty: string;
}

interface CounterpartyData {
  counterparty: string;
  assetLines: UnsettledLine[];  // 立替（受取待ち）
  liabilityLines: UnsettledLine[];  // 借入（返済待ち）
  totalAsset: number;
  totalLiability: number;
  netAmount: number;  // 正: 受け取れる、負: 支払う
}

interface SettlementItem {
  id: string;
  amount: number;
  transaction_line: {
    id: string;
    amount: number;
    transaction: {
      date: string;
      description: string;
    } | null;
  } | null;
}

interface Settlement {
  id: string;
  date: string;
  counterparty: string;
  amount: number;
  note: string | null;
  settlement_items?: SettlementItem[];
}

export default function SettlementsPage() {
  const { user } = useAuth();
  const [counterpartyDataList, setCounterpartyDataList] = useState<CounterpartyData[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementBalances, setSettlementBalances] = useState<SettlementBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [expandedCounterparty, setExpandedCounterparty] = useState<string | null>(null);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);

  // 選択状態の管理
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  // Dialog states
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositType, setDepositType] = useState<"receive" | "pay">("receive");
  const [selectedCounterparty, setSelectedCounterparty] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 精算確認ダイアログ
  const [showSettleConfirmDialog, setShowSettleConfirmDialog] = useState(false);
  const [settleType, setSettleType] = useState<"asset" | "liability">("asset");
  const [settleCounterparty, setSettleCounterparty] = useState("");

  // Edit mode
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);

    // 現預金口座を取得
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (accountsData) {
      setCashAccounts(accountsData);
      if (!selectedAccountId && accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].id);
      }
    }

    // 精算可能金額を取得
    const { data: balancesData } = await supabase
      .from("settlement_balances")
      .select("*");

    if (balancesData) {
      setSettlementBalances(balancesData);
    }

    // 未精算の立替/借入を集計
    const { data: allLines } = await supabase
      .from("transaction_lines")
      .select(`
        id, counterparty, amount, line_type, is_settled, settled_amount,
        transaction:transactions(date, description)
      `)
      .not("counterparty", "is", null);

    if (allLines) {
      const counterpartyMap = new Map<string, CounterpartyData>();

      allLines.forEach((line: any) => {
        if (!line.counterparty) return;

        const settledAmount = line.settled_amount ?? 0;
        const unsettledAmount = line.is_settled && settledAmount === 0
          ? 0
          : line.amount - settledAmount;

        if (unsettledAmount <= 0) return;

        const current: CounterpartyData = counterpartyMap.get(line.counterparty) || {
          counterparty: line.counterparty,
          assetLines: [] as UnsettledLine[],
          liabilityLines: [] as UnsettledLine[],
          totalAsset: 0,
          totalLiability: 0,
          netAmount: 0,
        };

        const unsettledLine: UnsettledLine = {
          id: line.id,
          date: line.transaction?.date || "",
          description: line.transaction?.description || "",
          amount: line.amount,
          settledAmount: settledAmount,
          unsettledAmount: unsettledAmount,
          lineType: line.line_type === "asset" ? "asset" : "liability",
          counterparty: line.counterparty,
        };

        if (line.line_type === "asset") {
          current.assetLines.push(unsettledLine);
          current.totalAsset += unsettledAmount;
        } else {
          current.liabilityLines.push(unsettledLine);
          current.totalLiability += unsettledAmount;
        }

        current.netAmount = current.totalAsset - current.totalLiability;
        counterpartyMap.set(line.counterparty, current);
      });

      const dataList: CounterpartyData[] = [];
      counterpartyMap.forEach((value) => {
        if (value.totalAsset > 0 || value.totalLiability > 0) {
          value.assetLines.sort((a, b) => a.date.localeCompare(b.date));
          value.liabilityLines.sort((a, b) => a.date.localeCompare(b.date));
          dataList.push(value);
        }
      });
      setCounterpartyDataList(dataList.sort((a, b) => b.netAmount - a.netAmount));
    }

    // 精算履歴を取得
    const { data: settlementData } = await supabase
      .from("settlements")
      .select("*")
      .order("date", { ascending: false })
      .limit(20);

    if (settlementData) {
      const settlementsWithItems: Settlement[] = await Promise.all(
        settlementData.map(async (settlement) => {
          const { data: items } = await (supabase as any)
            .from("settlement_items")
            .select(`
              id,
              amount,
              transaction_line:transaction_lines(
                id,
                amount,
                transaction:transactions(date, description)
              )
            `)
            .eq("settlement_id", settlement.id);

          return {
            ...settlement,
            settlement_items: (items || []) as SettlementItem[],
          };
        })
      );
      setSettlements(settlementsWithItems);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 選択中の項目の計算
  const selectedAssetTotal = useMemo(() => {
    let total = 0;
    counterpartyDataList.forEach((data) => {
      data.assetLines.forEach((line) => {
        if (selectedLines.has(line.id)) {
          total += line.unsettledAmount;
        }
      });
    });
    return total;
  }, [selectedLines, counterpartyDataList]);

  const selectedLiabilityTotal = useMemo(() => {
    let total = 0;
    counterpartyDataList.forEach((data) => {
      data.liabilityLines.forEach((line) => {
        if (selectedLines.has(line.id)) {
          total += line.unsettledAmount;
        }
      });
    });
    return total;
  }, [selectedLines, counterpartyDataList]);

  // 相手ごとの精算可能金額を取得
  const getBalance = (counterparty: string): SettlementBalance | undefined => {
    return settlementBalances.find((b) => b.counterparty === counterparty);
  };

  // 全相手先リスト（未精算項目がある + 精算可能金額がある）
  const allCounterparties = useMemo(() => {
    const set = new Set<string>();
    counterpartyDataList.forEach((d) => set.add(d.counterparty));
    settlementBalances.forEach((b) => {
      if (b.receive_balance > 0 || b.pay_balance > 0) {
        set.add(b.counterparty);
      }
    });
    return Array.from(set).sort();
  }, [counterpartyDataList, settlementBalances]);

  const handleToggleLine = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleOpenDeposit = (type: "receive" | "pay", counterparty: string) => {
    setEditingSettlement(null);
    setDepositType(type);
    setSelectedCounterparty(counterparty);
    setDepositAmount("");
    setDepositNote("");
    setDepositDate(format(new Date(), "yyyy-MM-dd"));
    if (cashAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(cashAccounts[0].id);
    }
    setShowDepositDialog(true);
  };

  const handleEditSettlement = (settlement: Settlement) => {
    setEditingSettlement(settlement);
    setDepositType(settlement.amount > 0 ? "receive" : "pay");
    setSelectedCounterparty(settlement.counterparty);
    setDepositAmount(Math.abs(settlement.amount).toString());
    setDepositNote(settlement.note || "");
    setDepositDate(settlement.date);
    setShowDepositDialog(true);
  };

  // 入金/支払いを記録（精算可能金額に加算）
  const handleSaveDeposit = async () => {
    if (!selectedCounterparty || !depositAmount) return;

    setIsSaving(true);
    const amount = parseInt(depositAmount, 10);
    const signedAmount = depositType === "receive" ? amount : -amount;

    if (editingSettlement) {
      // 編集モード: 既存の精算を更新
      await supabase
        .from("settlements")
        .update({
          date: depositDate,
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: depositNote || null,
        })
        .eq("id", editingSettlement.id);
    } else {
      // 新規作成モード
      // 1. settlement_balances をupsert
      const existingBalance = getBalance(selectedCounterparty);

      if (existingBalance) {
        const updates: { receive_balance?: number; pay_balance?: number } = {};
        if (depositType === "receive") {
          updates.receive_balance = existingBalance.receive_balance + amount;
        } else {
          updates.pay_balance = existingBalance.pay_balance + amount;
        }
        await supabase
          .from("settlement_balances")
          .update(updates)
          .eq("id", existingBalance.id);
      } else {
        const insertData: any = {
          user_id: user?.id,
          counterparty: selectedCounterparty,
          receive_balance: depositType === "receive" ? amount : 0,
          pay_balance: depositType === "pay" ? amount : 0,
        };
        await supabase
          .from("settlement_balances")
          .insert(insertData);
      }

      // 2. settlements に記録（履歴用）
      await supabase
        .from("settlements")
        .insert({
          user_id: user?.id,
          date: depositDate,
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: depositNote || null,
        });

      // 3. 現預金口座の残高を更新
      if (selectedAccountId && amount > 0) {
        const selectedAccount = cashAccounts.find((a) => a.id === selectedAccountId);
        if (selectedAccount) {
          const currentBalance = selectedAccount.current_balance ?? selectedAccount.opening_balance ?? 0;
          const newBalance = depositType === "receive"
            ? currentBalance + amount
            : currentBalance - amount;

          await supabase
            .from("accounts")
            .update({ current_balance: newBalance })
            .eq("id", selectedAccountId);
        }
      }
    }

    setShowDepositDialog(false);
    setEditingSettlement(null);
    setIsSaving(false);
    fetchData();
  };

  // 選択した項目を精算
  const handleOpenSettleConfirm = (type: "asset" | "liability", counterparty: string) => {
    setSettleType(type);
    setSettleCounterparty(counterparty);
    setShowSettleConfirmDialog(true);
  };

  const handleSettleSelectedLines = async () => {
    if (!settleCounterparty) return;

    setIsSaving(true);

    const data = counterpartyDataList.find((d) => d.counterparty === settleCounterparty);
    if (!data) {
      setIsSaving(false);
      return;
    }

    const balance = getBalance(settleCounterparty);
    const lines = settleType === "asset" ? data.assetLines : data.liabilityLines;
    const selectedLinesForCounterparty = lines.filter((l) => selectedLines.has(l.id));
    const totalToSettle = selectedLinesForCounterparty.reduce((sum, l) => sum + l.unsettledAmount, 0);

    // 残高チェック
    const availableBalance = settleType === "asset"
      ? (balance?.receive_balance ?? 0)
      : (balance?.pay_balance ?? 0);

    if (totalToSettle > availableBalance) {
      alert(settleType === "asset"
        ? `受取可能金額が不足しています。（必要: ¥${totalToSettle.toLocaleString()}、残高: ¥${availableBalance.toLocaleString()}）`
        : `支払可能金額が不足しています。（必要: ¥${totalToSettle.toLocaleString()}、残高: ¥${availableBalance.toLocaleString()}）`
      );
      setIsSaving(false);
      return;
    }

    // 1. 精算記録を作成
    const { data: newSettlement } = await supabase
      .from("settlements")
      .insert({
        user_id: user?.id,
        date: format(new Date(), "yyyy-MM-dd"),
        counterparty: settleCounterparty,
        amount: 0, // 入金/支払ではないので0
        note: settleType === "asset" ? "立替精算" : "借入返済",
      })
      .select()
      .single();

    // 2. 各項目を精算
    const settlementItems: { settlement_id: string; transaction_line_id: string; amount: number }[] = [];

    for (const line of selectedLinesForCounterparty) {
      // transaction_lines.settled_amount を更新
      const newSettledAmount = line.settledAmount + line.unsettledAmount;
      await supabase
        .from("transaction_lines")
        .update({
          settled_amount: newSettledAmount,
          is_settled: newSettledAmount >= line.amount,
        })
        .eq("id", line.id);

      // settlement_items を記録
      if (newSettlement) {
        settlementItems.push({
          settlement_id: newSettlement.id,
          transaction_line_id: line.id,
          amount: line.unsettledAmount,
        });
      }
    }

    // 3. settlement_items を一括insert
    if (settlementItems.length > 0) {
      await (supabase as any).from("settlement_items").insert(settlementItems);
    }

    // 4. settlement_balances を減算
    if (balance) {
      const updates: { receive_balance?: number; pay_balance?: number } = {};
      if (settleType === "asset") {
        updates.receive_balance = balance.receive_balance - totalToSettle;
      } else {
        updates.pay_balance = balance.pay_balance - totalToSettle;
      }
      await supabase
        .from("settlement_balances")
        .update(updates)
        .eq("id", balance.id);
    }

    // 選択をクリア
    setSelectedLines(new Set());
    setShowSettleConfirmDialog(false);
    setIsSaving(false);
    fetchData();
  };

  const handleDeleteSettlement = async () => {
    if (!deleteId) return;

    await supabase
      .from("settlements")
      .delete()
      .eq("id", deleteId);

    setDeleteId(null);
    fetchData();
  };

  // 選択中の相手ごとの金額集計
  const getSelectedTotalForCounterparty = (counterparty: string, type: "asset" | "liability"): number => {
    const data = counterpartyDataList.find((d) => d.counterparty === counterparty);
    if (!data) return 0;

    const lines = type === "asset" ? data.assetLines : data.liabilityLines;
    return lines
      .filter((l) => selectedLines.has(l.id))
      .reduce((sum, l) => sum + l.unsettledAmount, 0);
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
        <h1 className="font-heading text-2xl font-bold">立替・精算</h1>

        <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
          <div className="space-y-6">
            {/* 未精算項目 */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <h2 className="font-medium text-sm text-muted-foreground mb-4">
                未精算の立替
              </h2>

              {counterpartyDataList.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  未精算の立替はありません
                </p>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {counterpartyDataList.map((data) => {
                      const isExpanded = expandedCounterparty === data.counterparty;
                      const balance = getBalance(data.counterparty);
                      const selectedAsset = getSelectedTotalForCounterparty(data.counterparty, "asset");
                      const selectedLiability = getSelectedTotalForCounterparty(data.counterparty, "liability");

                      return (
                        <motion.div
                          key={data.counterparty}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-secondary/30 rounded-lg overflow-hidden"
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between p-3">
                            <button
                              onClick={() => setExpandedCounterparty(isExpanded ? null : data.counterparty)}
                              className="flex items-center gap-3 flex-1"
                            >
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                <Users className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium">{data.counterparty}</p>
                                <p className="text-xs text-muted-foreground">
                                  {data.assetLines.length + data.liabilityLines.length}件の未精算
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex items-center gap-2 ml-2">
                              <span className={`font-heading font-bold tabular-nums ${
                                data.netAmount > 0 ? "text-income" : data.netAmount < 0 ? "text-expense" : ""
                              }`}>
                                {data.netAmount > 0 ? "+" : ""}¥{Math.abs(data.netAmount).toLocaleString("ja-JP")}
                              </span>
                            </div>
                          </div>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-border"
                              >
                                <div className="p-3 space-y-4">
                                  {/* 立替（受取待ち） */}
                                  {data.assetLines.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-income flex items-center gap-1">
                                          <ArrowUpRight className="w-4 h-4" />
                                          立替（受取待ち）
                                        </p>
                                        <span className="text-sm font-mono">
                                          ¥{data.totalAsset.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        {data.assetLines.map((line) => (
                                          <label
                                            key={line.id}
                                            className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-secondary/50 cursor-pointer"
                                          >
                                            <Checkbox
                                              checked={selectedLines.has(line.id)}
                                              onCheckedChange={() => handleToggleLine(line.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="truncate">{line.description}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {line.date}
                                                {line.settledAmount > 0 && (
                                                  <span className="ml-2">
                                                    (一部精算済: ¥{line.settledAmount.toLocaleString()})
                                                  </span>
                                                )}
                                              </p>
                                            </div>
                                            <span className="font-mono text-right">
                                              ¥{line.unsettledAmount.toLocaleString()}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                      {/* 選択中の立替精算ボタン */}
                                      {selectedAsset > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                              選択中: ¥{selectedAsset.toLocaleString()}
                                            </span>
                                            <Button
                                              size="sm"
                                              onClick={() => handleOpenSettleConfirm("asset", data.counterparty)}
                                              disabled={(balance?.receive_balance ?? 0) < selectedAsset}
                                            >
                                              <Check className="w-4 h-4 mr-1" />
                                              精算
                                            </Button>
                                          </div>
                                          {(balance?.receive_balance ?? 0) < selectedAsset && (
                                            <p className="text-xs text-destructive mt-1">
                                              受取可能金額が不足しています
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* 借入（返済待ち） */}
                                  {data.liabilityLines.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-expense flex items-center gap-1">
                                          <ArrowDownLeft className="w-4 h-4" />
                                          借入（返済待ち）
                                        </p>
                                        <span className="text-sm font-mono">
                                          ¥{data.totalLiability.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        {data.liabilityLines.map((line) => (
                                          <label
                                            key={line.id}
                                            className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-secondary/50 cursor-pointer"
                                          >
                                            <Checkbox
                                              checked={selectedLines.has(line.id)}
                                              onCheckedChange={() => handleToggleLine(line.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="truncate">{line.description}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {line.date}
                                                {line.settledAmount > 0 && (
                                                  <span className="ml-2">
                                                    (一部返済済: ¥{line.settledAmount.toLocaleString()})
                                                  </span>
                                                )}
                                              </p>
                                            </div>
                                            <span className="font-mono text-right">
                                              ¥{line.unsettledAmount.toLocaleString()}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                      {/* 選択中の借入返済ボタン */}
                                      {selectedLiability > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                              選択中: ¥{selectedLiability.toLocaleString()}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleOpenSettleConfirm("liability", data.counterparty)}
                                              disabled={(balance?.pay_balance ?? 0) < selectedLiability}
                                            >
                                              <Check className="w-4 h-4 mr-1" />
                                              返済
                                            </Button>
                                          </div>
                                          {(balance?.pay_balance ?? 0) < selectedLiability && (
                                            <p className="text-xs text-destructive mt-1">
                                              支払可能金額が不足しています
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* 精算履歴 */}
            <div>
              <h2 className="font-medium text-sm text-muted-foreground mb-3">
                精算履歴
              </h2>
              {settlements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>精算履歴がありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {settlements.map((settlement) => {
                    const isExpanded = expandedSettlement === settlement.id;
                    const hasItems = settlement.settlement_items && settlement.settlement_items.length > 0;
                    return (
                      <div
                        key={settlement.id}
                        className="bg-card rounded-xl border border-border overflow-hidden"
                      >
                        <div className="p-4 flex items-center justify-between">
                          <button
                            onClick={() => hasItems && setExpandedSettlement(isExpanded ? null : settlement.id)}
                            className={`flex-1 text-left ${hasItems ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{settlement.counterparty}</p>
                              {hasItems && (
                                isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(settlement.date), "yyyy/M/d", { locale: ja })}
                              {settlement.note && ` - ${settlement.note}`}
                              {hasItems && ` (${settlement.settlement_items!.length}件)`}
                            </p>
                          </button>
                          <div className="flex items-center gap-3">
                            {settlement.amount !== 0 && (
                              <span className={`font-heading font-bold tabular-nums ${
                                settlement.amount > 0 ? "text-income" : "text-expense"
                              }`}>
                                {settlement.amount > 0 ? "+" : ""}¥{Math.abs(settlement.amount).toLocaleString("ja-JP")}
                              </span>
                            )}
                            <button
                              onClick={() => handleEditSettlement(settlement)}
                              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteId(settlement.id)}
                              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {/* 内訳 */}
                        <AnimatePresence>
                          {isExpanded && hasItems && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-border"
                            >
                              <div className="p-3 space-y-2 bg-secondary/30">
                                {settlement.settlement_items!.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-sm py-1"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate">
                                        {item.transaction_line?.transaction?.description || "不明"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {item.transaction_line?.transaction?.date || ""}
                                      </p>
                                    </div>
                                    <span className="font-mono text-right ml-2">
                                      ¥{item.amount.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 精算可能金額 */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-card rounded-xl p-5 border border-border">
              <h2 className="font-medium text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                精算可能金額
              </h2>

              {allCounterparties.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  相手先がありません
                </p>
              ) : (
                <div className="space-y-3">
                  {allCounterparties.map((counterparty) => {
                    const balance = getBalance(counterparty);
                    const receiveBalance = balance?.receive_balance ?? 0;
                    const payBalance = balance?.pay_balance ?? 0;

                    return (
                      <div
                        key={counterparty}
                        className="bg-secondary/30 rounded-lg p-3"
                      >
                        <p className="font-medium mb-2">{counterparty}</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">受取可能</span>
                            <span className={`font-mono ${receiveBalance > 0 ? "text-income" : ""}`}>
                              ¥{receiveBalance.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">支払可能</span>
                            <span className={`font-mono ${payBalance > 0 ? "text-expense" : ""}`}>
                              ¥{payBalance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleOpenDeposit("receive", counterparty)}
                          >
                            <ArrowUpRight className="w-4 h-4 mr-1 text-income" />
                            入金
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleOpenDeposit("pay", counterparty)}
                          >
                            <ArrowDownLeft className="w-4 h-4 mr-1 text-expense" />
                            支払
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* クイックアクション */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <button
                onClick={() => {
                  setSelectedCounterparty("");
                  setDepositType("receive");
                  setDepositAmount("");
                  setDepositNote("");
                  setDepositDate(format(new Date(), "yyyy-MM-dd"));
                  setShowDepositDialog(true);
                }}
                className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors"
              >
                <ArrowUpRight className="w-5 h-5 text-income mb-2" />
                <p className="font-medium">入金を記録</p>
                <p className="text-xs text-muted-foreground">
                  お金を受け取った
                </p>
              </button>
              <button
                onClick={() => {
                  setSelectedCounterparty("");
                  setDepositType("pay");
                  setDepositAmount("");
                  setDepositNote("");
                  setDepositDate(format(new Date(), "yyyy-MM-dd"));
                  setShowDepositDialog(true);
                }}
                className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors"
              >
                <ArrowDownLeft className="w-5 h-5 text-expense mb-2" />
                <p className="font-medium">支払を記録</p>
                <p className="text-xs text-muted-foreground">
                  お金を支払った
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 入金/支払ダイアログ */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSettlement
                ? "精算を編集"
                : depositType === "receive"
                ? "入金を記録"
                : "支払を記録"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">日付</label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">相手</label>
              <Input
                placeholder="例: あさみ"
                value={selectedCounterparty}
                onChange={(e) => setSelectedCounterparty(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">金額</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">¥</span>
                <input
                  type="number"
                  placeholder="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* 口座選択 */}
            {cashAccounts.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {depositType === "receive" ? "受け取り口座" : "支払い口座"}
                </label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="口座を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                        <span className="text-muted-foreground ml-2">
                          (¥{(acc.current_balance ?? acc.opening_balance ?? 0).toLocaleString()})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">メモ（任意）</label>
              <Input
                placeholder="例: 12月分の精算"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveDeposit}
              disabled={!selectedCounterparty || !depositAmount || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : editingSettlement ? "更新する" : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 精算確認ダイアログ */}
      <AlertDialog open={showSettleConfirmDialog} onOpenChange={setShowSettleConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {settleType === "asset" ? "立替を精算しますか？" : "借入を返済しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {settleCounterparty}への{settleType === "asset" ? "立替" : "借入"}を精算します。
              <br />
              金額: ¥{getSelectedTotalForCounterparty(settleCounterparty, settleType).toLocaleString()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleSettleSelectedLines} disabled={isSaving}>
              {isSaving ? "処理中..." : settleType === "asset" ? "精算する" : "返済する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>精算履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。精算履歴が完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSettlement}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

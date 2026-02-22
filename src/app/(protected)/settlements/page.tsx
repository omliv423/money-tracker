"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, ArrowUpRight, ArrowDownLeft, ArrowLeft, Pencil, Trash2, ChevronDown, ChevronUp, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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

type ViewMode = "list" | "select" | "confirm";

export default function SettlementsPage() {
  const { user } = useAuth();
  const [counterpartyDataList, setCounterpartyDataList] = useState<CounterpartyData[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementBalances, setSettlementBalances] = useState<SettlementBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);

  // 3ステップフロー
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeCounterparty, setActiveCounterparty] = useState<string | null>(null);

  // 選択状態の管理
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  // Dialog states
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositType, setDepositType] = useState<"receive" | "pay">("receive");
  const [selectedCounterparty, setSelectedCounterparty] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositDate, setDepositDate] = useState<Date | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  // アクティブな相手先のデータ
  const activeData = useMemo(() => {
    if (!activeCounterparty) return null;
    return counterpartyDataList.find((d) => d.counterparty === activeCounterparty) || null;
  }, [activeCounterparty, counterpartyDataList]);

  // アクティブ相手先の全ライン（日付降順でグルーピング用）
  const allLinesForCounterparty = useMemo(() => {
    if (!activeData) return [];
    return [...activeData.assetLines, ...activeData.liabilityLines]
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeData]);

  // 日付でグルーピング
  const linesGroupedByDate = useMemo(() => {
    const groups: { date: string; lines: UnsettledLine[] }[] = [];
    const map = new Map<string, UnsettledLine[]>();
    for (const line of allLinesForCounterparty) {
      const date = line.date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(line);
    }
    map.forEach((lines, date) => {
      groups.push({ date, lines });
    });
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [allLinesForCounterparty]);

  // 選択状態の計算
  const selectedCount = useMemo(() => {
    return allLinesForCounterparty.filter((l) => selectedLines.has(l.id)).length;
  }, [selectedLines, allLinesForCounterparty]);

  const allSelected = useMemo(() => {
    return allLinesForCounterparty.length > 0 &&
      allLinesForCounterparty.every((l) => selectedLines.has(l.id));
  }, [selectedLines, allLinesForCounterparty]);

  // 確認画面の計算
  const confirmData = useMemo(() => {
    const selectedList = allLinesForCounterparty.filter((l) => selectedLines.has(l.id));
    const myPaid = selectedList
      .filter((l) => l.lineType === "asset")
      .reduce((sum, l) => sum + l.unsettledAmount, 0);
    const theirPaid = selectedList
      .filter((l) => l.lineType === "liability")
      .reduce((sum, l) => sum + l.unsettledAmount, 0);
    const total = myPaid + theirPaid;
    const myShare = Math.ceil(total / 2);
    const theirShare = total - myShare;
    // 正: 自分が相手に支払う、負: 相手が自分に支払う
    const settlementAmount = myShare - myPaid;
    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "自分";

    return { selectedList, myPaid, theirPaid, total, myShare, theirShare, settlementAmount, userName };
  }, [selectedLines, allLinesForCounterparty, user]);

  // --- ハンドラー ---

  const handleCounterpartyClick = (counterparty: string) => {
    setActiveCounterparty(counterparty);
    setSelectedLines(new Set());
    setViewMode("select");
  };

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

  const handleSelectAll = () => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allLinesForCounterparty.forEach((l) => next.delete(l.id));
      } else {
        allLinesForCounterparty.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };

  const handleBackToList = () => {
    setViewMode("list");
    setActiveCounterparty(null);
    setSelectedLines(new Set());
  };

  const handleBackToSelect = () => {
    setViewMode("select");
  };

  // 未精算リストから外す
  const handleExcludeFromList = async () => {
    if (!activeCounterparty) return;
    setIsSaving(true);

    const linesToExclude = allLinesForCounterparty.filter((l) => selectedLines.has(l.id));

    for (const line of linesToExclude) {
      await supabase
        .from("transaction_lines")
        .update({
          is_settled: true,
          settled_amount: line.amount,
        })
        .eq("id", line.id);
    }

    setSelectedLines(new Set());
    setIsSaving(false);
    await fetchData();

    // データ更新後、残りの未精算項目があるか確認
    // fetchData後にcounterpartyDataListが更新されるので、listに戻る
    setViewMode("list");
    setActiveCounterparty(null);
  };

  // 精算する（確認画面から）
  const handleSettleFromConfirm = async () => {
    if (!activeCounterparty) return;
    setIsSaving(true);

    const selectedList = allLinesForCounterparty.filter((l) => selectedLines.has(l.id));

    // 1. 精算記録を作成
    const { data: newSettlement } = await supabase
      .from("settlements")
      .insert({
        user_id: user?.id,
        date: format(new Date(), "yyyy-MM-dd"),
        counterparty: activeCounterparty,
        amount: 0,
        note: "精算",
      })
      .select()
      .single();

    // 2. 各項目を精算済みに更新
    const settlementItems: { settlement_id: string; transaction_line_id: string; amount: number }[] = [];

    for (const line of selectedList) {
      const newSettledAmount = line.settledAmount + line.unsettledAmount;
      await supabase
        .from("transaction_lines")
        .update({
          settled_amount: newSettledAmount,
          is_settled: newSettledAmount >= line.amount,
        })
        .eq("id", line.id);

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

    setSelectedLines(new Set());
    setViewMode("list");
    setActiveCounterparty(null);
    setIsSaving(false);
    fetchData();
  };

  const handleOpenDeposit = (type: "receive" | "pay", counterparty: string) => {
    setEditingSettlement(null);
    setDepositType(type);
    setSelectedCounterparty(counterparty);
    setDepositAmount("");
    setDepositNote("");
    setDepositDate(new Date());
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
    setDepositDate(new Date(settlement.date));
    setShowDepositDialog(true);
  };

  // 入金/支払いを記録（精算可能金額に加算）
  const handleSaveDeposit = async () => {
    if (!selectedCounterparty || !depositAmount) return;

    setIsSaving(true);
    const amount = parseInt(depositAmount, 10);
    const signedAmount = depositType === "receive" ? amount : -amount;

    if (editingSettlement) {
      await supabase
        .from("settlements")
        .update({
          date: depositDate ? format(depositDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: depositNote || null,
        })
        .eq("id", editingSettlement.id);
    } else {
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

      await supabase
        .from("settlements")
        .insert({
          user_id: user?.id,
          date: depositDate ? format(depositDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: depositNote || null,
        });

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

  const handleDeleteSettlement = async () => {
    if (!deleteId) return;

    await supabase
      .from("settlements")
      .delete()
      .eq("id", deleteId);

    setDeleteId(null);
    fetchData();
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
        {/* ========== Step 1: 相手先一覧（リストビュー） ========== */}
        {viewMode === "list" && (
          <>
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
                        {counterpartyDataList.map((data) => (
                          <motion.div
                            key={data.counterparty}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-secondary/30 rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => handleCounterpartyClick(data.counterparty)}
                              className="flex items-center justify-between p-3 w-full text-left hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                  <Users className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{data.counterparty}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {data.assetLines.length + data.liabilityLines.length}件の未精算
                                  </p>
                                </div>
                              </div>
                              <span className={`font-heading font-bold tabular-nums ${
                                data.netAmount > 0 ? "text-income" : data.netAmount < 0 ? "text-expense" : ""
                              }`}>
                                {data.netAmount > 0 ? "+" : ""}¥{Math.abs(data.netAmount).toLocaleString("ja-JP")}
                              </span>
                            </button>
                          </motion.div>
                        ))}
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
                      setDepositDate(new Date());
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
                      setDepositDate(new Date());
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
          </>
        )}

        {/* ========== Step 2: 選択モード ========== */}
        {viewMode === "select" && activeCounterparty && activeData && (
          <div className="min-h-[60vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="font-heading text-xl font-bold leading-tight">{activeCounterparty}</h1>
                  <p className="text-xs text-muted-foreground">
                    {allLinesForCounterparty.length}件の未精算
                  </p>
                </div>
              </div>
              <button
                onClick={handleBackToList}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                キャンセル
              </button>
            </div>

            {/* サマリーカード */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl p-4 mb-5 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border border-primary/10"
            >
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">差引金額</p>
                  <p className={`font-heading text-2xl font-bold tabular-nums leading-tight ${
                    activeData.netAmount > 0 ? "text-income" : activeData.netAmount < 0 ? "text-expense" : ""
                  }`}>
                    {activeData.netAmount > 0 ? "+" : ""}¥{Math.abs(activeData.netAmount).toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-[13px] space-y-0.5">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-muted-foreground">立替</span>
                    <span className="font-heading font-semibold tabular-nums text-income">
                      ¥{activeData.totalAsset.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-muted-foreground">借入</span>
                    <span className="font-heading font-semibold tabular-nums text-expense">
                      ¥{activeData.totalLiability.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* すべて選択 */}
            <label className="flex items-center gap-3 py-3 px-4 mb-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 cursor-pointer transition-colors">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium flex-1">すべて選択</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {selectedCount}/{allLinesForCounterparty.length}
              </span>
            </label>

            {/* 項目リスト（日付グルーピング・カードベース） */}
            <div className="space-y-4 pb-32">
              {linesGroupedByDate.map((group, groupIdx) => (
                <motion.div
                  key={group.date}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.04, duration: 0.3 }}
                >
                  <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5 tracking-wide">
                    {group.date ? format(new Date(group.date), "yyyy/M/d (E)", { locale: ja }) : "日付なし"}
                  </p>
                  <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {group.lines.map((line) => (
                      <label
                        key={line.id}
                        className="flex items-center gap-3 text-sm py-3 px-3 hover:bg-secondary/30 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedLines.has(line.id)}
                          onCheckedChange={() => handleToggleLine(line.id)}
                        />
                        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                          line.lineType === "asset" ? "bg-income/70" : "bg-expense/70"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium leading-snug">{line.description}</p>
                          {line.settledAmount > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              一部精算済: ¥{line.settledAmount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className={`font-heading font-bold tabular-nums text-right ${
                          line.lineType === "asset" ? "text-income" : "text-expense"
                        }`}>
                          {line.lineType === "liability" ? "-" : ""}¥{line.unsettledAmount.toLocaleString()}
                        </span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* 下部固定アクションバー（グラスモーフィズム） */}
            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed bottom-20 left-0 right-0 z-50 md:bottom-4"
                >
                  <div className="mx-auto max-w-lg px-4">
                    <div className="bg-card/80 backdrop-blur-xl border border-border/70 rounded-2xl p-4 shadow-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">
                          {selectedCount}件選択中
                        </span>
                        <span className="font-heading font-bold tabular-nums">
                          ¥{allLinesForCounterparty
                            .filter((l) => selectedLines.has(l.id))
                            .reduce((sum, l) => sum + l.unsettledAmount, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={handleExcludeFromList}
                          disabled={isSaving}
                        >
                          {isSaving ? "処理中..." : "リストから外す"}
                        </Button>
                        <Button
                          className="flex-1 rounded-xl"
                          onClick={() => setViewMode("confirm")}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          精算する
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========== Step 3: 確認画面 ========== */}
        {viewMode === "confirm" && activeCounterparty && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-[60vh]"
          >
            {/* ヘッダー */}
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={handleBackToSelect}
                className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-heading text-xl font-bold">精算内容</h1>
            </div>

            <div className="space-y-5">
              {/* 精算額ヒーローカード */}
              {confirmData.settlementAmount !== 0 ? (
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className={`rounded-2xl p-6 ${
                    confirmData.settlementAmount > 0
                      ? "bg-gradient-to-br from-expense/10 via-expense/5 to-transparent border-2 border-expense/20"
                      : "bg-gradient-to-br from-income/10 via-income/5 to-transparent border-2 border-income/20"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">精算額</p>
                  <p className="font-heading text-3xl font-bold tabular-nums leading-tight mb-3">
                    ¥{Math.abs(confirmData.settlementAmount).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium px-2 py-0.5 rounded-md bg-secondary/50">
                      {confirmData.settlementAmount > 0 ? confirmData.userName : activeCounterparty}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium px-2 py-0.5 rounded-md bg-secondary/50">
                      {confirmData.settlementAmount > 0 ? activeCounterparty : confirmData.userName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {confirmData.settlementAmount > 0
                      ? `${confirmData.userName}から${activeCounterparty}へ支払い`
                      : `${activeCounterparty}から${confirmData.userName}へ支払い`
                    }
                  </p>
                </motion.div>
              ) : confirmData.total > 0 ? (
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl p-6 bg-secondary/30 border-2 border-border"
                >
                  <p className="font-heading font-bold text-lg">精算不要</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    お互いの立替金額が同額です
                  </p>
                </motion.div>
              ) : null}

              {/* 精算対象の合計金額 */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl p-5 border border-border"
              >
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">精算対象の合計</p>
                <p className="font-heading text-xl font-bold tabular-nums">
                  ¥{confirmData.total.toLocaleString()}
                </p>
              </motion.div>

              {/* 内訳テーブル */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                <div className="grid grid-cols-3 text-sm">
                  {/* ヘッダー */}
                  <div className="p-3 text-center font-heading font-semibold text-xs bg-secondary/40 border-b border-border">
                    {confirmData.userName}
                  </div>
                  <div className="p-3 bg-secondary/40 border-b border-border border-x border-border">
                  </div>
                  <div className="p-3 text-center font-heading font-semibold text-xs bg-secondary/40 border-b border-border">
                    {activeCounterparty}
                  </div>

                  {/* 支払済み金額 */}
                  <div className="p-3 text-center font-heading font-semibold tabular-nums">
                    ¥{confirmData.myPaid.toLocaleString()}
                  </div>
                  <div className="p-3 text-center text-[11px] text-muted-foreground border-x border-border flex items-center justify-center">
                    支払済み金額
                  </div>
                  <div className="p-3 text-center font-heading font-semibold tabular-nums">
                    ¥{confirmData.theirPaid.toLocaleString()}
                  </div>

                  {/* 分担する額 */}
                  <div className="p-3 text-center font-heading font-semibold tabular-nums border-t border-border bg-secondary/20">
                    ¥{confirmData.myShare.toLocaleString()}
                  </div>
                  <div className="p-3 text-center text-[11px] text-muted-foreground border-x border-t border-border bg-secondary/20 flex items-center justify-center">
                    分担する額
                  </div>
                  <div className="p-3 text-center font-heading font-semibold tabular-nums border-t border-border bg-secondary/20">
                    ¥{confirmData.theirShare.toLocaleString()}
                  </div>
                </div>
              </motion.div>

              {/* 選択した項目一覧 */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-xs font-medium text-muted-foreground mb-2 px-1 tracking-wide">
                  精算対象（{confirmData.selectedList.length}件）
                </p>
                <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {confirmData.selectedList.map((line) => (
                    <div key={line.id} className="flex items-center gap-3 p-3 text-sm">
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        line.lineType === "asset" ? "bg-income/70" : "bg-expense/70"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium leading-snug">{line.description}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {line.date ? format(new Date(line.date), "yyyy/M/d (E)", { locale: ja }) : ""}
                        </p>
                      </div>
                      <span className="font-heading font-bold tabular-nums ml-2">
                        ¥{line.unsettledAmount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* 精算するボタン */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  className="w-full h-12 text-base font-medium rounded-xl"
                  size="lg"
                  onClick={handleSettleFromConfirm}
                  disabled={isSaving}
                >
                  {isSaving ? "処理中..." : "精算する"}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
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
              <DatePicker
                value={depositDate}
                onChange={(date) => setDepositDate(date ?? null)}
                placeholder="日付を選択"
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

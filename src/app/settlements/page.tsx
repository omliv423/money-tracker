"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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

interface TransactionLine {
  id: string;
  amount: number;
  line_type: string;
  counterparty: string;
  transaction_id: string;
}

interface UnsettledLine {
  id: string;
  date: string;
  description: string;
  amount: number;
  settledAmount: number;
  unsettledAmount: number;
}

interface CounterpartyBalance {
  counterparty: string;
  totalAmount: number;
  count: number;
  lines: UnsettledLine[];
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
  const [balances, setBalances] = useState<CounterpartyBalance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [expandedCounterparty, setExpandedCounterparty] = useState<string | null>(null);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null);

  // Dialog states
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [settlementType, setSettlementType] = useState<"receive" | "pay">("receive");
  const [selectedCounterparty, setSelectedCounterparty] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit mode
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);

    // 現預金口座を取得（current_balanceが設定されているもの）
    // current_balanceが設定されていない場合も選べるように、全てのアクティブ口座を取得
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

    // 未精算の立替を集計（settled_amountを使った部分精算対応）
    const { data: allLines } = await supabase
      .from("transaction_lines")
      .select(`
        id, counterparty, amount, line_type, is_settled, settled_amount,
        transaction:transactions(date, description)
      `)
      .not("counterparty", "is", null);

    if (allLines) {
      const balanceMap = new Map<string, { total: number; count: number; lines: UnsettledLine[] }>();

      allLines.forEach((line: any) => {
        if (!line.counterparty) return;

        // 未精算金額を計算: amount - settled_amount
        // is_settledがtrueでsettled_amountが0の場合は全額精算済み（旧データ対応）
        const settledAmount = line.settled_amount ?? 0;
        const unsettledAmount = line.is_settled && settledAmount === 0
          ? 0  // 旧ロジックで精算済みになったもの
          : line.amount - settledAmount;

        if (unsettledAmount <= 0) return;  // 全額精算済みはスキップ

        const current = balanceMap.get(line.counterparty) || { total: 0, count: 0, lines: [] };
        // asset = 立替（相手に貸してる）、liability = 借入（相手から借りてる）
        const signedAmount = line.line_type === "asset" ? unsettledAmount : -unsettledAmount;

        current.lines.push({
          id: line.id,
          date: line.transaction?.date || "",
          description: line.transaction?.description || "",
          amount: line.amount,
          settledAmount: settledAmount,
          unsettledAmount: unsettledAmount,
        });

        balanceMap.set(line.counterparty, {
          total: current.total + signedAmount,
          count: current.count + 1,
          lines: current.lines,
        });
      });

      const balanceList: CounterpartyBalance[] = [];
      balanceMap.forEach((value, key) => {
        if (value.total !== 0) {  // 残高0はスキップ
          // 日付でソート
          value.lines.sort((a, b) => a.date.localeCompare(b.date));
          balanceList.push({
            counterparty: key,
            totalAmount: value.total,
            count: value.count,
            lines: value.lines,
          });
        }
      });
      setBalances(balanceList.sort((a, b) => b.totalAmount - a.totalAmount));
    }

    // 精算履歴を取得（内訳を含む）
    const { data: settlementData } = await supabase
      .from("settlements")
      .select(`
        *,
        settlement_items(
          id,
          amount,
          transaction_line:transaction_lines(
            id,
            amount,
            transaction:transactions(date, description)
          )
        )
      `)
      .order("date", { ascending: false })
      .limit(20);

    if (settlementData) {
      setSettlements(settlementData as Settlement[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenSettlement = (type: "receive" | "pay", counterparty?: string, amount?: number) => {
    setEditingSettlement(null);
    setSettlementType(type);
    setSelectedCounterparty(counterparty || "");
    setSettlementAmount(amount ? Math.abs(amount).toString() : "");
    setSettlementNote("");
    setSettlementDate(format(new Date(), "yyyy-MM-dd"));
    if (cashAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(cashAccounts[0].id);
    }
    setShowSettlementDialog(true);
  };

  const handleEditSettlement = (settlement: Settlement) => {
    setEditingSettlement(settlement);
    setSettlementType(settlement.amount > 0 ? "receive" : "pay");
    setSelectedCounterparty(settlement.counterparty);
    setSettlementAmount(Math.abs(settlement.amount).toString());
    setSettlementNote(settlement.note || "");
    setSettlementDate(settlement.date);
    setShowSettlementDialog(true);
  };

  const handleSaveSettlement = async () => {
    if (!selectedCounterparty || !settlementAmount) return;

    setIsSaving(true);
    const amount = parseInt(settlementAmount, 10);
    const signedAmount = settlementType === "receive" ? amount : -amount;

    if (editingSettlement) {
      // 編集モード: 既存の精算を更新
      await supabase
        .from("settlements")
        .update({
          date: settlementDate,
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: settlementNote || null,
        })
        .eq("id", editingSettlement.id);
    } else {
      // 新規作成モード
      // 精算を記録
      const { data: newSettlement, error: settlementError } = await supabase
        .from("settlements")
        .insert({
          user_id: user?.id,
          date: settlementDate,
          counterparty: selectedCounterparty,
          amount: signedAmount,
          note: settlementNote || null,
        })
        .select()
        .single();

      if (settlementError) {
        console.error("Settlement insert error:", settlementError);
      }

      // 該当する未精算の立替を部分精算する
      // 古い順に精算していく
      const { data: allCounterpartyLines } = await supabase
        .from("transaction_lines")
        .select("id, amount, line_type, is_settled, settled_amount")
        .eq("counterparty", selectedCounterparty)
        .order("created_at", { ascending: true });

      if (allCounterpartyLines && allCounterpartyLines.length > 0) {
        let remainingSettlement = amount;
        const settlementItems: { settlement_id: string; transaction_line_id: string; amount: number }[] = [];

        for (const line of allCounterpartyLines) {
          // 未精算金額を計算
          const settledAmount = line.settled_amount ?? 0;
          const unsettledAmount = line.is_settled && settledAmount === 0
            ? 0  // 旧ロジックで精算済み
            : line.amount - settledAmount;

          if (unsettledAmount <= 0) continue;  // 既に全額精算済み

          // asset = 立替（受け取る）、liability = 借入（支払う）
          const lineIsAsset = line.line_type === "asset";
          const matchesType = settlementType === "receive" ? lineIsAsset : !lineIsAsset;

          if (!matchesType) continue;

          // この明細からいくら精算するか
          const toSettle = Math.min(remainingSettlement, unsettledAmount);
          const newSettledAmount = settledAmount + toSettle;

          // 精算額を更新
          await supabase
            .from("transaction_lines")
            .update({
              settled_amount: newSettledAmount,
              is_settled: newSettledAmount >= line.amount,  // 全額精算済みならtrue
            })
            .eq("id", line.id);

          // 精算内訳を記録
          if (newSettlement) {
            settlementItems.push({
              settlement_id: newSettlement.id,
              transaction_line_id: line.id,
              amount: toSettle,
            });
          }

          remainingSettlement -= toSettle;
          if (remainingSettlement <= 0) break;
        }

        // 精算内訳をまとめてinsert
        if (settlementItems.length > 0) {
          await supabase.from("settlement_items").insert(settlementItems);
        }
      }

      // 現預金口座の残高を更新（BSに反映）
      // 注: 立替/借入の精算はP&Lに影響しないため、収入/支出トランザクションは作成しない
      if (selectedAccountId && amount > 0) {
        const selectedAccount = cashAccounts.find((a) => a.id === selectedAccountId);
        if (selectedAccount) {
          // current_balanceがnullの場合はopening_balanceを使用
          const currentBalance = selectedAccount.current_balance ?? selectedAccount.opening_balance ?? 0;
          // receive = 受け取り（プラス）, pay = 支払い（マイナス）
          const newBalance = settlementType === "receive"
            ? currentBalance + amount
            : currentBalance - amount;

          await supabase
            .from("accounts")
            .update({ current_balance: newBalance })
            .eq("id", selectedAccountId);
        }
      }
    }

    setShowSettlementDialog(false);
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
        <h1 className="font-heading text-2xl font-bold">立替・精算</h1>

        <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
          <div className="space-y-6">
            {/* Outstanding balances */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <h2 className="font-medium text-sm text-muted-foreground mb-4">
                未精算の立替
              </h2>

              {balances.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  未精算の立替はありません
                </p>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {balances.map((balance) => {
                      const isExpanded = expandedCounterparty === balance.counterparty;
                      return (
                        <motion.div
                          key={balance.counterparty}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-secondary/30 rounded-lg overflow-hidden"
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between p-3">
                            <button
                              onClick={() => setExpandedCounterparty(isExpanded ? null : balance.counterparty)}
                              className="flex items-center gap-3 flex-1"
                            >
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                <Users className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium">{balance.counterparty}</p>
                                <p className="text-xs text-muted-foreground">
                                  {balance.count}件の未精算
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                            <button
                              onClick={() => handleOpenSettlement(
                                balance.totalAmount > 0 ? "receive" : "pay",
                                balance.counterparty,
                                balance.totalAmount
                              )}
                              className="flex items-center gap-2 hover:opacity-70 transition-opacity ml-2"
                            >
                              {balance.totalAmount > 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-income" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4 text-expense" />
                              )}
                              <span className={`font-heading font-bold tabular-nums ${
                                balance.totalAmount > 0 ? "text-income" : "text-expense"
                              }`}>
                                ¥{Math.abs(balance.totalAmount).toLocaleString("ja-JP")}
                              </span>
                            </button>
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
                                <div className="p-3 space-y-2">
                                  {balance.lines.map((line) => (
                                    <div
                                      key={line.id}
                                      className="flex items-center justify-between text-sm py-1"
                                    >
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
                                      <span className="font-mono text-right ml-2">
                                        ¥{line.unsettledAmount.toLocaleString()}
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
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Settlement history */}
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
                            <span className={`font-heading font-bold tabular-nums ${
                              settlement.amount > 0 ? "text-income" : "text-expense"
                            }`}>
                              {settlement.amount > 0 ? "+" : ""}¥{Math.abs(settlement.amount).toLocaleString("ja-JP")}
                            </span>
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

          {/* Quick actions */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <button
                onClick={() => handleOpenSettlement("receive")}
                className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors"
              >
                <ArrowUpRight className="w-5 h-5 text-income mb-2" />
                <p className="font-medium">精算を記録</p>
                <p className="text-xs text-muted-foreground">
                  お金を受け取った
                </p>
              </button>
              <button
                onClick={() => handleOpenSettlement("pay")}
                className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors"
              >
                <ArrowDownLeft className="w-5 h-5 text-expense mb-2" />
                <p className="font-medium">返済を記録</p>
                <p className="text-xs text-muted-foreground">
                  お金を返した
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSettlement
                ? "精算を編集"
                : settlementType === "receive"
                ? "精算を記録"
                : "返済を記録"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">日付</label>
              <Input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">相手</label>
              <Input
                placeholder="例: 彼女"
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
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* 口座選択 */}
            {cashAccounts.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {settlementType === "receive" ? "受け取り口座" : "支払い口座"}
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
                value={settlementNote}
                onChange={(e) => setSettlementNote(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveSettlement}
              disabled={!selectedCounterparty || !settlementAmount || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : editingSettlement ? "更新する" : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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

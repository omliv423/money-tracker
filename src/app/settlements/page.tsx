"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, ArrowUpRight, ArrowDownLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface CounterpartyBalance {
  counterparty: string;
  totalAmount: number;
  count: number;
}

interface Settlement {
  id: string;
  date: string;
  counterparty: string;
  amount: number;
  note: string | null;
}

export default function SettlementsPage() {
  const [balances, setBalances] = useState<CounterpartyBalance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [settlementType, setSettlementType] = useState<"receive" | "pay">("receive");
  const [selectedCounterparty, setSelectedCounterparty] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);

    // 未精算の立替を集計
    const { data: unsettledLines } = await supabase
      .from("transaction_lines")
      .select("counterparty, amount, line_type")
      .eq("is_settled", false)
      .not("counterparty", "is", null);

    if (unsettledLines) {
      const balanceMap = new Map<string, { total: number; count: number }>();

      unsettledLines.forEach((line) => {
        if (!line.counterparty) return;
        const current = balanceMap.get(line.counterparty) || { total: 0, count: 0 };
        // asset = 立替（相手に貸してる）、liability = 借入（相手から借りてる）
        const amount = line.line_type === "asset" ? line.amount : -line.amount;
        balanceMap.set(line.counterparty, {
          total: current.total + amount,
          count: current.count + 1,
        });
      });

      const balanceList: CounterpartyBalance[] = [];
      balanceMap.forEach((value, key) => {
        balanceList.push({
          counterparty: key,
          totalAmount: value.total,
          count: value.count,
        });
      });
      setBalances(balanceList.sort((a, b) => b.totalAmount - a.totalAmount));
    }

    // 精算履歴を取得
    const { data: settlementData } = await supabase
      .from("settlements")
      .select("*")
      .order("date", { ascending: false })
      .limit(20);

    if (settlementData) {
      setSettlements(settlementData);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenSettlement = (type: "receive" | "pay", counterparty?: string) => {
    setSettlementType(type);
    setSelectedCounterparty(counterparty || "");
    setSettlementAmount("");
    setSettlementNote("");
    setShowSettlementDialog(true);
  };

  const handleSaveSettlement = async () => {
    if (!selectedCounterparty || !settlementAmount) return;

    setIsSaving(true);
    const amount = parseInt(settlementAmount, 10);

    // 精算を記録
    await supabase.from("settlements").insert({
      date: format(new Date(), "yyyy-MM-dd"),
      counterparty: selectedCounterparty,
      amount: settlementType === "receive" ? amount : -amount,
      note: settlementNote || null,
    });

    // 該当する未精算の立替を精算済みにする
    // （簡易実装：金額に関係なく全て精算済みにする）
    await supabase
      .from("transaction_lines")
      .update({ is_settled: true })
      .eq("counterparty", selectedCounterparty)
      .eq("is_settled", false);

    setShowSettlementDialog(false);
    setIsSaving(false);
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
            <div className="space-y-4">
              <AnimatePresence>
                {balances.map((balance) => (
                  <motion.div
                    key={balance.counterparty}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{balance.counterparty}</p>
                        <p className="text-xs text-muted-foreground">
                          {balance.count}件の未精算
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenSettlement(
                        balance.totalAmount > 0 ? "receive" : "pay",
                        balance.counterparty
                      )}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
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
              {settlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="bg-card rounded-xl p-4 border border-border flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{settlement.counterparty}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(settlement.date), "yyyy/M/d", { locale: ja })}
                      {settlement.note && ` - ${settlement.note}`}
                    </p>
                  </div>
                  <span className={`font-heading font-bold tabular-nums ${
                    settlement.amount > 0 ? "text-income" : "text-expense"
                  }`}>
                    {settlement.amount > 0 ? "+" : ""}¥{Math.abs(settlement.amount).toLocaleString("ja-JP")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {settlementType === "receive" ? "精算を記録" : "返済を記録"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="pl-7"
                />
              </div>
            </div>
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
              {isSaving ? "保存中..." : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

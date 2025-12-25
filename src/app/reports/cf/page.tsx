"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  account: { id: string; name: string } | null;
}

interface AccountCashFlow {
  accountId: string;
  accountName: string;
  inflow: number;
  outflow: number;
}

export default function CFReportPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [cashFlowByAccount, setCashFlowByAccount] = useState<AccountCashFlow[]>([]);
  const [totalInflow, setTotalInflow] = useState(0);
  const [totalOutflow, setTotalOutflow] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      // Fetch transactions by payment_date
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          account:accounts(id, name)
        `)
        .gte("payment_date", monthStart)
        .lte("payment_date", monthEnd)
        .order("payment_date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        setIsLoading(false);
        return;
      }

      // Also fetch settlements for this month
      const { data: settlements } = await supabase
        .from("settlements")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      // Aggregate by account
      const accountMap = new Map<string, AccountCashFlow>();

      (transactions || []).forEach((tx) => {
        const typedTx = tx as unknown as Transaction;
        const accountId = typedTx.account?.id || "unknown";
        const accountName = typedTx.account?.name || "不明";

        if (!accountMap.has(accountId)) {
          accountMap.set(accountId, {
            accountId,
            accountName,
            inflow: 0,
            outflow: 0,
          });
        }

        const account = accountMap.get(accountId)!;
        // For now, treating all transactions as outflows (expenses)
        // TODO: Check transaction_lines for income type
        account.outflow += typedTx.total_amount;
      });

      // Add settlements to cash flow
      (settlements || []).forEach((settlement) => {
        // Settlements are cash movements
        // Positive = received money (inflow)
        // Negative = paid money (outflow)
        const settlementAccount = accountMap.get("settlement") || {
          accountId: "settlement",
          accountName: "精算",
          inflow: 0,
          outflow: 0,
        };

        if (settlement.amount > 0) {
          settlementAccount.inflow += settlement.amount;
        } else {
          settlementAccount.outflow += Math.abs(settlement.amount);
        }

        accountMap.set("settlement", settlementAccount);
      });

      const accountList = Array.from(accountMap.values()).sort(
        (a, b) => (b.outflow + b.inflow) - (a.outflow + a.inflow)
      );

      setCashFlowByAccount(accountList);
      setTotalInflow(accountList.reduce((sum, a) => sum + a.inflow, 0));
      setTotalOutflow(accountList.reduce((sum, a) => sum + a.outflow, 0));
      setIsLoading(false);
    }

    fetchData();
  }, [currentMonth]);

  const netCashFlow = totalInflow - totalOutflow;

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-xl font-bold">キャッシュフロー (CF)</h1>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-heading text-lg font-bold min-w-[120px] text-center">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-secondary/50 rounded-xl p-3 text-sm text-muted-foreground text-center">
          支払日ベースの実際のお金の動き
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-income" />
              <p className="text-xs text-muted-foreground">収入</p>
            </div>
            <p className="font-heading text-lg font-bold tabular-nums text-income">
              ¥{totalInflow.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-expense" />
              <p className="text-xs text-muted-foreground">支出</p>
            </div>
            <p className="font-heading text-lg font-bold tabular-nums text-expense">
              ¥{totalOutflow.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">純増減</p>
            <p className={`font-heading text-lg font-bold tabular-nums ${netCashFlow >= 0 ? "text-income" : "text-expense"}`}>
              {netCashFlow >= 0 ? "+" : ""}¥{netCashFlow.toLocaleString("ja-JP")}
            </p>
          </motion.div>
        </div>

        {/* Cash Flow by Account */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            支払い方法別
          </h2>
          {cashFlowByAccount.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">この月の取引なし</p>
          ) : (
            <div className="space-y-2">
              {cashFlowByAccount.map((account, index) => (
                <motion.div
                  key={account.accountId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{account.accountName}</span>
                    <span className={`font-heading font-bold tabular-nums ${
                      account.inflow - account.outflow >= 0 ? "text-income" : "text-expense"
                    }`}>
                      {account.inflow - account.outflow >= 0 ? "+" : ""}
                      ¥{(account.inflow - account.outflow).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {account.inflow > 0 && (
                      <span className="text-income">
                        +¥{account.inflow.toLocaleString("ja-JP")}
                      </span>
                    )}
                    {account.outflow > 0 && (
                      <span className="text-expense">
                        -¥{account.outflow.toLocaleString("ja-JP")}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-secondary/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">PLとCFの違い</p>
          <ul className="space-y-1 text-xs">
            <li>• <strong>PL（損益）</strong>: 発生日ベース、期間按分を考慮</li>
            <li>• <strong>CF（現金）</strong>: 支払日ベース、実際の現金移動</li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}

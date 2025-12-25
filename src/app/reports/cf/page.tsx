"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

interface TransactionLine {
  amount: number;
  line_type: string;
  category: { id: string; name: string; parent_id: string | null } | null;
}

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  account: { id: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
  transaction_lines: TransactionLine[];
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
}

interface AccountCashFlow {
  accountId: string;
  accountName: string;
  inflow: number;
  outflow: number;
  byCategory: CategoryBreakdown[];
  transactions: { description: string; amount: number; counterparty: string | null }[];
}

export default function CFReportPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [cashFlowByAccount, setCashFlowByAccount] = useState<AccountCashFlow[]>([]);
  const [totalInflow, setTotalInflow] = useState(0);
  const [totalOutflow, setTotalOutflow] = useState(0);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      // Fetch transactions with lines for category breakdown
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          account:accounts(id, name),
          counterparty:counterparties(id, name),
          transaction_lines(amount, line_type, category:categories(id, name, parent_id))
        `)
        .gte("payment_date", monthStart)
        .lte("payment_date", monthEnd)
        .order("payment_date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        setIsLoading(false);
        return;
      }

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
            byCategory: [],
            transactions: [],
          });
        }

        const account = accountMap.get(accountId)!;

        // Process transaction lines
        (typedTx.transaction_lines || []).forEach((line) => {
          const categoryId = line.category?.id || "unknown";
          const categoryName = line.category?.name || "未分類";

          if (line.line_type === "income") {
            account.inflow += line.amount;
          } else {
            account.outflow += line.amount;
          }

          // Find or create category entry
          let catEntry = account.byCategory.find((c) => c.categoryId === categoryId);
          if (!catEntry) {
            catEntry = { categoryId, categoryName, amount: 0 };
            account.byCategory.push(catEntry);
          }
          catEntry.amount += line.amount;
        });

        // Add transaction for detail view
        account.transactions.push({
          description: typedTx.description,
          amount: typedTx.total_amount,
          counterparty: typedTx.counterparty?.name || null,
        });
      });

      // Sort categories by amount
      accountMap.forEach((account) => {
        account.byCategory.sort((a, b) => b.amount - a.amount);
      });

      const accountList = Array.from(accountMap.values()).sort(
        (a, b) => b.outflow + b.inflow - (a.outflow + a.inflow)
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

  const toggleExpand = (accountId: string) => {
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
            <p
              className={`font-heading text-lg font-bold tabular-nums ${
                netCashFlow >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {netCashFlow >= 0 ? "+" : ""}¥{netCashFlow.toLocaleString("ja-JP")}
            </p>
          </motion.div>
        </div>

        {/* Cash Flow by Account */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            支払い方法別
            <span className="text-xs">（タップで展開）</span>
          </h2>
          {cashFlowByAccount.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              この月の取引なし
            </p>
          ) : (
            <div className="space-y-2">
              {cashFlowByAccount.map((account, index) => {
                const isExpanded = expandedAccounts.has(account.accountId);
                const hasDetails = account.byCategory.length > 0;
                const netFlow = account.inflow - account.outflow;

                return (
                  <div key={account.accountId}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => hasDetails && toggleExpand(account.accountId)}
                      className={`bg-card rounded-xl p-4 border border-border ${
                        hasDetails ? "cursor-pointer hover:bg-accent transition-colors" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          {hasDetails && (
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </motion.div>
                          )}
                          <span className="font-medium">{account.accountName}</span>
                          {hasDetails && (
                            <span className="text-xs text-muted-foreground">
                              ({account.transactions.length}件)
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-heading font-bold tabular-nums ${
                            netFlow >= 0 ? "text-income" : "text-expense"
                          }`}
                        >
                          {netFlow >= 0 ? "+" : ""}¥{netFlow.toLocaleString("ja-JP")}
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

                    {/* Expanded Category Breakdown */}
                    <AnimatePresence>
                      {isExpanded && hasDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="ml-4 mt-2 space-y-2 border-l-2 border-primary/20 pl-4"
                        >
                          <p className="text-xs text-muted-foreground">カテゴリ別内訳</p>
                          {account.byCategory.map((cat) => (
                            <motion.div
                              key={cat.categoryId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-secondary/50 rounded-lg p-3 flex justify-between items-center"
                            >
                              <span className="text-sm">{cat.categoryName}</span>
                              <span className="font-heading font-bold tabular-nums text-sm text-expense">
                                ¥{cat.amount.toLocaleString("ja-JP")}
                              </span>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-secondary/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">PLとCFの違い</p>
          <ul className="space-y-1 text-xs">
            <li>
              • <strong>PL（損益）</strong>: 発生日ベース、期間按分を考慮
            </li>
            <li>
              • <strong>CF（現金）</strong>: 支払日ベース、実際の現金移動
            </li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}

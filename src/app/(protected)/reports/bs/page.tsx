"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Wallet, CreditCard, Users, ChevronDown, ChevronRight, ChevronLeft, Tag, PieChart as PieChartIcon, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { supabase, type Tables } from "@/lib/supabase";
import { useViewMode } from "@/components/providers/ViewModeProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const COLORS = {
  asset: "#10b981",
  liability: "#f43f5e",
  netPositive: "#10b981",
  netNegative: "#f43f5e",
};

type Account = Tables<"accounts">;
type BalanceItem = Tables<"balance_items">;

interface CashTransaction {
  id: string;
  date: string;
  description: string;
  income: number;
  expense: number;
}

interface CashBalance {
  accountId: string;
  accountName: string;
  balance: number;
  openingBalance: number;  // 口座の初期残高
  monthStartBalance: number;  // 月初残高（前月末残高）
  totalIncome: number;  // 当月の収入
  totalExpense: number;  // 当月の支出
  transactions: CashTransaction[];  // 当月の取引
  type: string;
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  lineType: string;
}

interface AccountPayable {
  accountId: string;
  accountName: string;
  totalAmount: number;
  transactionCount: number;
  categories: CategoryBreakdown[];
}

interface CounterpartyBalance {
  counterparty: string;
  amount: number;
}

// 未収金用の型
interface AccountReceivable {
  accountId: string;
  accountName: string;
  totalAmount: number;
  transactionCount: number;
}

export default function BSReportPage() {
  const router = useRouter();
  const { filterByUser } = useViewMode();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [payablesByAccount, setPayablesByAccount] = useState<AccountPayable[]>([]);
  const [receivablesByAccount, setReceivablesByAccount] = useState<AccountReceivable[]>([]);
  const [receivables, setReceivables] = useState<CounterpartyBalance[]>([]);
  const [liabilities, setLiabilities] = useState<CounterpartyBalance[]>([]);
  const [assetItems, setAssetItems] = useState<BalanceItem[]>([]);
  const [liabilityItems, setLiabilityItems] = useState<BalanceItem[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedCashAccounts, setExpandedCashAccounts] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState(false);

  // 月選択
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number);
    return `${year}年${month}月`;
  };

  // 月の開始日と終了日を取得
  const getMonthRange = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0); // 月末
    const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    return { startDate, endDate: endDateStr };
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const { startDate, endDate } = getMonthRange(selectedMonth);

      // Fetch accounts
      let accountsQuery = supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (filterByUser && user?.id) {
        accountsQuery = accountsQuery.eq("user_id", user.id);
      }
      const { data: accountData } = await accountsQuery;

      // Fetch ALL transactions to calculate balances
      // is_cash_settled = true または settlement_account_id が設定済みの取引を取得
      let txQuery = supabase
        .from("transactions")
        .select(`
          id,
          date,
          description,
          total_amount,
          settled_amount,
          account_id,
          user_id,
          is_cash_settled,
          settlement_account_id,
          settlement_date,
          payment_date,
          transaction_lines(amount, line_type)
        `)
        .order("date", { ascending: true });
      if (filterByUser && user?.id) {
        txQuery = txQuery.eq("user_id", user.id);
      }
      const { data: allTransactions } = await txQuery;

      // 消し込み済み または 部分消し込みの取引をフィルタ
      const settledTransactions = (allTransactions || []).filter((tx: any) =>
        tx.is_cash_settled === true ||
        (tx.settlement_account_id && (tx.settled_amount || 0) > 0)
      );

      if (accountData) {
        setAccounts(accountData);

        // 口座ごとの残高と取引履歴を計算
        // current_balanceを基準に、選択月の残高を逆算する
        const accountDataMap = new Map<string, {
          openingBalance: number;
          openingDate: string | null;  // 開始日（これより前の取引は無視）
          currentBalance: number;    // DBのcurrent_balance
          monthStartBalance: number;  // 月初残高
          monthEndBalance: number;    // 月末残高
          monthIncome: number;        // 当月の収入
          monthExpense: number;       // 当月の支出
          monthTransactions: CashTransaction[];  // 当月の取引
        }>();

        // current_balanceを基準に初期化
        accountData.forEach((acc) => {
          const currentBal = acc.current_balance ?? acc.opening_balance ?? 0;
          accountDataMap.set(acc.id, {
            openingBalance: acc.opening_balance ?? 0,
            openingDate: (acc as any).opening_date || null,  // 開始日
            currentBalance: currentBal,
            monthStartBalance: currentBal,
            monthEndBalance: currentBal,
            monthIncome: 0,
            monthExpense: 0,
            monthTransactions: [],
          });
        });

        // 取引を処理して月別の変動を計算
        (settledTransactions || []).forEach((tx: any) => {
          const targetAccountId = tx.settlement_account_id || tx.account_id;
          if (!targetAccountId) return;

          const accData = accountDataMap.get(targetAccountId);
          if (!accData) return;

          // opening_dateより前の取引は無視（opening_balanceに含まれている）
          // 現金の移動日 = settlement_date > payment_date > date の優先順位
          const effectiveDate = tx.settlement_date || tx.payment_date || tx.date;
          if (accData.openingDate && effectiveDate < accData.openingDate) return;

          let totalInflow = 0;
          let totalOutflow = 0;

          (tx.transaction_lines || []).forEach((line: any) => {
            if (line.line_type === "income" || line.line_type === "liability") {
              totalInflow += line.amount || 0;
            } else if (line.line_type === "expense" || line.line_type === "asset") {
              totalOutflow += line.amount || 0;
            }
          });

          if (totalInflow === 0 && totalOutflow === 0) return;

          let netChange: number;
          if (tx.settlement_account_id) {
            const settleAmount = tx.is_cash_settled ? tx.total_amount : (tx.settled_amount || 0);
            netChange = totalInflow > totalOutflow ? settleAmount : -settleAmount;
          } else {
            netChange = totalInflow - totalOutflow;
          }

          // 選択月より後の取引 → current_balanceから引く（逆算）
          if (effectiveDate > endDate) {
            accData.monthEndBalance -= netChange;
            accData.monthStartBalance -= netChange;
          }
          // 選択月内の取引 → 当月の変動として記録
          else if (effectiveDate >= startDate && effectiveDate <= endDate) {
            accData.monthStartBalance -= netChange;  // 月初は月末から当月分を引く
            if (netChange > 0) {
              accData.monthIncome += netChange;
            } else {
              accData.monthExpense += Math.abs(netChange);
            }
            accData.monthTransactions.push({
              id: tx.id,
              date: effectiveDate,
              description: tx.description,
              income: netChange > 0 ? netChange : 0,
              expense: netChange < 0 ? Math.abs(netChange) : 0,
            });
          }
          // 選択月より前の取引 → 月末残高には既に含まれている（何もしない）
        });

        // opening_dateを考慮した調整
        accountDataMap.forEach((accData, accId) => {
          if (!accData.openingDate) return;

          // 選択月の月末がopening_dateより前の場合、この口座は表示しない
          if (endDate < accData.openingDate) {
            accData.monthEndBalance = accData.openingBalance;
            accData.monthStartBalance = accData.openingBalance;
            accData.monthTransactions = [];
            accData.monthIncome = 0;
            accData.monthExpense = 0;
            return;
          }

          // 選択月がopening_dateを含む場合（月初 <= opening_date <= 月末）
          // opening_balanceから順方向に計算する
          if (startDate <= accData.openingDate && accData.openingDate <= endDate) {
            accData.monthStartBalance = accData.openingBalance;
            // 月末残高 = 開始残高 + 当月の収入 - 当月の支出
            accData.monthEndBalance = accData.openingBalance + accData.monthIncome - accData.monthExpense;
          }
          // 選択月がopening_dateより後の場合（通常の逆算ロジック）
          else if (startDate > accData.openingDate) {
            // monthStartBalance, monthEndBalanceは逆算済みなのでそのまま
          }
          // 選択月の月初がopening_dateと同じ場合
          else if (startDate <= accData.openingDate) {
            accData.monthStartBalance = accData.openingBalance;
          }
        });

        // 現預金リストを作成
        const cashList: CashBalance[] = accountData
          .filter((acc) => {
            const accData = accountDataMap.get(acc.id);
            return accData && (accData.monthEndBalance !== 0 || accData.openingBalance !== 0);
          })
          .map((acc) => {
            const accData = accountDataMap.get(acc.id)!;
            return {
              accountId: acc.id,
              accountName: acc.name,
              balance: accData.monthEndBalance,
              openingBalance: accData.openingBalance,
              monthStartBalance: accData.monthStartBalance,
              totalIncome: accData.monthIncome,
              totalExpense: accData.monthExpense,
              transactions: accData.monthTransactions,
              type: acc.type,
            };
          })
          .sort((a, b) => b.balance - a.balance);
        setCashBalances(cashList);
      }

      // Fetch unpaid transactions (未払金/未収金) - where is_cash_settled = false
      // 未払金はexpense、未収金はincomeタイプの行を持つ取引を対象とする
      const { data: unpaidTransactions } = await supabase
        .from("transactions")
        .select(`
          id,
          total_amount,
          settled_amount,
          account_id,
          account:accounts!transactions_account_id_fkey(id, name),
          transaction_lines(
            amount,
            line_type,
            category:categories(id, name)
          )
        `)
        .eq("is_cash_settled", false);

      // Aggregate by account
      const accountPayableMap = new Map<string, AccountPayable>();
      const accountReceivableMap = new Map<string, AccountReceivable>();

      (unpaidTransactions || []).forEach((tx: any) => {
        if (!tx.account) return;

        const accountId = tx.account.id;
        const accountName = tx.account.name;

        // 入金と出金の合計を計算してネット金額で判定
        // 入金 = income + liability (借入)
        // 出金 = expense のみ（assetは立替金として別管理されるので除外）
        let totalInflow = 0;
        let totalExpense = 0;
        let totalAsset = 0;
        (tx.transaction_lines || []).forEach((line: any) => {
          if (line.line_type === "income" || line.line_type === "liability") {
            totalInflow += line.amount;
          } else if (line.line_type === "expense") {
            totalExpense += line.amount;
          } else if (line.line_type === "asset") {
            totalAsset += line.amount;
          }
        });

        // 純粋な立替のみの取引は未払金から除外（立替金セクションで表示）
        const totalOutflow = totalExpense;

        // 一部消し込み対応：残額を計算
        const remainingAmount = tx.total_amount - (tx.settled_amount || 0);

        // ネット金額で未収金か未払金かを判定（重複計上を防ぐ）
        const isNetReceivable = totalInflow > totalOutflow;
        const isNetPayable = totalOutflow > totalInflow;

        // 未収金として集計（入金 > 出金の取引）
        if (isNetReceivable) {
          if (!accountReceivableMap.has(accountId)) {
            accountReceivableMap.set(accountId, {
              accountId,
              accountName,
              totalAmount: 0,
              transactionCount: 0,
            });
          }
          const receivable = accountReceivableMap.get(accountId)!;
          receivable.totalAmount += remainingAmount;
          receivable.transactionCount += 1;
        }

        // 未払金として集計（出金 > 入金の取引、立替含む）
        if (isNetPayable) {
          if (!accountPayableMap.has(accountId)) {
            accountPayableMap.set(accountId, {
              accountId,
              accountName,
              totalAmount: 0,
              transactionCount: 0,
              categories: [],
            });
          }

          const payable = accountPayableMap.get(accountId)!;
          payable.totalAmount += remainingAmount;
          payable.transactionCount += 1;

          // カテゴリ別内訳（expenseのみ、assetは立替金セクションで表示）
          (tx.transaction_lines || []).forEach((line: any) => {
            // expense以外は除外（assetは立替金として別管理）
            if (line.line_type !== "expense") return;

            const categoryId = line.category?.id || "expense-uncategorized";
            const categoryName = line.category?.name || "未分類";

            // line_typeごとに分けて集計
            const key = `${categoryId}-${line.line_type}`;
            const existingCat = payable.categories.find(
              (c) => c.categoryId === key
            );
            if (existingCat) {
              existingCat.amount += line.amount;
            } else {
              payable.categories.push({
                categoryId: key,
                categoryName: categoryName,
                amount: line.amount,
                lineType: line.line_type,
              });
            }
          });
        }
      });

      const payableList = Array.from(accountPayableMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);

      // Sort categories within each payable
      payableList.forEach((p) => {
        p.categories.sort((a, b) => b.amount - a.amount);
      });

      setPayablesByAccount(payableList);

      // 未収金リストを設定
      const receivableList = Array.from(accountReceivableMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);
      setReceivablesByAccount(receivableList);

      // Fetch unsettled receivables/liabilities (立替・借入) - 部分精算対応
      const { data: lines } = await supabase
        .from("transaction_lines")
        .select("amount, line_type, counterparty, is_settled, settled_amount")
        .not("counterparty", "is", null);

      const receivableMap = new Map<string, number>();
      const liabilityMap = new Map<string, number>();

      (lines || []).forEach((line) => {
        if (!line.counterparty) return;

        // 未精算金額を計算: amount - settled_amount
        // is_settledがtrueでsettled_amountが0の場合は全額精算済み（旧データ対応）
        const settledAmount = line.settled_amount ?? 0;
        const unsettledAmount = line.is_settled && settledAmount === 0
          ? 0  // 旧ロジックで精算済みになったもの
          : line.amount - settledAmount;

        if (unsettledAmount <= 0) return;  // 全額精算済みはスキップ

        if (line.line_type === "asset") {
          receivableMap.set(
            line.counterparty,
            (receivableMap.get(line.counterparty) || 0) + unsettledAmount
          );
        } else if (line.line_type === "liability") {
          liabilityMap.set(
            line.counterparty,
            (liabilityMap.get(line.counterparty) || 0) + unsettledAmount
          );
        }
      });

      const counterpartyReceivableList: CounterpartyBalance[] = [];
      receivableMap.forEach((amount, counterparty) => {
        counterpartyReceivableList.push({ counterparty, amount });
      });

      const liabilityList: CounterpartyBalance[] = [];
      liabilityMap.forEach((amount, counterparty) => {
        liabilityList.push({ counterparty, amount });
      });

      setReceivables(counterpartyReceivableList.sort((a, b) => b.amount - a.amount));
      setLiabilities(liabilityList.sort((a, b) => b.amount - a.amount));

      // Fetch balance_items (投資、ローンなど)
      const { data: balanceItems } = await supabase
        .from("balance_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (balanceItems) {
        setAssetItems(balanceItems.filter(i => i.item_type === "asset"));
        setLiabilityItems(balanceItems.filter(i => i.item_type === "liability"));
      }

      setIsLoading(false);
    }

    fetchData();
  }, [selectedMonth, filterByUser, user?.id]);

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

  const toggleCashAccountExpand = (accountId: string) => {
    setExpandedCashAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const totalPayables = payablesByAccount.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalReceivables = receivables.reduce((sum, r) => sum + r.amount, 0); // 立替金
  const totalAccountsReceivable = receivablesByAccount.reduce((sum, r) => sum + r.totalAmount, 0); // 未収金
  const totalBorrowings = liabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalCash = cashBalances.reduce((sum, c) => sum + c.balance, 0); // 現預金
  const totalAssetItems = assetItems.reduce((sum, i) => sum + i.balance, 0); // その他資産
  const totalLiabilityItems = liabilityItems.reduce((sum, i) => sum + i.balance, 0); // その他負債

  // 資産合計 = 現預金 + 立替金（債権）+ 未収金 + その他資産
  const totalAssets = totalCash + totalReceivables + totalAccountsReceivable + totalAssetItems;
  // 負債合計 = 未払金 + 借入金 + その他負債
  const totalLiabilities = totalPayables + totalBorrowings + totalLiabilityItems;
  // 純資産 = 資産 - 負債
  const netPosition = totalAssets - totalLiabilities;

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
            <h1 className="font-heading text-xl font-bold">貸借対照表 (BS)</h1>
          </div>
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-medium text-sm min-w-[100px] text-center">
              {formatMonthDisplay(selectedMonth)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:order-2 lg:sticky lg:top-24 lg:self-start">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">資産</p>
            <p className="font-heading text-sm font-bold tabular-nums text-income whitespace-nowrap overflow-hidden">
              ¥{totalAssets.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">負債</p>
            <p className="font-heading text-sm font-bold tabular-nums text-expense whitespace-nowrap overflow-hidden">
              ¥{totalLiabilities.toLocaleString("ja-JP")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-3 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">純資産</p>
            <p className={`font-heading text-sm font-bold tabular-nums whitespace-nowrap overflow-hidden ${netPosition >= 0 ? "text-income" : "text-expense"}`}>
              {netPosition >= 0 ? "" : ""}¥{netPosition.toLocaleString("ja-JP")}
            </p>
          </motion.div>
            </div>

            {/* Chart Toggle Button */}
            <button
              onClick={() => setShowChart(!showChart)}
              className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
                showChart
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-accent"
              }`}
            >
              <PieChartIcon className="w-4 h-4" />
              <span className="text-sm">資産・負債グラフ</span>
            </button>

            {/* BS Chart - T字型 */}
            <AnimatePresence>
              {showChart && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">
                    貸借対照表
                  </h3>
                  {/* T字型レイアウト */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* 左側：資産 */}
                    <div className="border-r border-border pr-2">
                      <p className="text-xs text-muted-foreground text-center mb-2 font-medium">資産</p>
                      <div className="space-y-1">
                        {/* 現預金 */}
                        {cashBalances.map((item) => (
                          <div key={item.accountId} className="flex justify-between text-xs">
                            <span className="truncate">{item.accountName}</span>
                            <span className="text-income ml-1">¥{item.balance.toLocaleString()}</span>
                          </div>
                        ))}
                        {/* 未収金 */}
                        {receivablesByAccount.map((item) => (
                          <div key={item.accountId} className="flex justify-between text-xs">
                            <span className="truncate">未収金({item.accountName})</span>
                            <span className="text-income ml-1">¥{item.totalAmount.toLocaleString()}</span>
                          </div>
                        ))}
                        {/* 立替金 */}
                        {receivables.map((item) => (
                          <div key={item.counterparty} className="flex justify-between text-xs">
                            <span className="truncate">立替({item.counterparty})</span>
                            <span className="text-income ml-1">¥{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        {cashBalances.length === 0 && receivablesByAccount.length === 0 && receivables.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center">-</p>
                        )}
                      </div>
                      <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-bold">
                        <span>合計</span>
                        <span className="text-income">¥{totalAssets.toLocaleString()}</span>
                      </div>
                    </div>
                    {/* 右側：負債 + 純資産 */}
                    <div className="pl-2">
                      <p className="text-xs text-muted-foreground text-center mb-2 font-medium">負債・純資産</p>
                      <div className="space-y-1">
                        {/* 未払金 */}
                        {payablesByAccount.map((p) => (
                          <div key={p.accountId} className="flex justify-between text-xs">
                            <span className="truncate">{p.accountName}</span>
                            <span className="text-expense ml-1">¥{p.totalAmount.toLocaleString()}</span>
                          </div>
                        ))}
                        {/* 借入金 */}
                        {liabilities.map((item) => (
                          <div key={item.counterparty} className="flex justify-between text-xs">
                            <span className="truncate">{item.counterparty}</span>
                            <span className="text-expense ml-1">¥{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        {payablesByAccount.length === 0 && liabilities.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center">-</p>
                        )}
                      </div>
                      <div className="border-t border-border mt-2 pt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>負債計</span>
                          <span className="text-expense">¥{totalLiabilities.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span>純資産</span>
                          <span className={netPosition >= 0 ? "text-income" : "text-expense"}>
                            ¥{netPosition.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
                          <span>合計</span>
                          <span>¥{(totalLiabilities + netPosition).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-6 lg:order-1">
        {/* 資産の部 */}
        <div className="space-y-4">
          <h2 className="text-base font-bold border-b border-border pb-2">資産の部</h2>

          {/* 現預金 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-income" />
              現預金
            </h3>
            {cashBalances.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">現預金の登録なし</p>
            ) : (
              <div className="space-y-2">
                {cashBalances.map((item, index) => {
                  const isExpanded = expandedCashAccounts.has(item.accountId);
                  return (
                    <motion.div
                      key={item.accountId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      <button
                        onClick={() => toggleCashAccountExpand(item.accountId)}
                        className="w-full p-4 flex justify-between items-center transition-colors hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-muted-foreground" />
                          <span>{item.accountName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-heading font-bold tabular-nums ${item.balance >= 0 ? "text-income" : "text-expense"}`}>
                            ¥{item.balance.toLocaleString("ja-JP")}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border"
                          >
                            <div className="p-4 pt-3 space-y-2 bg-secondary/30">
                              <p className="text-xs text-muted-foreground mb-2">当月の増減</p>
                              {/* 月初残高 */}
                              <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">月初残高</span>
                                </div>
                                <span className="tabular-nums">
                                  ¥{item.monthStartBalance.toLocaleString("ja-JP")}
                                </span>
                              </div>
                              {/* 取引一覧 */}
                              {item.transactions.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">この月の取引なし</p>
                              ) : (
                                item.transactions.map((tx) => (
                                  <div
                                    key={tx.id}
                                    className="flex justify-between items-center text-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">{tx.date.slice(5)}</span>
                                      <span className="truncate max-w-[120px]">{tx.description}</span>
                                    </div>
                                    <span className={`tabular-nums ${tx.income > tx.expense ? "text-income" : "text-expense"}`}>
                                      {tx.income > tx.expense ? "+" : "-"}¥{Math.abs(tx.income - tx.expense).toLocaleString("ja-JP")}
                                    </span>
                                  </div>
                                ))
                              )}
                              {/* 合計 */}
                              {item.transactions.length > 0 && (
                                <>
                                  <div className="border-t border-border pt-2 mt-2 flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">収入計</span>
                                    <span className="tabular-nums text-income">+¥{item.totalIncome.toLocaleString("ja-JP")}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">支出計</span>
                                    <span className="tabular-nums text-expense">-¥{item.totalExpense.toLocaleString("ja-JP")}</span>
                                  </div>
                                </>
                              )}
                              <div className="border-t border-border pt-2 flex justify-between items-center text-sm font-bold">
                                <span>月末残高</span>
                                <span className={`tabular-nums ${item.balance >= 0 ? "text-income" : "text-expense"}`}>
                                  ¥{item.balance.toLocaleString("ja-JP")}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                <div className="bg-secondary/30 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">現預金計</span>
                  <span className="font-heading font-bold tabular-nums text-income">
                    ¥{totalCash.toLocaleString("ja-JP")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 未収金 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-income" />
              未収金
            </h3>
            {receivablesByAccount.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">未収金なし</p>
            ) : (
              <div className="space-y-2">
                {receivablesByAccount.map((item, index) => (
                  <motion.div
                    key={item.accountId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                  >
                    <div>
                      <p>{item.accountName}</p>
                      <p className="text-xs text-muted-foreground">{item.transactionCount}件</p>
                    </div>
                    <span className="font-heading font-bold tabular-nums text-income">
                      ¥{item.totalAmount.toLocaleString("ja-JP")}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 立替金（債権） */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-income" />
              立替金（債権）
            </h3>
            {receivables.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">立替なし</p>
            ) : (
              <div className="space-y-2">
                {receivables.map((item, index) => (
                  <motion.div
                    key={item.counterparty}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                  >
                    <span>{item.counterparty}</span>
                    <span className="font-heading font-bold tabular-nums text-income">
                      ¥{item.amount.toLocaleString("ja-JP")}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* その他資産（投資など） */}
          {assetItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-income" />
                その他資産
              </h3>
              <div className="space-y-2">
                {assetItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                  >
                    <div>
                      <span>{item.name}</span>
                      {item.balance_date && (
                        <p className="text-xs text-muted-foreground">{item.balance_date}時点</p>
                      )}
                    </div>
                    <span className="font-heading font-bold tabular-nums text-income">
                      ¥{item.balance.toLocaleString("ja-JP")}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 資産合計 */}
          <div className="bg-secondary/50 rounded-xl p-4 flex justify-between items-center">
            <span className="font-medium">資産合計</span>
            <span className="font-heading font-bold tabular-nums text-income">
              ¥{totalAssets.toLocaleString("ja-JP")}
            </span>
          </div>
        </div>

        {/* 負債の部 */}
        <div className="space-y-4">
          <h2 className="text-base font-bold border-b border-border pb-2">負債の部</h2>

          {/* 未払金（支払い方法別） */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-expense" />
              未払金
            </h3>
            {payablesByAccount.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">未払いなし</p>
            ) : (
              <div className="space-y-2">
                {payablesByAccount.map((payable, index) => {
                  const isExpanded = expandedAccounts.has(payable.accountId);
                  return (
                    <motion.div
                      key={payable.accountId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      <button
                        onClick={() => toggleAccountExpand(payable.accountId)}
                        className="w-full p-4 flex justify-between items-center hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium">{payable.accountName}</p>
                            <p className="text-xs text-muted-foreground">
                              {payable.transactionCount}件
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold tabular-nums text-expense">
                            ¥{payable.totalAmount.toLocaleString("ja-JP")}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border"
                          >
                            <div className="p-4 pt-3 space-y-2 bg-secondary/30">
                              <p className="text-xs text-muted-foreground mb-2">カテゴリ別内訳</p>
                              {payable.categories.map((cat) => (
                                <div
                                  key={cat.categoryId}
                                  className="flex justify-between items-center text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <Tag className="w-3 h-3 text-muted-foreground" />
                                    <span>{cat.categoryName}</span>
                                  </div>
                                  <span className="tabular-nums">
                                    ¥{cat.amount.toLocaleString("ja-JP")}
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
            )}
          </div>

          {/* 借入金 */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-expense" />
              借入金
            </h3>
            {liabilities.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">借入なし</p>
            ) : (
              <div className="space-y-2">
                {liabilities.map((item, index) => (
                  <motion.div
                    key={item.counterparty}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                  >
                    <span>{item.counterparty}</span>
                    <span className="font-heading font-bold tabular-nums text-expense">
                      ¥{item.amount.toLocaleString("ja-JP")}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* その他負債（ローンなど） */}
          {liabilityItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-expense" />
                その他負債
              </h3>
              <div className="space-y-2">
                {liabilityItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
                  >
                    <div>
                      <span>{item.name}</span>
                      {item.balance_date && (
                        <p className="text-xs text-muted-foreground">{item.balance_date}時点</p>
                      )}
                    </div>
                    <span className="font-heading font-bold tabular-nums text-expense">
                      ¥{item.balance.toLocaleString("ja-JP")}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 負債合計 */}
          <div className="bg-secondary/50 rounded-xl p-4 flex justify-between items-center">
            <span className="font-medium">負債合計</span>
            <span className="font-heading font-bold tabular-nums text-expense">
              ¥{totalLiabilities.toLocaleString("ja-JP")}
            </span>
          </div>
        </div>

        {/* 純資産 */}
        <div className="bg-primary/10 rounded-xl p-4 flex justify-between items-center border border-primary/30">
          <span className="font-bold">純資産（資産 − 負債）</span>
          <span className={`font-heading text-lg font-bold tabular-nums ${netPosition >= 0 ? "text-income" : "text-expense"}`}>
            ¥{netPosition.toLocaleString("ja-JP")}
          </span>
        </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Wallet, CreditCard, Users, ChevronDown, ChevronRight, Tag, PieChart as PieChartIcon } from "lucide-react";
import { supabase, type Tables } from "@/lib/supabase";
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

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
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

export default function BSReportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payablesByAccount, setPayablesByAccount] = useState<AccountPayable[]>([]);
  const [receivables, setReceivables] = useState<CounterpartyBalance[]>([]);
  const [liabilities, setLiabilities] = useState<CounterpartyBalance[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      // Fetch accounts
      const { data: accountData } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (accountData) {
        setAccounts(accountData);
      }

      // Fetch unpaid transactions (未払金) - where is_cash_settled = false
      // 未払金はexpense/incomeタイプの行のみを対象とする（asset/liabilityは除外）
      const { data: unpaidTransactions } = await supabase
        .from("transactions")
        .select(`
          id,
          total_amount,
          account_id,
          account:accounts(id, name),
          transaction_lines(
            amount,
            line_type,
            category:categories(id, name)
          )
        `)
        .eq("is_cash_settled", false);

      // Aggregate by account
      const accountPayableMap = new Map<string, AccountPayable>();

      (unpaidTransactions || []).forEach((tx: any) => {
        if (!tx.account) return;

        const accountId = tx.account.id;
        const accountName = tx.account.name;

        // expense行があるかチェック（支出を含む取引のみ未払金として計上）
        const hasExpense = (tx.transaction_lines || []).some(
          (line: any) => line.line_type === "expense"
        );

        if (!hasExpense) return;

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

        // 取引全体のtotal_amountを未払金として計上（立替を含む場合も全額カード払い）
        payable.totalAmount += tx.total_amount;
        payable.transactionCount += 1;

        // カテゴリ別内訳（expense行のみ）
        (tx.transaction_lines || []).forEach((line: any) => {
          if (line.line_type !== "expense") return;
          if (!line.category) return;

          const existingCat = payable.categories.find(
            (c) => c.categoryId === line.category.id
          );
          if (existingCat) {
            existingCat.amount += line.amount;
          } else {
            payable.categories.push({
              categoryId: line.category.id,
              categoryName: line.category.name,
              amount: line.amount,
            });
          }
        });
      });

      const payableList = Array.from(accountPayableMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);

      // Sort categories within each payable
      payableList.forEach((p) => {
        p.categories.sort((a, b) => b.amount - a.amount);
      });

      setPayablesByAccount(payableList);

      // Fetch unsettled receivables/liabilities (立替・借入)
      const { data: lines } = await supabase
        .from("transaction_lines")
        .select("amount, line_type, counterparty")
        .eq("is_settled", false)
        .not("counterparty", "is", null);

      const receivableMap = new Map<string, number>();
      const liabilityMap = new Map<string, number>();

      (lines || []).forEach((line) => {
        if (!line.counterparty) return;

        if (line.line_type === "asset") {
          receivableMap.set(
            line.counterparty,
            (receivableMap.get(line.counterparty) || 0) + line.amount
          );
        } else if (line.line_type === "liability") {
          liabilityMap.set(
            line.counterparty,
            (liabilityMap.get(line.counterparty) || 0) + line.amount
          );
        }
      });

      const receivableList: CounterpartyBalance[] = [];
      receivableMap.forEach((amount, counterparty) => {
        receivableList.push({ counterparty, amount });
      });

      const liabilityList: CounterpartyBalance[] = [];
      liabilityMap.forEach((amount, counterparty) => {
        liabilityList.push({ counterparty, amount });
      });

      setReceivables(receivableList.sort((a, b) => b.amount - a.amount));
      setLiabilities(liabilityList.sort((a, b) => b.amount - a.amount));
      setIsLoading(false);
    }

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

  const totalPayables = payablesByAccount.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalReceivables = receivables.reduce((sum, r) => sum + r.amount, 0);
  const totalBorrowings = liabilities.reduce((sum, l) => sum + l.amount, 0);

  // 資産合計 = 立替金（債権）
  const totalAssets = totalReceivables;
  // 負債合計 = 未払金 + 借入金
  const totalLiabilities = totalPayables + totalBorrowings;
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-xl font-bold">貸借対照表 (BS)</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
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
                    {receivables.length > 0 ? (
                      receivables.map((item) => (
                        <div key={item.counterparty} className="flex justify-between text-xs">
                          <span className="truncate">{item.counterparty}</span>
                          <span className="text-income ml-1">¥{item.amount.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
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

        {/* 資産の部 */}
        <div className="space-y-4">
          <h2 className="text-base font-bold border-b border-border pb-2">資産の部</h2>

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

        {/* Accounts List */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            登録口座・支払い方法
          </h2>
          <div className="space-y-2">
            {accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-xl p-4 border border-border flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  {account.type === "card" ? (
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>{account.name}</span>
                  {account.owner === "shared" && (
                    <span className="text-xs text-muted-foreground">(共同)</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize">{account.type}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

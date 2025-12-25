"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Calendar, CreditCard, Wallet, Tag, Clock } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface TransactionLine {
  id: string;
  amount: number;
  line_type: string;
  counterparty: string | null;
  amortization_months: number | null;
  amortization_start: string | null;
  amortization_end: string | null;
  category: { name: string } | null;
}

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  created_at: string;
  account: { name: string } | null;
  transaction_lines: TransactionLine[];
}

const lineTypeLabels: Record<string, string> = {
  expense: "費用",
  income: "収入",
  asset: "立替（債権）",
  liability: "借入（債務）",
};

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTransaction() {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          created_at,
          account:accounts(name),
          transaction_lines(
            id,
            amount,
            line_type,
            counterparty,
            amortization_months,
            amortization_start,
            amortization_end,
            category:categories(name)
          )
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching transaction:", error);
        setIsLoading(false);
        return;
      }

      setTransaction(data as unknown as Transaction);
      setIsLoading(false);
    }

    fetchTransaction();
  }, [id]);

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

  if (!transaction) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">取引が見つかりません</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            戻る
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Calculate if this is primarily income or expense
  const incomeTotal = transaction.transaction_lines
    ?.filter((l) => l.line_type === "income")
    .reduce((sum, l) => sum + l.amount, 0) || 0;
  const expenseTotal = transaction.transaction_lines
    ?.filter((l) => l.line_type !== "income")
    .reduce((sum, l) => sum + l.amount, 0) || 0;
  const isIncome = incomeTotal > expenseTotal;

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
          <h1 className="font-heading text-xl font-bold">取引詳細</h1>
        </div>

        {/* Main Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-5 border border-border"
        >
          <div className="text-center mb-4">
            <p className="text-muted-foreground text-sm mb-1">{transaction.description}</p>
            <p className={`font-heading text-3xl font-bold tabular-nums ${isIncome ? "text-income" : "text-expense"}`}>
              {isIncome ? "+" : "-"}¥{transaction.total_amount.toLocaleString("ja-JP")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">発生日</p>
                <p>{format(new Date(transaction.date), "yyyy/M/d", { locale: ja })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">{isIncome ? "入金日" : "支払日"}</p>
                <p>
                  {transaction.payment_date
                    ? format(new Date(transaction.payment_date), "yyyy/M/d", { locale: ja })
                    : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground text-xs">{isIncome ? "入金先" : "支払い方法"}</p>
                <p>{transaction.account?.name || "不明"}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Transaction Lines */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">内訳</h2>
          <div className="space-y-3">
            {transaction.transaction_lines.map((line, index) => {
              const lineIsIncome = line.line_type === "income";
              return (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{line.category?.name || "未分類"}</span>
                    </div>
                    <span className={`font-heading font-bold tabular-nums ${lineIsIncome ? "text-income" : "text-expense"}`}>
                      {lineIsIncome ? "+" : "-"}¥{line.amount.toLocaleString("ja-JP")}
                    </span>
                  </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-secondary rounded-full">
                    {lineTypeLabels[line.line_type] || line.line_type}
                  </span>
                  {line.counterparty && (
                    <span className="px-2 py-1 bg-secondary rounded-full">
                      {line.counterparty}
                    </span>
                  )}
                  {line.amortization_months && line.amortization_months > 1 && (
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {line.amortization_months}ヶ月按分
                    </span>
                  )}
                </div>

                {line.amortization_start && line.amortization_end && (
                  <p className="text-xs text-muted-foreground mt-2">
                    按分期間: {format(new Date(line.amortization_start), "yyyy/M/d")} 〜{" "}
                    {format(new Date(line.amortization_end), "yyyy/M/d")}
                  </p>
                )}
              </motion.div>
              );
            })}
          </div>
        </div>

        {/* Meta Info */}
        <div className="text-xs text-muted-foreground text-center">
          <p>
            作成日時: {format(new Date(transaction.created_at), "yyyy/M/d HH:mm", { locale: ja })}
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

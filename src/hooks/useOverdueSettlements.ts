"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface OverdueTransaction {
  id: string;
  date: string;
  payment_date: string;
  description: string;
  total_amount: number;
  settled_amount: number;
  account_name: string;
  days_overdue: number;
}

interface UseOverdueSettlementsReturn {
  overdueTransactions: OverdueTransaction[];
  overdueCount: number;
  totalOverdueAmount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useOverdueSettlements(): UseOverdueSettlementsReturn {
  const [overdueTransactions, setOverdueTransactions] = useState<OverdueTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverdue = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id,
        date,
        payment_date,
        description,
        total_amount,
        settled_amount,
        account:accounts!transactions_account_id_fkey(name)
      `)
      .eq("is_cash_settled", false)
      .not("payment_date", "is", null)
      .lt("payment_date", today)
      .order("payment_date", { ascending: true });

    if (error) {
      console.error("Error fetching overdue settlements:", error);
      setIsLoading(false);
      return;
    }

    const transactions: OverdueTransaction[] = (data || []).map((tx: any) => {
      const paymentDate = new Date(tx.payment_date);
      const now = new Date();
      const diffTime = now.getTime() - paymentDate.getTime();
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: tx.id,
        date: tx.date,
        payment_date: tx.payment_date,
        description: tx.description,
        total_amount: tx.total_amount,
        settled_amount: tx.settled_amount || 0,
        account_name: tx.account?.name || "不明",
        days_overdue: daysOverdue,
      };
    });

    setOverdueTransactions(transactions);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOverdue();
  }, []);

  const overdueCount = overdueTransactions.length;
  const totalOverdueAmount = overdueTransactions.reduce(
    (sum, tx) => sum + (tx.total_amount - tx.settled_amount),
    0
  );

  return {
    overdueTransactions,
    overdueCount,
    totalOverdueAmount,
    isLoading,
    refetch: fetchOverdue,
  };
}

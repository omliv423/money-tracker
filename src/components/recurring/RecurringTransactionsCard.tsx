"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useViewMode } from "@/components/providers/ViewModeProvider";
import { format, addDays, lastDayOfMonth, setDate } from "date-fns";

type RecurringTransaction = {
  id: string;
  name: string;
  description: string | null;
  account_id: string | null;
  total_amount: number;
  day_of_month: number | null;
  payment_delay_days: number;
  lines: {
    amount: number;
    category_id: string | null;
    line_type: string;
    counterparty: string | null;
  }[];
};

interface RecurringTransactionsCardProps {
  embedded?: boolean;
}

export function RecurringTransactionsCard({ embedded = false }: RecurringTransactionsCardProps) {
  const { user } = useAuth();
  const { filterByUser } = useViewMode();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [registeredThisMonth, setRegisteredThisMonth] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch active recurring transactions
    const { data: recurringData } = await supabase
      .from("recurring_transactions")
      .select(`
        id, name, description, account_id, total_amount, day_of_month, payment_delay_days,
        recurring_transaction_lines(amount, category_id, line_type, counterparty)
      `)
      .eq("is_active", true)
      .order("day_of_month");

    // Check which recurring transactions have been registered this month
    // by looking for transactions with matching description in current month
    const now = new Date();
    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
    const monthEnd = format(lastDayOfMonth(now), "yyyy-MM-dd");

    let txQuery = supabase
      .from("transactions")
      .select("description, user_id")
      .gte("date", monthStart)
      .lte("date", monthEnd);

    // In personal mode, only check the current user's transactions
    if (filterByUser && user?.id) {
      txQuery = txQuery.eq("user_id", user.id);
    }

    const { data: thisMonthTxs } = await txQuery;

    const registeredDescriptions = new Set(
      (thisMonthTxs || []).map((tx) => tx.description?.toLowerCase())
    );

    // Mark recurring transactions as registered if description matches
    const registered = new Set<string>();
    (recurringData || []).forEach((item) => {
      const descToCheck = (item.description || item.name).toLowerCase();
      if (registeredDescriptions.has(descToCheck)) {
        registered.add(item.id);
      }
    });

    setItems(
      (recurringData || []).map((item) => ({
        ...item,
        lines: item.recurring_transaction_lines || [],
      }))
    );
    setRegisteredThisMonth(registered);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterByUser, user?.id]);

  const handleRegister = async (item: RecurringTransaction) => {
    setRegisteringId(item.id);

    const now = new Date();
    const day = item.day_of_month || 1;

    // Calculate accrual date (発生日)
    let accrualDate = setDate(now, Math.min(day, lastDayOfMonth(now).getDate()));

    // Calculate payment date based on delay
    let paymentDate: Date | null = null;
    if (item.payment_delay_days === 0) {
      paymentDate = accrualDate;
    } else if (item.payment_delay_days > 0) {
      paymentDate = addDays(accrualDate, item.payment_delay_days);
    }

    const isCashSettled = paymentDate && paymentDate <= accrualDate;

    // Create transaction
    if (!item.account_id) {
      console.error("Account is required");
      setRegisteringId(null);
      return;
    }

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user?.id,
        date: format(accrualDate, "yyyy-MM-dd"),
        payment_date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : null,
        description: item.description || item.name,
        account_id: item.account_id,
        total_amount: item.total_amount,
        is_cash_settled: isCashSettled,
        settled_amount: isCashSettled ? item.total_amount : 0,
      })
      .select()
      .single();

    if (txError || !tx) {
      console.error("Error creating transaction:", txError);
      setRegisteringId(null);
      return;
    }

    // Create transaction lines
    if (item.lines.length > 0) {
      const lineInserts = item.lines.map((line) => ({
        transaction_id: tx.id,
        amount: line.amount,
        category_id: line.category_id,
        line_type: line.line_type,
        counterparty: line.counterparty,
        is_settled: false,
      }));

      await supabase.from("transaction_lines").insert(lineInserts);
    }

    // Update local state
    setRegisteredThisMonth((prev) => new Set([...prev, item.id]));
    setRegisteringId(null);
  };

  const pendingItems = items.filter((item) => !registeredThisMonth.has(item.id));
  const completedItems = items.filter((item) => registeredThisMonth.has(item.id));

  if (isLoading) {
    return null;
  }

  if (items.length === 0) {
    return embedded ? (
      <div className="text-center py-8 text-muted-foreground">
        定期取引はありません
      </div>
    ) : null;
  }

  // Embedded mode - show content directly without card wrapper
  if (embedded) {
    return (
      <div className="space-y-2">
        {/* Pending items */}
        {pendingItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between bg-secondary/50 rounded-lg p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{item.name}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{item.day_of_month}日</span>
                <span>•</span>
                <span className="font-mono">
                  ¥{item.total_amount.toLocaleString()}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleRegister(item)}
              disabled={registeringId === item.id}
              className="ml-2"
            >
              {registeringId === item.id ? "登録中..." : "登録"}
            </Button>
          </div>
        ))}

        {/* Completed items */}
        {completedItems.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">今月登録済み</p>
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg p-2 opacity-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{item.name}</p>
                </div>
                <Check className="w-4 h-4 text-primary" />
              </div>
            ))}
          </div>
        )}

        {/* All done */}
        {pendingItems.length === 0 && completedItems.length > 0 && (
          <div className="text-center py-2 text-sm text-muted-foreground">
            今月の定期取引はすべて登録済みです
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          <span className="font-medium">定期取引</span>
          {pendingItems.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
              {pendingItems.length}件未登録
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Pending items */}
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-secondary/50 rounded-lg p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{item.day_of_month}日</span>
                      <span>•</span>
                      <span className="font-mono">
                        ¥{item.total_amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRegister(item)}
                    disabled={registeringId === item.id}
                    className="ml-2"
                  >
                    {registeringId === item.id ? "登録中..." : "登録"}
                  </Button>
                </div>
              ))}

              {/* Completed items */}
              {completedItems.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">今月登録済み</p>
                  {completedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg p-2 opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{item.name}</p>
                      </div>
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  ))}
                </div>
              )}

              {/* All done */}
              {pendingItems.length === 0 && completedItems.length > 0 && (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  今月の定期取引はすべて登録済みです
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

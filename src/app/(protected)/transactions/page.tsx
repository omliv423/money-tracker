"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ChevronRight, Calendar, Trash2, Filter, X, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase, type Tables } from "@/lib/supabase";
import { useViewMode } from "@/components/providers/ViewModeProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryPicker } from "@/components/transaction/CategoryPicker";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;

interface TransactionLine {
  amount: number;
  line_type: string;
  category_id: string | null;
}

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  account_id: string | null;
  paid_by_other: boolean;
  is_shared: boolean;
  account: { name: string } | null;
  transaction_lines: TransactionLine[];
}

interface GroupedTransactions {
  date: string;
  transactions: Transaction[];
}

interface Filters {
  accountId: string;
  categoryId: string;
  transactionType: string; // "all" | "income" | "expense"
  dateFrom: string;
  dateTo: string;
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { filterByUser } = useViewMode();
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Partner transaction
  const [partnerInfo, setPartnerInfo] = useState<{ userId: string } | null>(null);
  const [partnerAccountId, setPartnerAccountId] = useState<string | null>(null);
  const [partnerCounterpartyName, setPartnerCounterpartyName] = useState("");
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [partnerTargetTx, setPartnerTargetTx] = useState<Transaction | null>(null);
  const [partnerCategoryId, setPartnerCategoryId] = useState("");
  const [isCreatingPartner, setIsCreatingPartner] = useState(false);

  // Initialize with empty strings to avoid hydration mismatch
  const [filters, setFilters] = useState<Filters>({
    accountId: "all",
    categoryId: "all",
    transactionType: "all",
    dateFrom: "",
    dateTo: "",
  });

  // Read URL parameters on mount
  useEffect(() => {
    const categoryId = searchParams.get("categoryId");
    const accountId = searchParams.get("accountId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const transactionType = searchParams.get("type");

    const hasUrlParams = categoryId || accountId || dateFrom || dateTo || transactionType;

    if (hasUrlParams) {
      setFilters((prev) => ({
        ...prev,
        categoryId: categoryId || "all",
        accountId: accountId || "all",
        dateFrom: dateFrom || "",
        dateTo: dateTo || "",
        transactionType: transactionType || "all",
      }));
      setShowFilters(true);
    }
    // Default: no date filtering (dateFrom and dateTo remain empty)
    setIsInitialized(true);
  }, [searchParams]);

  const fetchTransactions = async () => {
    setIsLoading(true);

    // Build transactions query with optional user filter
    let txQuery = supabase
      .from("transactions")
      .select(`
        id,
        date,
        payment_date,
        description,
        total_amount,
        account_id,
        user_id,
        paid_by_other,
        is_shared,
        account:accounts!transactions_account_id_fkey(name),
        transaction_lines(amount, line_type, category_id)
      `)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    // Filter by user when in personal mode, by is_shared when in shared mode
    if (filterByUser && user?.id) {
      txQuery = txQuery.eq("user_id", user.id);
    } else if (!filterByUser) {
      txQuery = txQuery.eq("is_shared", true).eq("paid_by_other", false);
    }

    // Build accounts query with optional user filter
    let accountsQuery = supabase.from("accounts").select("*").eq("is_active", true).order("name");
    if (filterByUser && user?.id) {
      accountsQuery = accountsQuery.eq("user_id", user.id);
    }

    // Fetch in parallel
    const [txResponse, accountsResponse, categoriesResponse] = await Promise.all([
      txQuery,
      accountsQuery,
      supabase.from("categories").select("*").eq("is_active", true).order("name"),
    ]);

    if (txResponse.error) {
      console.error("Error fetching transactions:", txResponse.error);
      setIsLoading(false);
      return;
    }

    setAllTransactions((txResponse.data || []) as Transaction[]);
    setAccounts(accountsResponse.data || []);
    setCategories(categoriesResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterByUser, user?.id]);

  // Fetch partner info
  useEffect(() => {
    async function fetchPartnerInfo() {
      if (!user) return;

      const { data: myMembership } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      const { data: ownedHousehold } = await supabase
        .from("households")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      const householdId = ownedHousehold?.id || myMembership?.household_id;
      if (!householdId) return;

      let partnerId: string | null = null;

      if (!ownedHousehold) {
        const { data: household } = await supabase
          .from("households")
          .select("owner_id")
          .eq("id", householdId)
          .single();
        if (household && household.owner_id !== user.id) {
          partnerId = household.owner_id;
        }
      } else {
        const { data: members } = await supabase
          .from("household_members")
          .select("user_id")
          .eq("household_id", householdId)
          .eq("status", "active")
          .neq("user_id", user.id);
        if (members?.[0]?.user_id) {
          partnerId = members[0].user_id;
        }
      }

      if (partnerId) {
        setPartnerInfo({ userId: partnerId });
        const { data: partnerAccounts } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", partnerId)
          .eq("is_active", true)
          .order("name")
          .limit(1);
        if (partnerAccounts?.[0]) {
          setPartnerAccountId(partnerAccounts[0].id);
        }
      }

      setPartnerCounterpartyName(
        user.user_metadata?.full_name || user.email?.split("@")[0] || ""
      );
    }

    fetchPartnerInfo();
  }, [user]);

  // Apply filters and group transactions
  const groupedTransactions = useMemo(() => {
    let filtered = allTransactions;

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter((tx) => tx.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter((tx) => tx.date <= filters.dateTo);
    }

    // Filter by account
    if (filters.accountId !== "all") {
      filtered = filtered.filter((tx) => tx.account_id === filters.accountId);
    }

    // Filter by category
    if (filters.categoryId !== "all") {
      filtered = filtered.filter((tx) =>
        tx.transaction_lines.some((line) => line.category_id === filters.categoryId)
      );
    }

    // Filter by transaction type
    if (filters.transactionType === "income") {
      filtered = filtered.filter((tx) =>
        tx.transaction_lines.some((line) => line.line_type === "income")
      );
    } else if (filters.transactionType === "expense") {
      filtered = filtered.filter((tx) =>
        tx.transaction_lines.some((line) => line.line_type === "expense")
      );
    }

    // Group by date
    const grouped: Map<string, Transaction[]> = new Map();
    filtered.forEach((tx) => {
      const dateKey = tx.date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(tx);
    });

    const result: GroupedTransactions[] = [];
    grouped.forEach((transactions, date) => {
      result.push({ date, transactions });
    });

    return result;
  }, [allTransactions, filters]);

  const clearFilters = () => {
    setFilters({
      accountId: "all",
      categoryId: "all",
      transactionType: "all",
      dateFrom: "",
      dateTo: "",
    });
  };

  const hasActiveFilters =
    filters.accountId !== "all" ||
    filters.categoryId !== "all" ||
    filters.transactionType !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const handleToggleShared = async (txId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    // Optimistic update
    setAllTransactions((prev) =>
      prev.map((tx) => (tx.id === txId ? { ...tx, is_shared: newValue } : tx))
    );
    const { error } = await supabase
      .from("transactions")
      .update({ is_shared: newValue })
      .eq("id", txId);
    if (error) {
      // Revert on error
      setAllTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? { ...tx, is_shared: currentValue } : tx))
      );
      return;
    }
    // 共有ONにした時、立替ラインがあればパートナー登録ダイアログを開く
    if (newValue && partnerInfo && partnerAccountId) {
      const tx = allTransactions.find((t) => t.id === txId);
      if (tx) {
        const assetLines = tx.transaction_lines?.filter((l) => l.line_type === "asset") || [];
        if (assetLines.length > 0) {
          setPartnerTargetTx(tx);
          setPartnerCategoryId(assetLines[0].category_id || "");
          setShowPartnerDialog(true);
        }
      }
    }
  };

  const handleCreatePartnerTransaction = async () => {
    if (!partnerTargetTx || !partnerInfo || !partnerAccountId) return;

    const assetLines = partnerTargetTx.transaction_lines?.filter((l) => l.line_type === "asset") || [];
    const assetTotal = assetLines.reduce((sum, l) => sum + l.amount, 0);

    setIsCreatingPartner(true);
    try {
      const { data, error } = await supabase.rpc("create_partner_transaction", {
        p_partner_user_id: partnerInfo.userId,
        p_date: partnerTargetTx.date,
        p_description: partnerTargetTx.description,
        p_amount: assetTotal,
        p_account_id: partnerAccountId,
        p_category_id: partnerCategoryId,
        p_counterparty_name: partnerCounterpartyName,
        p_is_shared: true,
      });

      if (error) {
        console.error("RPC error:", error);
        alert("パートナー取引の作成に失敗しました: " + error.message);
        return;
      }

      setShowPartnerDialog(false);
      setPartnerTargetTx(null);
      if (data) {
        router.push(`/transactions/${data}`);
      }
    } catch (error) {
      console.error("Create partner transaction error:", error);
    } finally {
      setIsCreatingPartner(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    // Delete transaction lines first (due to foreign key)
    await supabase
      .from("transaction_lines")
      .delete()
      .eq("transaction_id", deleteId);

    // Then delete transaction
    await supabase
      .from("transactions")
      .delete()
      .eq("id", deleteId);

    setDeleteId(null);
    fetchTransactions();
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
      {(() => {
        const filterPanel = (
          <div className="bg-card rounded-xl border border-border overflow-hidden max-w-full">
            <div className="p-4 space-y-4 overflow-hidden">
              {/* Date Range */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">期間</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">開始</span>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="flex-1"
                    />
                    {filters.dateFrom && (
                      <button
                        type="button"
                        onClick={() => setFilters({ ...filters, dateFrom: "" })}
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">終了</span>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="flex-1"
                    />
                    {filters.dateTo && (
                      <button
                        type="button"
                        onClick={() => setFilters({ ...filters, dateTo: "" })}
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Transaction Type Filter */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">種別</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "all", label: "すべて" },
                    { value: "income", label: "収入" },
                    { value: "expense", label: "支出" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilters({ ...filters, transactionType: opt.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.transactionType === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Filter */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">口座</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, accountId: "all" })}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      filters.accountId === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent"
                    }`}
                  >
                    すべて
                  </button>
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => setFilters({ ...filters, accountId: acc.id })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        filters.accountId === acc.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-accent"
                      }`}
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              </div>

                {/* Category Filter - Chip style grouped by parent */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">カテゴリ</label>
                  <div className="space-y-3">
                    {/* すべてボタン */}
                    <button
                      onClick={() => setFilters({ ...filters, categoryId: "all" })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        filters.categoryId === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-accent"
                      }`}
                    >
                      すべて
                    </button>

                    {/* 親カテゴリでグループ化 */}
                    <div className="space-y-4">
                      {categories
                        .filter((cat) => cat.parent_id === null)
                        .map((parent) => {
                          const children = categories.filter((c) => c.parent_id === parent.id);
                        if (children.length === 0) {
                          // 子なし親カテゴリ
                          return (
                            <div key={parent.id}>
                              <p className="text-xs text-muted-foreground mb-2">{parent.name}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => setFilters({ ...filters, categoryId: parent.id })}
                                  className={`px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${
                                    filters.categoryId === parent.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-secondary hover:bg-accent"
                                  }`}
                                >
                                  すべて
                                </button>
                              </div>
                            </div>
                          );
                        }
                          // 子ありの場合
                          return (
                            <div key={parent.id}>
                              <p className="text-xs text-muted-foreground mb-2">{parent.name}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {children.map((child) => (
                                  <button
                                    key={child.id}
                                    onClick={() => setFilters({ ...filters, categoryId: child.id })}
                                    className={`px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${
                                      filters.categoryId === child.id
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary hover:bg-accent"
                                    }`}
                                  >
                                    {child.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-2" />
                  フィルターをクリア
                </Button>
              )}
            </div>
          </div>
        );

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-2xl font-bold">取引一覧</h1>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 md:hidden"
              >
                <Filter className="w-4 h-4" />
                {hasActiveFilters && <span className="w-2 h-2 bg-primary rounded-full" />}
              </Button>
            </div>

            <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:space-y-0">
              <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
                <div className="mb-3 text-sm font-medium text-muted-foreground">
                  フィルター
                </div>
                <div className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
                  {filterPanel}
                </div>
              </div>

              <div className="space-y-6">
                {/* Filter Panel (Mobile) */}
                <div className="md:hidden">
                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {filterPanel}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Results count */}
                <div className="text-sm text-muted-foreground">
                  {groupedTransactions.reduce((sum, g) => sum + g.transactions.length, 0)}件の取引
                </div>

                {groupedTransactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>取引がありません</p>
                    <p className="text-sm mt-2">記録画面から取引を追加してください</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <AnimatePresence>
                      {groupedTransactions.map((group, groupIndex) => (
                        <motion.div
                          key={group.date}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: groupIndex * 0.05 }}
                        >
                          {/* Date Header */}
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              {format(new Date(group.date), "yyyy年M月d日(E)", { locale: ja })}
                            </span>
                          </div>

                          {/* Transactions */}
                          <div className="space-y-2">
                            {group.transactions.map((tx) => {
                              // Calculate if this is primarily income or expense
                              const incomeTotal = tx.transaction_lines
                                ?.filter((l) => l.line_type === "income")
                                .reduce((sum, l) => sum + l.amount, 0) || 0;
                              const expenseTotal = tx.transaction_lines
                                ?.filter((l) => l.line_type !== "income")
                                .reduce((sum, l) => sum + l.amount, 0) || 0;
                              const isIncome = incomeTotal > expenseTotal;

                              return (
                                <motion.div
                                  key={tx.id}
                                  layout
                                  className="bg-card rounded-xl border border-border overflow-hidden hover:bg-accent transition-colors"
                                >
                                  <div className="flex items-center">
                                    <Link
                                      href={`/transactions/${tx.id}`}
                                      className="flex-1 p-4"
                                    >
                                      <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                          <p className="font-medium">{tx.description}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {tx.paid_by_other ? "立替えてもらった" : (tx.account?.name || "不明")}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`font-heading font-bold tabular-nums ${isIncome ? "text-income" : "text-expense"}`}>
                                            {isIncome ? "+" : "-"}¥{tx.total_amount.toLocaleString("ja-JP")}
                                          </span>
                                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                      </div>
                                    </Link>
                                    <div className="flex items-center self-stretch">
                                      <button
                                        onClick={() => handleToggleShared(tx.id, tx.is_shared)}
                                        className={`px-2 self-stretch flex items-center transition-colors ${
                                          tx.is_shared
                                            ? "text-primary hover:text-primary/80"
                                            : "text-muted-foreground/40 hover:text-muted-foreground"
                                        }`}
                                        title={tx.is_shared ? "共有中" : "個人"}
                                      >
                                        <Users className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteId(tx.id)}
                                        className="px-3 self-stretch flex items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。取引と関連する明細がすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partner Transaction Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={(open) => {
        setShowPartnerDialog(open);
        if (!open) setPartnerTargetTx(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パートナー側の取引を登録</DialogTitle>
            <DialogDescription>
              立替分をパートナーの費用 + 借入として登録します
            </DialogDescription>
          </DialogHeader>

          {partnerTargetTx && (() => {
            const assetLines = partnerTargetTx.transaction_lines?.filter((l) => l.line_type === "asset") || [];
            const assetTotal = assetLines.reduce((sum, l) => sum + l.amount, 0);
            return (
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">金額</label>
                  <p className="text-lg font-bold">¥{assetTotal.toLocaleString("ja-JP")}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">説明</label>
                  <p className="text-sm">{partnerTargetTx.description}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">カテゴリ</label>
                  <CategoryPicker
                    categories={categories}
                    selectedId={partnerCategoryId}
                    onSelect={setPartnerCategoryId}
                    type="expense"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">借入相手先（あなたの名前）</label>
                  <Input
                    value={partnerCounterpartyName}
                    onChange={(e) => setPartnerCounterpartyName(e.target.value)}
                    placeholder="例: 太郎"
                  />
                  <p className="text-xs text-blue-500">
                    パートナーの精算画面にこの名前で借入が表示されます
                  </p>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowPartnerDialog(false); setPartnerTargetTx(null); }}
              disabled={isCreatingPartner}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreatePartnerTransaction}
              disabled={isCreatingPartner || !partnerCounterpartyName.trim()}
            >
              {isCreatingPartner ? "登録中..." : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        </MainLayout>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}

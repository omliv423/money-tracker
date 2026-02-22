"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Calendar, CreditCard, Wallet, Tag, Clock, Pencil, Trash2, Plus, X, Check, UserPlus, Users } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase, type Tables } from "@/lib/supabase";
import { CategoryPicker } from "@/components/transaction/CategoryPicker";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;
type Counterparty = Tables<"counterparties">;

interface TransactionLine {
  id: string;
  amount: number;
  line_type: string;
  counterparty: string | null;
  category_id: string;
  amortization_months: number | null;
  amortization_start: string | null;
  amortization_end: string | null;
  category: { id: string; name: string } | null;
}

interface Transaction {
  id: string;
  date: string;
  payment_date: string | null;
  description: string;
  total_amount: number;
  account_id: string;
  created_at: string;
  paid_by_other: boolean;
  is_shared: boolean;
  account: { id: string; name: string } | null;
  transaction_lines: TransactionLine[];
}

const lineTypeLabels: Record<string, string> = {
  expense: "費用",
  income: "収入",
  asset: "立替（債権）",
  liability: "借入（債務）",
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Master data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  // Edit form state
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState("");
  const [editLines, setEditLines] = useState<TransactionLine[]>([]);

  // 立替えてもらった
  const [paidByOther, setPaidByOther] = useState(false);
  const [paidByCounterpartyId, setPaidByCounterpartyId] = useState<string | null>(null);
  const [newCounterpartyName, setNewCounterpartyName] = useState("");
  const [showNewCounterpartyInput, setShowNewCounterpartyInput] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [transactionRes, accountsRes, categoriesRes, counterpartiesRes] = await Promise.all([
        supabase
          .from("transactions")
          .select(`
            id,
            date,
            payment_date,
            description,
            total_amount,
            account_id,
            created_at,
            paid_by_other,
            is_shared,
            account:accounts!transactions_account_id_fkey(id, name),
            transaction_lines(
              id,
              amount,
              line_type,
              counterparty,
              category_id,
              amortization_months,
              amortization_start,
              amortization_end,
              category:categories(id, name)
            )
          `)
          .eq("id", id)
          .single(),
        supabase.from("accounts").select("*").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").eq("is_active", true).order("name"),
        supabase.from("counterparties").select("*").eq("is_active", true).order("name"),
      ]);

      if (transactionRes.error) {
        console.error("Error fetching transaction:", transactionRes.error);
        setIsLoading(false);
        return;
      }

      const tx = transactionRes.data as unknown as Transaction;
      setTransaction(tx);

      // Initialize edit form
      setEditDescription(tx.description);
      setEditDate(tx.date);
      setEditPaymentDate(tx.payment_date);
      setEditAccountId(tx.account_id);
      setEditLines(tx.transaction_lines);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (counterpartiesRes.data) setCounterparties(counterpartiesRes.data);

      setIsLoading(false);
    }

    fetchData();
  }, [id]);

  const handleStartEdit = () => {
    if (!transaction) return;
    setEditDescription(transaction.description);
    setEditDate(transaction.date);
    setEditPaymentDate(transaction.payment_date);
    setEditAccountId(transaction.account_id);
    setEditLines([...transaction.transaction_lines]);
    // 立替えてもらった状態を復元
    setPaidByOther(transaction.paid_by_other || false);
    // 立替えてもらった場合、liabilityラインから相手先を取得
    if (transaction.paid_by_other) {
      const liabilityLine = transaction.transaction_lines.find(
        (l) => l.line_type === "liability" && l.counterparty
      );
      if (liabilityLine?.counterparty) {
        const cp = counterparties.find((c) => c.name === liabilityLine.counterparty);
        setPaidByCounterpartyId(cp?.id || null);
      }
    } else {
      setPaidByCounterpartyId(null);
    }
    setNewCounterpartyName("");
    setShowNewCounterpartyInput(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setPaidByOther(false);
    setPaidByCounterpartyId(null);
    setNewCounterpartyName("");
    setShowNewCounterpartyInput(false);
  };

  const handleUpdateLine = (index: number, updates: Partial<TransactionLine>) => {
    const newLines = [...editLines];
    newLines[index] = { ...newLines[index], ...updates };
    setEditLines(newLines);
  };

  const handleAddLine = () => {
    setEditLines([
      ...editLines,
      {
        id: `new-${generateId()}`,
        amount: 0,
        line_type: "expense",
        counterparty: null,
        category_id: categories[0]?.id || "",
        amortization_months: null,
        amortization_start: null,
        amortization_end: null,
        category: categories[0] ? { id: categories[0].id, name: categories[0].name } : null,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (editLines.length > 1) {
      setEditLines(editLines.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!transaction) return;

    setIsSaving(true);

    try {
      // 立替えてもらった場合: 新規相手先を作成
      let counterpartyName: string | null = null;
      if (paidByOther) {
        if (showNewCounterpartyInput && newCounterpartyName.trim()) {
          // Create new counterparty
          const { data: newCp } = await supabase
            .from("counterparties")
            .insert({ name: newCounterpartyName.trim(), is_active: true })
            .select()
            .single();
          if (newCp) {
            counterpartyName = newCp.name;
            setCounterparties([...counterparties, newCp]);
          }
        } else if (paidByCounterpartyId) {
          const cp = counterparties.find((c) => c.id === paidByCounterpartyId);
          counterpartyName = cp?.name || null;
        }
      }

      // Calculate new total
      const newTotal = editLines.reduce((sum, line) => sum + line.amount, 0);

      // Determine if settled
      // 立替えてもらった場合は決済済み（自分の口座からの支出なし）
      // 支払日が発生日以前 かつ 支払日が今日以前なら決済済み（実際に支払いが発生している）
      const today = new Date().toISOString().split("T")[0];
      const isCashSettled = paidByOther
        ? true
        : editPaymentDate !== null && editPaymentDate !== "" && editPaymentDate <= editDate && editPaymentDate <= today;

      // Update transaction
      await supabase
        .from("transactions")
        .update({
          description: editDescription,
          date: editDate,
          payment_date: paidByOther ? editDate : editPaymentDate,
          account_id: editAccountId,
          total_amount: newTotal,
          is_cash_settled: isCashSettled,
          settled_amount: isCashSettled ? newTotal : 0,
          paid_by_other: paidByOther,
        })
        .eq("id", transaction.id);

      // Delete existing lines
      await supabase
        .from("transaction_lines")
        .delete()
        .eq("transaction_id", transaction.id);

      // Insert new lines
      const lineInserts = editLines.map((line) => ({
        transaction_id: transaction.id,
        amount: line.amount,
        category_id: line.category_id,
        line_type: line.line_type,
        counterparty: line.counterparty,
        is_settled: false,
        amortization_months: line.amortization_months,
        amortization_start: line.amortization_start,
        amortization_end: line.amortization_end,
      }));

      // 立替えてもらった場合は借入（liability）ラインを追加
      if (paidByOther && counterpartyName) {
        lineInserts.push({
          transaction_id: transaction.id,
          amount: newTotal,
          category_id: editLines[0]?.category_id || "",
          line_type: "liability",
          counterparty: counterpartyName,
          is_settled: false,
          amortization_months: null,
          amortization_start: null,
          amortization_end: null,
        });
      }

      await supabase.from("transaction_lines").insert(lineInserts);

      // Refetch transaction
      const { data: updated } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          account_id,
          created_at,
          paid_by_other,
          is_shared,
          account:accounts!transactions_account_id_fkey(id, name),
          transaction_lines(
            id,
            amount,
            line_type,
            counterparty,
            category_id,
            amortization_months,
            amortization_start,
            amortization_end,
            category:categories(id, name)
          )
        `)
        .eq("id", transaction.id)
        .single();

      if (updated) {
        setTransaction(updated as unknown as Transaction);
      }

      setIsEditing(false);
      setPaidByOther(false);
      setPaidByCounterpartyId(null);
      setNewCounterpartyName("");
      setShowNewCounterpartyInput(false);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;

    try {
      // Delete lines first
      await supabase
        .from("transaction_lines")
        .delete()
        .eq("transaction_id", transaction.id);

      // Delete transaction
      await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);

      router.push("/transactions");
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleToggleShared = async () => {
    if (!transaction) return;
    const newValue = !transaction.is_shared;
    setTransaction({ ...transaction, is_shared: newValue });
    const { error } = await supabase
      .from("transactions")
      .update({ is_shared: newValue })
      .eq("id", transaction.id);
    if (error) {
      setTransaction({ ...transaction, is_shared: !newValue });
    }
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

  // Edit mode totals
  const editTotal = editLines.reduce((sum, line) => sum + line.amount, 0);

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
            <h1 className="font-heading text-xl font-bold">
              {isEditing ? "取引を編集" : "取引詳細"}
            </h1>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartEdit}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="p-2 hover:bg-accent rounded-lg transition-colors text-expense"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
            <div className="space-y-4">
              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">説明</label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="説明を入力"
                />
              </div>

              {/* Dates */}
              <div className="bg-card rounded-xl p-4 border border-border space-y-3 overflow-hidden">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 発生日
                  </label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> {isIncome ? "入金日" : "支払日"}
                  </label>
                  <div className="flex items-center gap-2">
                    {editPaymentDate === null ? (
                      <div className="flex-1 text-sm text-muted-foreground py-2">未定</div>
                    ) : (
                      <Input
                        type="date"
                        value={editPaymentDate}
                        onChange={(e) => setEditPaymentDate(e.target.value)}
                        className="flex-1"
                      />
                    )}
                    <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={editPaymentDate === null}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPaymentDate(null);
                          } else {
                            setEditPaymentDate(format(new Date(), "yyyy-MM-dd"));
                          }
                        }}
                        className="w-4 h-4 rounded border-border"
                      />
                      未定
                    </label>
                  </div>
                </div>
                {/* 決済状態プレビュー */}
                <div className="mt-2 text-xs">
                  {editPaymentDate === null ? (
                    <span className="text-orange-500">→ 保存後: {isIncome ? "未収金" : "未払金"}として計上</span>
                  ) : editPaymentDate <= editDate ? (
                    <span className="text-green-500">→ 保存後: 決済済み（BSに計上されない）</span>
                  ) : (
                    <span className="text-orange-500">→ 保存後: {isIncome ? "未収金" : "未払金"}として計上</span>
                  )}
                </div>
              </div>

              {/* Account */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> {isIncome ? "入金先" : "支払い方法"}
                </label>
                <Select
                  value={paidByOther ? "__paid_by_other__" : editAccountId}
                  onValueChange={(v) => {
                    if (v === "__paid_by_other__") {
                      setPaidByOther(true);
                      // 最初の口座をダミーとして設定（スキーマ要件）
                      if (accounts.length > 0) {
                        setEditAccountId(accounts[0].id);
                      }
                    } else {
                      setPaidByOther(false);
                      setPaidByCounterpartyId(null);
                      setNewCounterpartyName("");
                      setShowNewCounterpartyInput(false);
                      setEditAccountId(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                    {!isIncome && (
                      <SelectItem value="__paid_by_other__">
                        <span className="flex items-center gap-1">
                          <UserPlus className="w-3 h-3" />
                          立替えてもらった
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* 立替えてもらった場合の相手先選択 */}
                {paidByOther && (
                  <div className="mt-2 space-y-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserPlus className="w-3 h-3" /> 立替えてくれた人
                    </label>
                    {showNewCounterpartyInput ? (
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="新しい相手先の名前"
                          value={newCounterpartyName}
                          onChange={(e) => setNewCounterpartyName(e.target.value)}
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowNewCounterpartyInput(false);
                            setNewCounterpartyName("");
                          }}
                        >
                          戻る
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={paidByCounterpartyId || ""}
                        onValueChange={(v) => {
                          if (v === "__new__") {
                            setShowNewCounterpartyInput(true);
                            setPaidByCounterpartyId(null);
                          } else {
                            setPaidByCounterpartyId(v);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="相手先を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {counterparties.map((cp) => (
                            <SelectItem key={cp.id} value={cp.id}>
                              {cp.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__">
                            <span className="flex items-center gap-1 text-primary">
                              <Plus className="w-3 h-3" />
                              新しい相手先を追加
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-blue-500">
                      → この人への借入として精算画面に表示されます
                    </p>
                  </div>
                )}
              </div>

              {/* Lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">内訳</label>
                  <div className="text-sm text-right">
                    <span className="text-muted-foreground">
                      合計: ¥{editTotal.toLocaleString()}
                    </span>
                    {transaction && editTotal !== transaction.total_amount && (
                      <span className={`ml-2 ${editTotal > transaction.total_amount ? "text-expense" : "text-income"}`}>
                        (残り: ¥{(transaction.total_amount - editTotal).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {editLines.map((line, index) => (
                  <div
                    key={line.id}
                    className="bg-card rounded-xl p-4 border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Select
                        value={line.line_type}
                        onValueChange={(v) => handleUpdateLine(index, { line_type: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">費用</SelectItem>
                          <SelectItem value="income">収入</SelectItem>
                          <SelectItem value="asset">立替</SelectItem>
                          <SelectItem value="liability">借入</SelectItem>
                        </SelectContent>
                      </Select>
                      {editLines.length > 1 && (
                        <button
                          onClick={() => handleRemoveLine(index)}
                          className="p-1 hover:bg-accent rounded text-muted-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">カテゴリ</label>
                        <CategoryPicker
                          categories={categories}
                          selectedId={line.category_id}
                          onSelect={(v) => {
                            const cat = categories.find((c) => c.id === v);
                            handleUpdateLine(index, {
                              category_id: v,
                              category: cat ? { id: cat.id, name: cat.name } : null,
                            });
                          }}
                          type={line.line_type === "income" ? "income" : "expense"}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">金額</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">¥</span>
                          <input
                            type="number"
                            value={line.amount || ""}
                            onChange={(e) =>
                              handleUpdateLine(index, {
                                amount: parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0,
                              })
                            }
                            className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                        </div>
                      </div>
                    </div>

                    {(line.line_type === "asset" || line.line_type === "liability") && (
                      <div>
                        <label className="text-xs text-muted-foreground">相手先</label>
                        <Input
                          value={line.counterparty || ""}
                          onChange={(e) =>
                            handleUpdateLine(index, { counterparty: e.target.value || null })
                          }
                          placeholder="例: 彼女"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <Button variant="outline" onClick={handleAddLine} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  内訳を追加
                </Button>
              </div>
            </div>

            {/* Save/Cancel Buttons */}
            <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
              <Button variant="outline" onClick={handleCancelEdit} className="w-full">
                キャンセル
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "保存中..." : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
            <div className="space-y-6">
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

            {/* Main Info Card */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
                          : "未定"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">{isIncome ? "入金先" : "支払い方法"}</p>
                      <p>{transaction.paid_by_other ? "立替えてもらった" : (transaction.account?.name || "不明")}</p>
                    </div>
                  </div>
                </div>

                {/* Shared Toggle */}
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={handleToggleShared}
                    className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
                      transaction.is_shared
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border hover:bg-accent"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-sm">
                      {transaction.is_shared ? "共有中" : "個人（共有しない）"}
                    </span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。取引「{transaction.description}」を削除します。
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
    </MainLayout>
  );
}

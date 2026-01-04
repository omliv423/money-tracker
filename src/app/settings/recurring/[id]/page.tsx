"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPicker } from "@/components/transaction/CategoryPicker";
import { supabase, type Tables } from "@/lib/supabase";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;
type Counterparty = Tables<"counterparties">;

type LineData = {
  id: string;
  amount: number;
  categoryId: string;
  lineType: string;
  counterparty: string | null;
  isNew?: boolean;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function EditRecurringTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [paymentMonthOffset, setPaymentMonthOffset] = useState(0);
  const [paymentDay, setPaymentDay] = useState<number | null>(null);
  const [lines, setLines] = useState<LineData[]>([]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const [accountsRes, categoriesRes, counterpartiesRes, recurringRes, linesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").eq("is_active", true).order("name"),
        supabase.from("counterparties").select("*").eq("is_active", true).order("name"),
        supabase.from("recurring_transactions").select("*").eq("id", id).single(),
        supabase.from("recurring_transaction_lines").select("*").eq("recurring_transaction_id", id),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data);
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      if (counterpartiesRes.data) {
        setCounterparties(counterpartiesRes.data);
      }
      if (recurringRes.data) {
        setName(recurringRes.data.name);
        setDescription(recurringRes.data.description || "");
        setAccountId(recurringRes.data.account_id || "");
        setDayOfMonth(recurringRes.data.day_of_month || 1);
        setPaymentMonthOffset(recurringRes.data.payment_month_offset || 0);
        setPaymentDay(recurringRes.data.payment_day);
      }
      if (linesRes.data) {
        setLines(
          linesRes.data.map((line) => ({
            id: line.id,
            amount: line.amount,
            categoryId: line.category_id || "",
            lineType: line.line_type,
            counterparty: line.counterparty,
          }))
        );
      }

      if (!linesRes.data || linesRes.data.length === 0) {
        setLines([
          { id: generateId(), amount: 0, categoryId: "", lineType: "expense", counterparty: null, isNew: true },
        ]);
      }

      setIsLoading(false);
    }
    fetchData();
  }, [id]);

  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);

  const handleAddLine = () => {
    setLines([
      ...lines,
      { id: generateId(), amount: 0, categoryId: "", lineType: "expense", counterparty: null, isNew: true },
    ]);
  };

  const handleRemoveLine = (lineId: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((line) => line.id !== lineId));
    }
  };

  const handleLineChange = (lineId: string, field: keyof LineData, value: any) => {
    setLines(
      lines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim() || totalAmount <= 0) return;

    setIsSaving(true);

    // Update recurring transaction
    await supabase
      .from("recurring_transactions")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        account_id: accountId || null,
        total_amount: totalAmount,
        day_of_month: dayOfMonth,
        payment_month_offset: paymentMonthOffset,
        payment_day: paymentDay,
      })
      .eq("id", id);

    // Delete all existing lines and re-insert
    await supabase.from("recurring_transaction_lines").delete().eq("recurring_transaction_id", id);

    const lineInserts = lines
      .filter((line) => line.amount > 0)
      .map((line) => ({
        recurring_transaction_id: id,
        amount: line.amount,
        category_id: line.categoryId || null,
        line_type: line.lineType,
        counterparty: line.counterparty,
      }));

    if (lineInserts.length > 0) {
      await supabase.from("recurring_transaction_lines").insert(lineInserts);
    }

    setIsSaving(false);
    router.push("/settings/recurring");
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
          <h1 className="font-heading text-xl font-bold">定期取引を編集</h1>
        </div>

        {/* Form */}
        <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                名前 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="例: 家賃"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                説明
              </label>
              <Input
                placeholder="例: マンション家賃"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Account */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                口座
              </label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="口座を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of month */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                発生日（毎月）
              </label>
              <Select
                value={String(dayOfMonth)}
                onValueChange={(v) => setDayOfMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}日
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment schedule */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                支払い月
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={String(paymentMonthOffset)}
                  onValueChange={(v) => setPaymentMonthOffset(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-2">前々月</SelectItem>
                    <SelectItem value="-1">前月</SelectItem>
                    <SelectItem value="0">同月</SelectItem>
                    <SelectItem value="1">翌月</SelectItem>
                    <SelectItem value="2">翌々月</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={paymentDay === null ? "same" : String(paymentDay)}
                  onValueChange={(v) => setPaymentDay(v === "same" ? null : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">発生日と同じ日</SelectItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {day}日
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                例: 発生日が15日の場合 → 支払いは
                {paymentMonthOffset === -2 ? "前々月" :
                 paymentMonthOffset === -1 ? "前月" :
                 paymentMonthOffset === 0 ? "同月" :
                 paymentMonthOffset === 1 ? "翌月" : "翌々月"}
                {paymentDay === null ? "15日" : `${paymentDay}日`}
              </p>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">明細</label>
                <button
                  onClick={handleAddLine}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  明細を追加
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="bg-card rounded-lg p-3 border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        明細 {index + 1}
                      </span>
                      {lines.length > 1 && (
                        <button
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Amount */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          金額
                        </label>
                        <Input
                          type="number"
                          value={line.amount || ""}
                          onChange={(e) =>
                            handleLineChange(line.id, "amount", Number(e.target.value))
                          }
                          placeholder="0"
                        />
                      </div>

                      {/* Line Type */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          種別
                        </label>
                        <Select
                          value={line.lineType}
                          onValueChange={(v) => handleLineChange(line.id, "lineType", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">支出</SelectItem>
                            <SelectItem value="income">収入</SelectItem>
                            <SelectItem value="asset">立替</SelectItem>
                            <SelectItem value="liability">借入</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        カテゴリ
                      </label>
                      <CategoryPicker
                        categories={categories}
                        selectedId={line.categoryId}
                        onSelect={(v) => handleLineChange(line.id, "categoryId", v)}
                        type={line.lineType === "income" ? "income" : "expense"}
                      />
                    </div>

                    {/* Counterparty for asset/liability */}
                    {(line.lineType === "asset" || line.lineType === "liability") && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {line.lineType === "asset" ? "立替先" : "借入元"}
                        </label>
                        <Select
                          value={line.counterparty || ""}
                          onValueChange={(v) => handleLineChange(line.id, "counterparty", v || null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="相手先を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {counterparties.map((cp) => (
                              <SelectItem key={cp.id} value={cp.name}>
                                {cp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {/* Total */}
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">合計金額</span>
                <span className="text-xl font-bold font-mono">
                  ¥{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!name.trim() || totalAmount <= 0 || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

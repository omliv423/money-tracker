"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Calendar, Wallet, FileText } from "lucide-react";
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
import { AmountInput } from "./AmountInput";
import { TransactionLineItem, type LineItemData } from "./TransactionLineItem";
import { supabase, type Tables } from "@/lib/supabase";

type Account = Tables<"accounts">;
type Category = Tables<"categories">;

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function TransactionForm() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [step, setStep] = useState<"amount" | "details">("amount");
  const [totalAmount, setTotalAmount] = useState(0);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [lines, setLines] = useState<LineItemData[]>([
    {
      id: generateId(),
      amount: 0,
      categoryId: "",
      lineType: "expense",
      counterparty: null,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Fetch accounts and categories on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [accountsRes, categoriesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").eq("is_active", true).order("name"),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data);
        if (accountsRes.data.length > 0) {
          setAccountId(accountsRes.data[0].id);
        }
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const allocatedAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = totalAmount - allocatedAmount;

  const handleNext = () => {
    if (totalAmount > 0) {
      if (lines[0].amount === 0) {
        setLines([{ ...lines[0], amount: totalAmount }]);
      }
      setStep("details");
    }
  };

  const handleBack = () => {
    setStep("amount");
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: generateId(),
        amount: remainingAmount > 0 ? remainingAmount : 0,
        categoryId: "",
        lineType: "expense",
        counterparty: null,
      },
    ]);
  };

  const handleUpdateLine = (index: number, line: LineItemData) => {
    const newLines = [...lines];
    newLines[index] = line;
    setLines(newLines);
  };

  const handleDeleteLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Insert transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          date,
          description,
          account_id: accountId,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Insert transaction lines
      const lineInserts = lines.map((line) => ({
        transaction_id: transaction.id,
        amount: line.amount,
        category_id: line.categoryId,
        line_type: line.lineType,
        counterparty: line.counterparty,
        is_settled: false,
      }));

      const { error: linesError } = await supabase
        .from("transaction_lines")
        .insert(lineInserts);

      if (linesError) throw linesError;

      // Reset form
      setTotalAmount(0);
      setDescription("");
      setLines([
        {
          id: generateId(),
          amount: 0,
          categoryId: "",
          lineType: "expense",
          counterparty: null,
        },
      ]);
      setStep("amount");
      setSaveMessage("保存しました！");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveMessage("エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    totalAmount > 0 &&
    description.trim() !== "" &&
    allocatedAmount === totalAmount &&
    lines.every((line) => line.amount > 0 && line.categoryId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-primary text-primary-foreground rounded-lg p-3 text-center font-medium"
          >
            {saveMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">
          {step === "amount" ? "支出を記録" : "詳細を入力"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(date), "yyyy年M月d日(E)", { locale: ja })}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "amount" ? (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <AmountInput value={totalAmount} onChange={setTotalAmount} />

            <Button
              onClick={handleNext}
              disabled={totalAmount === 0}
              className="w-full h-14 text-lg font-medium"
              size="lg"
            >
              次へ
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Amount Display */}
            <div
              onClick={handleBack}
              className="bg-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="text-sm text-muted-foreground">合計金額</div>
              <div className="font-heading text-2xl font-bold tabular-nums">
                ¥{totalAmount.toLocaleString("ja-JP")}
              </div>
            </div>

            {/* Date & Account */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 日付
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> 口座
                </label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.owner === "shared" && (
                          <span className="ml-1 text-xs text-muted-foreground">(共同)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> 説明
              </label>
              <Input
                type="text"
                placeholder="何に使った？"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">内訳</label>
                {remainingAmount !== 0 && (
                  <span className={remainingAmount > 0 ? "text-income text-sm" : "text-expense text-sm"}>
                    残り: ¥{remainingAmount.toLocaleString("ja-JP")}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {lines.map((line, index) => (
                  <TransactionLineItem
                    key={line.id}
                    line={line}
                    categories={categories}
                    onChange={(updated) => handleUpdateLine(index, updated)}
                    onDelete={() => handleDeleteLine(index)}
                    canDelete={lines.length > 1}
                  />
                ))}
              </AnimatePresence>

              <Button
                variant="outline"
                onClick={handleAddLine}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                内訳を追加（按分）
              </Button>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="w-full h-14 text-lg font-medium"
              size="lg"
            >
              {isSaving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  記録する
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

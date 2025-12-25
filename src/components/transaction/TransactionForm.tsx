"use client";

import { useState, useCallback } from "react";
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
import type { Account, Category } from "@/types/database";

// Demo data - will be replaced with Supabase data
const demoAccounts: Account[] = [
  { id: "1", name: "楽天銀行", type: "bank", owner: "self", initial_balance: 0, is_active: true, created_at: "" },
  { id: "2", name: "三井住友銀行", type: "bank", owner: "self", initial_balance: 0, is_active: true, created_at: "" },
  { id: "3", name: "PayPay", type: "cash", owner: "self", initial_balance: 0, is_active: true, created_at: "" },
  { id: "4", name: "現金", type: "cash", owner: "self", initial_balance: 0, is_active: true, created_at: "" },
  { id: "5", name: "共同カード", type: "card", owner: "shared", initial_balance: 0, is_active: true, created_at: "" },
];

const demoCategories: Category[] = [
  { id: "1", name: "食費", type: "expense", is_active: true, created_at: "" },
  { id: "2", name: "交通費", type: "expense", is_active: true, created_at: "" },
  { id: "3", name: "住居費", type: "expense", is_active: true, created_at: "" },
  { id: "4", name: "光熱費", type: "expense", is_active: true, created_at: "" },
  { id: "5", name: "通信費", type: "expense", is_active: true, created_at: "" },
  { id: "6", name: "娯楽費", type: "expense", is_active: true, created_at: "" },
  { id: "7", name: "日用品", type: "expense", is_active: true, created_at: "" },
  { id: "8", name: "医療費", type: "expense", is_active: true, created_at: "" },
  { id: "9", name: "被服費", type: "expense", is_active: true, created_at: "" },
  { id: "10", name: "その他", type: "expense", is_active: true, created_at: "" },
  { id: "11", name: "給与", type: "income", is_active: true, created_at: "" },
  { id: "12", name: "副収入", type: "income", is_active: true, created_at: "" },
  { id: "13", name: "立替金", type: "transfer", is_active: true, created_at: "" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function TransactionForm() {
  const [step, setStep] = useState<"amount" | "details">("amount");
  const [totalAmount, setTotalAmount] = useState(0);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState(demoAccounts[0].id);
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

  const allocatedAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = totalAmount - allocatedAmount;

  const handleNext = () => {
    if (totalAmount > 0) {
      // Set the first line amount to total if not allocated yet
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
    // TODO: Save to Supabase
    await new Promise((resolve) => setTimeout(resolve, 500));

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
    setIsSaving(false);
  };

  const canSave =
    totalAmount > 0 &&
    description.trim() !== "" &&
    allocatedAmount === totalAmount &&
    lines.every((line) => line.amount > 0 && line.categoryId);

  return (
    <div className="space-y-6">
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
                    {demoAccounts.map((account) => (
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
                    categories={demoCategories}
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

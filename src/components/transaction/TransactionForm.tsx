"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Calendar, Wallet, FileText, CreditCard, Store } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
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
type Counterparty = Tables<"counterparties">;

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function TransactionForm() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [step, setStep] = useState<"amount" | "details">("amount");
  const [totalAmount, setTotalAmount] = useState(0);
  const [accrualDate, setAccrualDate] = useState(""); // 発生日
  const [paymentDate, setPaymentDate] = useState<string | null>(""); // 支払日（null=未定）
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItemData[]>([
    {
      id: generateId(),
      amount: 0,
      categoryId: "",
      lineType: "expense",
      counterparty: null,
      amortizationMonths: 1,
      amortizationEndDate: null,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Fetch accounts, categories, and counterparties on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [accountsRes, categoriesRes, counterpartiesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").eq("is_active", true).order("name"),
        supabase.from("counterparties").select("*").eq("is_active", true).order("name"),
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
      if (counterpartiesRes.data) {
        setCounterparties(counterpartiesRes.data);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  // Initialize dates on client side to avoid hydration mismatch
  useEffect(() => {
    if (!isDateInitialized) {
      const today = format(new Date(), "yyyy-MM-dd");
      setAccrualDate(today);
      setPaymentDate(today);
      setIsDateInitialized(true);
    }
  }, [isDateInitialized]);

  // Calculate totals by type
  const incomeAmount = lines
    .filter((line) => line.lineType === "income")
    .reduce((sum, line) => sum + line.amount, 0);
  const expenseAmount = lines
    .filter((line) => line.lineType === "expense")
    .reduce((sum, line) => sum + line.amount, 0);
  const assetAmount = lines
    .filter((line) => line.lineType === "asset")
    .reduce((sum, line) => sum + line.amount, 0);
  const liabilityAmount = lines
    .filter((line) => line.lineType === "liability")
    .reduce((sum, line) => sum + line.amount, 0);

  // Determine if this is primarily an income transaction (for UI labels)
  const isIncomeTransaction = incomeAmount > expenseAmount;

  // Calculate allocated amount based on transaction type
  // 支出取引: expense + asset（立替）- income - liability = 合計金額
  // 収入取引: income + liability（借入）- expense - asset = 合計金額
  //
  // 例1: 1000円の支出を折半 → expense 500 + asset 500 = 1000
  // 例2: 582,460円の収入から122,321円源泉徴収 → income 582,460 - expense 122,321 = 460,139
  const allocatedAmount = isIncomeTransaction
    ? incomeAmount + liabilityAmount - expenseAmount - assetAmount
    : expenseAmount + assetAmount - incomeAmount - liabilityAmount;

  // Remaining amount
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
        amortizationMonths: 1,
        amortizationEndDate: null,
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

  // 共同カード選択時に自動で65:35の割合を設定
  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);

    const selectedAccount = accounts.find((a) => a.id === newAccountId);
    if (selectedAccount?.name === "共同カード" && lines.length === 1 && totalAmount > 0) {
      // 65:35の割合で計算（自分65%、あさみ35%）
      const myAmount = Math.round(totalAmount * 0.65);
      const asamiAmount = totalAmount - myAmount;

      setLines([
        {
          ...lines[0],
          amount: myAmount,
        },
        {
          id: generateId(),
          amount: asamiAmount,
          categoryId: lines[0].categoryId,
          lineType: "asset",
          counterparty: "あさみ",
          amortizationMonths: 1,
          amortizationEndDate: null,
        },
      ]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Insert transaction
      // 支払日/入金日が発生日以前なら決済済み
      // 支払日/入金日が未定（null）または発生日より後の場合は未決済
      // 収入の場合は未収金、支出の場合は未払金として計上
      const isCashSettled = paymentDate !== null && paymentDate <= accrualDate;
      const settledAmount = isCashSettled ? totalAmount : 0;

      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          date: accrualDate, // 発生日
          payment_date: paymentDate, // 支払日/入金日
          description,
          account_id: accountId,
          counterparty_id: counterpartyId,
          total_amount: totalAmount,
          is_cash_settled: isCashSettled,
          settled_amount: settledAmount,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Insert transaction lines
      const lineInserts = lines.map((line) => {
        const hasAmortization = line.amortizationEndDate !== null;
        let amortizationMonths = 1;

        if (hasAmortization && line.amortizationEndDate) {
          const startDate = new Date(accrualDate);
          const endDate = new Date(line.amortizationEndDate);
          // 月数を計算（開始月と終了月を含むため +1）
          amortizationMonths = differenceInMonths(endDate, startDate) + 1;
          if (amortizationMonths < 1) amortizationMonths = 1;
        }

        return {
          transaction_id: transaction.id,
          amount: line.amount,
          category_id: line.categoryId,
          line_type: line.lineType,
          counterparty: line.counterparty,
          is_settled: false,
          amortization_months: amortizationMonths,
          amortization_start: hasAmortization ? accrualDate : null,
          amortization_end: hasAmortization ? line.amortizationEndDate : null,
        };
      });

      const { error: linesError } = await supabase
        .from("transaction_lines")
        .insert(lineInserts);

      if (linesError) throw linesError;

      // Reset form
      setTotalAmount(0);
      setDescription("");
      setAccrualDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setCounterpartyId(null);
      setLines([
        {
          id: generateId(),
          amount: 0,
          categoryId: "",
          lineType: "expense",
          counterparty: null,
          amortizationMonths: 1,
          amortizationEndDate: null,
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
    remainingAmount === 0 &&
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
          {step === "amount" ? "取引を登録" : "詳細を入力"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(accrualDate), "yyyy年M月d日(E)", { locale: ja })}
        </p>
      </div>

      {step === "amount" ? (
        <div className="space-y-6">
          <AmountInput value={totalAmount} onChange={setTotalAmount} />

          <Button
            onClick={handleNext}
            disabled={totalAmount === 0}
            className="w-full h-14 text-lg font-medium"
            size="lg"
          >
            次へ
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
            {/* Amount Display */}
            <div
              onClick={handleBack}
              className="bg-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="text-sm text-muted-foreground">合計金額</div>
              <div className={`font-heading text-2xl font-bold tabular-nums ${isIncomeTransaction ? "text-income" : "text-expense"}`}>
                {isIncomeTransaction ? "+" : "-"}¥{totalAmount.toLocaleString("ja-JP")}
              </div>
            </div>

            {/* Dates */}
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> 発生日
                </label>
                <Input
                  type="date"
                  value={accrualDate}
                  onChange={(e) => setAccrualDate(e.target.value)}
                  className="w-40 text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> {isIncomeTransaction ? "入金日" : "支払日"}
                </label>
                <div className="flex items-center gap-2">
                  {paymentDate === null ? (
                    <span className="text-sm text-muted-foreground">未定</span>
                  ) : (
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-40 text-right"
                    />
                  )}
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentDate === null}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPaymentDate(null);
                        } else {
                          setPaymentDate(format(new Date(), "yyyy-MM-dd"));
                        }
                      }}
                      className="w-4 h-4 rounded border-border"
                    />
                    未定
                  </label>
                </div>
              </div>
              {/* 決済状態プレビュー */}
              <div className="text-xs text-center">
                {paymentDate === null ? (
                  <span className="text-orange-500">→ {isIncomeTransaction ? "未収金" : "未払金"}として計上されます</span>
                ) : paymentDate <= accrualDate ? (
                  <span className="text-green-500">→ 決済済み（BSに計上されない）</span>
                ) : (
                  <span className="text-orange-500">→ {isIncomeTransaction ? "未収金" : "未払金"}として計上されます（{isIncomeTransaction ? "入金日" : "支払日"}が発生日より後）</span>
                )}
              </div>
            </div>

            {/* Payment Method / Deposit Account */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" /> {isIncomeTransaction ? "入金先" : "支払い方法"}
              </label>
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="w-full">
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

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> 説明
              </label>
              <Input
                type="text"
                placeholder={isIncomeTransaction ? "何の収入？" : "何に使った？"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Counterparty */}
            {counterparties.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> {isIncomeTransaction ? "入金元（任意）" : "相手先（任意）"}
                </label>
                <Select
                  value={counterpartyId || "none"}
                  onValueChange={(v) => setCounterpartyId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="相手先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">指定なし</SelectItem>
                    {counterparties.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
          </div>
        )}
    </div>
  );
}

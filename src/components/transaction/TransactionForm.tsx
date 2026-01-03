"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Calendar, Wallet, FileText, CreditCard, Store, AlertTriangle, UserPlus } from "lucide-react";
import { format, differenceInMonths, parseISO } from "date-fns";
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
import { AmountInput } from "./AmountInput";
import { TransactionLineItem, type LineItemData } from "./TransactionLineItem";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Account = Tables<"accounts"> & {
  is_shared?: boolean;
  partner_user_id?: string | null;
  partner_name?: string | null;
  default_split_ratio?: number;
};
type Category = Tables<"categories">;
type Counterparty = Tables<"counterparties">;

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function TransactionForm() {
  const { user } = useAuth();
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
  const [paidByOther, setPaidByOther] = useState(false); // 立替えてもらった
  const [paidByCounterpartyId, setPaidByCounterpartyId] = useState<string | null>(null); // 立替えてくれた人のID
  const [newCounterpartyName, setNewCounterpartyName] = useState(""); // 新規相手先名
  const [showNewCounterpartyInput, setShowNewCounterpartyInput] = useState(false);
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

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

  // Determine if this is primarily an income/inflow transaction (for UI labels)
  // Income and Liability (借入) both represent money coming in
  // Expense and Asset (立替) both represent money going out
  const inflowAmount = incomeAmount + liabilityAmount;
  const outflowAmount = expenseAmount + assetAmount;
  const isIncomeTransaction = inflowAmount > outflowAmount;

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

  // 共有口座選択時に自動で分割比率を設定
  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);

    const selectedAccount = accounts.find((a) => a.id === newAccountId);
    // 共有口座の場合、設定された比率で自動分割
    if (selectedAccount?.is_shared && lines.length === 1 && totalAmount > 0) {
      const splitRatio = selectedAccount.default_split_ratio ?? 50;
      const myAmount = Math.round(totalAmount * (splitRatio / 100));
      const partnerAmount = totalAmount - myAmount;

      // パートナー名を取得（partner_nameまたはデフォルト）
      const partnerName = selectedAccount.partner_name || "パートナー";

      setLines([
        {
          ...lines[0],
          amount: myAmount,
        },
        {
          id: generateId(),
          amount: partnerAmount,
          categoryId: lines[0].categoryId,
          lineType: "asset",
          counterparty: partnerName,
          amortizationMonths: 1,
          amortizationEndDate: null,
        },
      ]);
    }
  };

  // 重複チェック関数
  const checkForDuplicates = async () => {
    setIsCheckingDuplicate(true);
    setDuplicateWarning(null);

    try {
      // 1ヶ月前の日付を計算
      const oneMonthAgo = new Date(accrualDate);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const oneMonthAgoStr = format(oneMonthAgo, "yyyy-MM-dd");

      // 直近1ヶ月の同金額の取引を検索
      const { data: recentTx } = await supabase
        .from("transactions")
        .select("id, description, date, total_amount")
        .eq("total_amount", totalAmount)
        .gte("date", oneMonthAgoStr)
        .lte("date", accrualDate)
        .order("date", { ascending: false });

      if (recentTx && recentTx.length > 0) {
        // 完全一致: 同日・同金額
        const exactMatch = recentTx.filter((tx) => tx.date === accrualDate);

        if (exactMatch.length > 0) {
          const txList = exactMatch.map((tx) => tx.description).join("、");
          setDuplicateWarning(
            `同日・同額の取引が既に存在します: ${txList}`
          );
        } else {
          // 部分一致: 直近1ヶ月の同金額
          const txList = recentTx
            .slice(0, 3)
            .map((tx) => `${format(new Date(tx.date), "M/d")} ${tx.description}`)
            .join("、");
          const moreCount = recentTx.length > 3 ? ` 他${recentTx.length - 3}件` : "";
          setDuplicateWarning(
            `直近1ヶ月に同額の取引があります: ${txList}${moreCount}`
          );
        }
      }
    } catch (error) {
      console.error("Duplicate check error:", error);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // 確認ダイアログを開く
  const handleConfirmClick = async () => {
    await checkForDuplicates();
    setShowConfirmDialog(true);
  };

  const handleSave = async () => {
    setShowConfirmDialog(false);
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // 立替えてもらった場合は、自分の口座からの支出ではないので決済済み扱い
      // 代わりに借入（liability）として精算画面に表示される
      const isCashSettled = paidByOther
        ? true // 立替えてもらった場合は決済済み（口座からの支出なし）
        : paymentDate !== null && paymentDate <= accrualDate;
      const settledAmount = isCashSettled ? totalAmount : 0;

      // 立替えてもらった場合は最初の口座を使用（スキーマ要件）
      const transactionAccountId = paidByOther ? accounts[0]?.id : accountId;

      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user?.id,
          date: accrualDate, // 発生日
          payment_date: paidByOther ? accrualDate : paymentDate, // 立替えてもらった場合は発生日
          description,
          account_id: transactionAccountId,
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

      // 立替えてもらった場合は、借入（liability）ラインを追加
      let liabilityLineId: string | null = null;
      const paidByCounterpartyName = getPaidByCounterpartyName();
      if (paidByOther && paidByCounterpartyName) {
        // 新しい相手先の場合はDBに追加
        if (showNewCounterpartyInput && newCounterpartyName.trim()) {
          await supabase
            .from("counterparties")
            .insert({ name: newCounterpartyName.trim(), user_id: user?.id });
        }

        lineInserts.push({
          transaction_id: transaction.id,
          amount: totalAmount,
          category_id: lines[0].categoryId, // 最初のカテゴリを借用
          line_type: "liability",
          counterparty: paidByCounterpartyName,
          is_settled: false,
          amortization_months: 1,
          amortization_start: null,
          amortization_end: null,
        });
      }

      const { data: insertedLines, error: linesError } = await supabase
        .from("transaction_lines")
        .insert(lineInserts)
        .select();

      if (linesError) throw linesError;

      // 立替えてもらった場合の自動相殺処理
      if (paidByOther && paidByCounterpartyName && insertedLines) {
        const counterpartyName = paidByCounterpartyName;
        // 新しく作成したliabilityラインのIDを取得
        const newLiabilityLine = insertedLines.find(
          (l: any) => l.line_type === "liability" && l.counterparty === counterpartyName
        );
        liabilityLineId = newLiabilityLine?.id || null;

        // 同じ相手への未精算の立替（asset）を検索
        const { data: existingAssets } = await supabase
          .from("transaction_lines")
          .select("id, amount, settled_amount, is_settled")
          .eq("counterparty", counterpartyName)
          .eq("line_type", "asset")
          .order("created_at", { ascending: true });

        if (existingAssets && existingAssets.length > 0) {
          // 未精算の立替合計を計算
          let totalUnsettledAssets = 0;
          const unsettledAssetLines: { id: string; unsettledAmount: number }[] = [];

          for (const asset of existingAssets) {
            const settledAmount = asset.settled_amount ?? 0;
            const unsettledAmount = asset.is_settled && settledAmount === 0
              ? 0 // 旧ロジックで精算済み
              : asset.amount - settledAmount;
            if (unsettledAmount > 0) {
              totalUnsettledAssets += unsettledAmount;
              unsettledAssetLines.push({ id: asset.id, unsettledAmount });
            }
          }

          // 相殺可能額を計算（新規借入と未精算立替の小さい方）
          const offsetAmount = Math.min(totalAmount, totalUnsettledAssets);

          if (offsetAmount > 0) {
            // 精算レコードを作成（相殺）
            const { data: newSettlement } = await supabase
              .from("settlements")
              .insert({
                user_id: user?.id,
                date: accrualDate,
                counterparty: counterpartyName,
                amount: 0, // 相殺なので実際の金銭移動は0
                note: `自動相殺: ${description}`,
              })
              .select()
              .single();

            if (newSettlement) {
              const settlementItems: { settlement_id: string; transaction_line_id: string; amount: number }[] = [];
              let remainingOffset = offsetAmount;

              // 立替（asset）を精算
              for (const asset of unsettledAssetLines) {
                if (remainingOffset <= 0) break;
                const toSettle = Math.min(remainingOffset, asset.unsettledAmount);

                // settled_amountを更新
                const currentAsset = existingAssets.find(a => a.id === asset.id);
                const currentSettled = currentAsset?.settled_amount ?? 0;
                await supabase
                  .from("transaction_lines")
                  .update({
                    settled_amount: currentSettled + toSettle,
                    is_settled: (currentSettled + toSettle) >= (currentAsset?.amount ?? 0),
                  })
                  .eq("id", asset.id);

                settlementItems.push({
                  settlement_id: newSettlement.id,
                  transaction_line_id: asset.id,
                  amount: toSettle,
                });

                remainingOffset -= toSettle;
              }

              // 新規借入（liability）も精算扱いにする
              if (liabilityLineId) {
                await supabase
                  .from("transaction_lines")
                  .update({
                    settled_amount: offsetAmount,
                    is_settled: offsetAmount >= totalAmount,
                  })
                  .eq("id", liabilityLineId);

                settlementItems.push({
                  settlement_id: newSettlement.id,
                  transaction_line_id: liabilityLineId,
                  amount: offsetAmount,
                });
              }

              // settlement_itemsを保存
              if (settlementItems.length > 0) {
                await (supabase as any).from("settlement_items").insert(settlementItems);
              }
            }
          }
        }
      }

      // Reset form
      setTotalAmount(0);
      setDescription("");
      setAccrualDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setCounterpartyId(null);
      setPaidByOther(false);
      setPaidByCounterpartyId(null);
      setNewCounterpartyName("");
      setShowNewCounterpartyInput(false);
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

  // 立替えてもらった場合は相手先が必要（既存選択か新規入力）
  const paidByCounterpartyValid = !paidByOther ||
    paidByCounterpartyId !== null ||
    (showNewCounterpartyInput && newCounterpartyName.trim() !== "");

  const canSave =
    totalAmount > 0 &&
    description.trim() !== "" &&
    remainingAmount === 0 &&
    lines.every((line) => line.amount > 0 && line.categoryId) &&
    paidByCounterpartyValid;

  // 相手先名を取得するヘルパー
  const getPaidByCounterpartyName = (): string => {
    if (showNewCounterpartyInput && newCounterpartyName.trim()) {
      return newCounterpartyName.trim();
    }
    if (paidByCounterpartyId) {
      return counterparties.find(cp => cp.id === paidByCounterpartyId)?.name || "";
    }
    return "";
  };

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
        <div className="space-y-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:space-y-0">
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
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 発生日
                </label>
                <DatePicker
                  value={accrualDate ? parseISO(accrualDate) : undefined}
                  onChange={(date) => setAccrualDate(date ? format(date, "yyyy-MM-dd") : "")}
                />
              </div>
              {/* 立替えてもらった場合は支払日不要 */}
              {!paidByOther && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> {isIncomeTransaction ? "入金日" : "支払日"}
                  </label>
                  <div className="flex items-center gap-2">
                    {paymentDate === null ? (
                      <div className="flex-1 text-sm text-muted-foreground py-2">未定</div>
                    ) : (
                      <div className="flex-1">
                        <DatePicker
                          value={paymentDate ? parseISO(paymentDate) : undefined}
                          onChange={(date) => setPaymentDate(date ? format(date, "yyyy-MM-dd") : null)}
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
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
              )}
              {/* 決済状態プレビュー */}
              <div className="text-xs text-center">
                {paidByOther ? (
                  <span className="text-blue-500">→ 立替えてもらったため、自分の口座からの支出なし</span>
                ) : paymentDate === null ? (
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
              <Select
                value={paidByOther ? "__paid_by_other__" : accountId}
                onValueChange={(v) => {
                  if (v === "__paid_by_other__") {
                    setPaidByOther(true);
                  } else {
                    setPaidByOther(false);
                    setPaidByCounterpartyId(null);
                    setNewCounterpartyName("");
                    setShowNewCounterpartyInput(false);
                    handleAccountChange(v);
                  }
                }}
              >
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
                      {account.is_shared && (
                        <span className="ml-1 text-xs text-blue-500">
                          [{account.default_split_ratio}:{100 - (account.default_split_ratio ?? 50)}]
                        </span>
                      )}
                    </SelectItem>
                  ))}
                  {!isIncomeTransaction && (
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
                  <p className="text-xs text-muted-foreground">
                    → この人への借入として精算画面に表示されます
                  </p>
                </div>
              )}
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
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
                  counterparties={counterparties}
                  onChange={(updated) => handleUpdateLine(index, updated)}
                  onDelete={() => handleDeleteLine(index)}
                  canDelete={lines.length > 1}
                  onNewCounterparty={async (name) => {
                    await supabase
                      .from("counterparties")
                      .insert({ name, user_id: user?.id });
                    // counterpartiesリストを更新
                    const { data } = await supabase
                      .from("counterparties")
                      .select("*")
                      .eq("is_active", true)
                      .order("name");
                    if (data) setCounterparties(data);
                  }}
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
              onClick={handleConfirmClick}
              disabled={!canSave || isSaving || isCheckingDuplicate}
              className="w-full h-14 text-lg font-medium"
              size="lg"
            >
              {isSaving || isCheckingDuplicate ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  確認する
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>入力内容の確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                {/* 重複警告 */}
                {duplicateWarning && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm text-destructive">
                      {duplicateWarning}
                    </div>
                  </div>
                )}

                {/* 取引サマリー */}
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">金額</span>
                    <span className={`font-bold ${isIncomeTransaction ? "text-income" : "text-expense"}`}>
                      {isIncomeTransaction ? "+" : "-"}¥{totalAmount.toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">説明</span>
                    <span className="font-medium text-foreground">{description}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">発生日</span>
                    <span className="text-foreground">{format(new Date(accrualDate), "M月d日(E)", { locale: ja })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">{isIncomeTransaction ? "入金先" : "支払い方法"}</span>
                    <span className="text-foreground">
                      {paidByOther ? (
                        <span className="text-blue-600">立替えてもらった</span>
                      ) : (
                        accounts.find((a) => a.id === accountId)?.name || "-"
                      )}
                    </span>
                  </div>
                  {paidByOther && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">立替えてくれた人</span>
                      <span className="text-blue-600 font-medium">{getPaidByCounterpartyName()}</span>
                    </div>
                  )}
                </div>

                {/* 立替えてもらった場合の説明 */}
                {paidByOther && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    <p>→ {getPaidByCounterpartyName()}さんへの借入として精算画面に表示されます</p>
                  </div>
                )}

                {/* 内訳 */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">内訳</p>
                  <div className="bg-muted rounded-lg divide-y divide-border">
                    {lines.map((line, index) => {
                      const category = categories.find((c) => c.id === line.categoryId);
                      const typeLabel =
                        line.lineType === "income" ? "収入" :
                        line.lineType === "expense" ? "支出" :
                        line.lineType === "asset" ? "立替" : "借入";
                      return (
                        <div key={line.id} className="p-2 flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              line.lineType === "income" ? "bg-income/20 text-income" :
                              line.lineType === "asset" ? "bg-blue-500/20 text-blue-600" :
                              "bg-expense/20 text-expense"
                            }`}>
                              {typeLabel}
                            </span>
                            <span className="text-foreground">{category?.name || "未分類"}</span>
                            {line.counterparty && (
                              <span className="text-muted-foreground">({line.counterparty})</span>
                            )}
                          </div>
                          <span className="font-medium text-foreground">¥{line.amount.toLocaleString("ja-JP")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 mt-0">戻る</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="flex-1">
              記録する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

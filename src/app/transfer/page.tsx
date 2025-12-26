"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowRight, Wallet, Check, Calendar } from "lucide-react";
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
import { supabase, type Tables } from "@/lib/supabase";

type Account = Tables<"accounts">;

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form state
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [description, setDescription] = useState("");

  // Category IDs
  const [transferCategoryId, setTransferCategoryId] = useState<string | null>(null);
  const [feeCategoryId, setFeeCategoryId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize date on client side to avoid hydration mismatch
    if (!transferDate) {
      setTransferDate(format(new Date(), "yyyy-MM-dd"));
    }

    async function fetchData() {
      setIsLoading(true);

      const [accountsRes, categoriesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("name"),
        supabase.from("categories").select("*").eq("is_active", true),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data);
        if (accountsRes.data.length >= 2) {
          setFromAccountId(accountsRes.data[0].id);
          setToAccountId(accountsRes.data[1].id);
        }
      }

      if (categoriesRes.data) {
        const transferCat = categoriesRes.data.find((c) => c.name === "資金移動");
        const feeCat = categoriesRes.data.find((c) => c.name === "振込手数料");
        if (transferCat) setTransferCategoryId(transferCat.id);
        if (feeCat) setFeeCategoryId(feeCat.id);
      }

      setIsLoading(false);
    }
    fetchData();
  }, [transferDate]);

  const handleTransfer = async () => {
    if (!fromAccountId || !toAccountId || !amount || !transferCategoryId) return;
    if (fromAccountId === toAccountId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const transferAmount = parseInt(amount, 10);
      const feeAmount = fee ? parseInt(fee, 10) : 0;

      const fromAccount = accounts.find((a) => a.id === fromAccountId);
      const toAccount = accounts.find((a) => a.id === toAccountId);
      const desc = description || `${fromAccount?.name} → ${toAccount?.name}`;

      // Create outgoing transaction (from source account)
      const { data: outTx, error: outError } = await supabase
        .from("transactions")
        .insert({
          date: transferDate,
          payment_date: transferDate,
          description: desc,
          account_id: fromAccountId,
          total_amount: transferAmount + feeAmount,
          is_cash_settled: true,
          settled_amount: transferAmount + feeAmount,
        })
        .select()
        .single();

      if (outError) throw outError;

      // Create line items for outgoing transaction
      const outLines = [
        {
          transaction_id: outTx.id,
          amount: transferAmount,
          category_id: transferCategoryId,
          line_type: "expense",
          is_settled: true,
        },
      ];

      // Add fee line if applicable
      if (feeAmount > 0 && feeCategoryId) {
        outLines.push({
          transaction_id: outTx.id,
          amount: feeAmount,
          category_id: feeCategoryId,
          line_type: "expense",
          is_settled: true,
        });
      }

      await supabase.from("transaction_lines").insert(outLines);

      // Create incoming transaction (to destination account)
      const { data: inTx, error: inError } = await supabase
        .from("transactions")
        .insert({
          date: transferDate,
          payment_date: transferDate,
          description: desc,
          account_id: toAccountId,
          total_amount: transferAmount,
          is_cash_settled: true,
          settled_amount: transferAmount,
        })
        .select()
        .single();

      if (inError) throw inError;

      // Create line item for incoming transaction
      await supabase.from("transaction_lines").insert({
        transaction_id: inTx.id,
        amount: transferAmount,
        category_id: transferCategoryId,
        line_type: "income",
        is_settled: true,
      });

      // Update account balances
      if (fromAccount?.current_balance !== null && fromAccount?.current_balance !== undefined) {
        await supabase
          .from("accounts")
          .update({ current_balance: fromAccount.current_balance - transferAmount - feeAmount })
          .eq("id", fromAccountId);
      }

      if (toAccount?.current_balance !== null && toAccount?.current_balance !== undefined) {
        await supabase
          .from("accounts")
          .update({ current_balance: toAccount.current_balance + transferAmount })
          .eq("id", toAccountId);
      }

      // Reset form
      setAmount("");
      setFee("");
      setDescription("");
      setSaveMessage("資金移動を記録しました");

      // Refresh accounts
      const { data: refreshedAccounts } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (refreshedAccounts) setAccounts(refreshedAccounts);

      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error("Transfer error:", error);
      setSaveMessage("エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

  const canTransfer =
    fromAccountId &&
    toAccountId &&
    fromAccountId !== toAccountId &&
    amount &&
    parseInt(amount, 10) > 0;

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
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">資金移動</h1>
          <p className="text-muted-foreground text-sm mt-1">
            口座間で資金を移動
          </p>
        </div>

        {/* Success Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary text-primary-foreground rounded-lg p-3 text-center font-medium"
          >
            {saveMessage}
          </motion.div>
        )}

        {/* Transfer Form */}
        <div className="space-y-4">
          {/* Date */}
          <div className="bg-card rounded-xl p-4 border border-border flex items-center justify-between">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 日付
            </label>
            <Input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-40 text-right"
            />
          </div>

          {/* From/To Accounts */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-4">
              {/* From Account */}
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">移動元</label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          <span>{account.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromAccountId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    残高: ¥{(accounts.find((a) => a.id === fromAccountId)?.current_balance || 0).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight className="w-6 h-6 text-muted-foreground mt-4" />

              {/* To Account */}
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">移動先</label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          <span>{account.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {toAccountId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    残高: ¥{(accounts.find((a) => a.id === toAccountId)?.current_balance || 0).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {fromAccountId === toAccountId && fromAccountId && (
              <p className="text-xs text-expense text-center mt-2">
                同じ口座を選択しています
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">移動金額</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                className="pl-7 text-lg font-bold"
              />
            </div>
          </div>

          {/* Fee */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">振込手数料（任意）</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={fee}
                onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ""))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">メモ（任意）</label>
            <Input
              type="text"
              placeholder="例: 生活費の補充"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Summary */}
          {amount && parseInt(amount, 10) > 0 && (
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">移動金額</span>
                <span>¥{parseInt(amount, 10).toLocaleString()}</span>
              </div>
              {fee && parseInt(fee, 10) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">振込手数料</span>
                  <span className="text-expense">¥{parseInt(fee, 10).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-2">
                <span>合計出金</span>
                <span>¥{(parseInt(amount, 10) + (fee ? parseInt(fee, 10) : 0)).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleTransfer}
            disabled={!canTransfer || isSaving}
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
                資金移動を記録
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

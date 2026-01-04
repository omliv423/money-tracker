"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, Wallet, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

const accountTypes = [
  { value: "bank", label: "銀行口座", icon: Wallet },
  { value: "card", label: "クレジットカード", icon: CreditCard },
  { value: "cash", label: "現金", icon: Banknote },
  { value: "ewallet", label: "電子マネー", icon: Smartphone },
];

interface AccountDraft {
  id: string;
  name: string;
  type: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function OnboardingAccountsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { id: generateId(), name: "", type: "bank" },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddAccount = () => {
    setAccounts([
      ...accounts,
      { id: generateId(), name: "", type: "bank" },
    ]);
  };

  const handleRemoveAccount = (id: string) => {
    if (accounts.length > 1) {
      setAccounts(accounts.filter((a) => a.id !== id));
    }
  };

  const handleUpdateAccount = (id: string, field: "name" | "type", value: string) => {
    setAccounts(
      accounts.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const validAccounts = accounts.filter((a) => a.name.trim() !== "");
  const canProceed = validAccounts.length > 0;

  const handleNext = async () => {
    if (!canProceed) return;

    setIsSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from("accounts").insert(
        validAccounts.map((a) => ({
          user_id: user?.id,
          name: a.name.trim(),
          type: a.type,
          owner: "self",
          opening_balance: 0,
          current_balance: 0,
          is_active: true,
        }))
      );

      if (insertError) {
        throw insertError;
      }

      router.push("/onboarding/categories");
    } catch (err) {
      console.error("Error saving accounts:", err);
      setError("口座の保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OnboardingLayout
      currentStep={1}
      title="口座を登録"
      description="お金を管理する口座を追加しましょう"
    >
      <div className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        <div className="space-y-3">
          {accounts.map((account, index) => {
            const TypeIcon = accountTypes.find((t) => t.value === account.type)?.icon || Wallet;
            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl p-4 border border-border space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TypeIcon className="w-4 h-4" />
                    <span>口座 {index + 1}</span>
                  </div>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => handleRemoveAccount(account.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="例: 楽天銀行、現金、PayPay"
                  value={account.name}
                  onChange={(e) =>
                    handleUpdateAccount(account.id, "name", e.target.value)
                  }
                />
                <Select
                  value={account.type}
                  onValueChange={(v) =>
                    handleUpdateAccount(account.id, "type", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={handleAddAccount}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          口座を追加
        </Button>

        <div className="pt-4 space-y-2">
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSaving}
            className="w-full h-12"
          >
            {isSaving ? "保存中..." : "次へ"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            口座は後から追加・変更できます
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}

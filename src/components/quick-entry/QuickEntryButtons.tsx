"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase, type Tables } from "@/lib/supabase";
import { format } from "date-fns";

type QuickEntry = Tables<"quick_entries"> & {
  account?: { name: string } | null;
  category?: { name: string } | null;
};

export function QuickEntryButtons() {
  const [items, setItems] = useState<QuickEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QuickEntry | null>(null);
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("quick_entries")
      .select(`
        *,
        account:accounts(name),
        category:categories(name)
      `)
      .eq("is_active", true)
      .order("use_count", { ascending: false })
      .limit(10);

    if (data) setItems(data as QuickEntry[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQuickEntryClick = (entry: QuickEntry) => {
    setSelectedEntry(entry);
    setAmount("");
  };

  const handleSave = async () => {
    if (!selectedEntry || !amount || !selectedEntry.account_id) return;

    setIsSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const amountNum = parseInt(amount, 10);

    // Create transaction
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        date: today,
        payment_date: today,
        description: selectedEntry.description || selectedEntry.name,
        account_id: selectedEntry.account_id,
        total_amount: amountNum,
        is_cash_settled: true,
        settled_amount: amountNum,
      })
      .select()
      .single();

    if (txError || !tx) {
      console.error("Error creating transaction:", txError);
      setIsSaving(false);
      return;
    }

    // Create transaction line
    await supabase.from("transaction_lines").insert({
      transaction_id: tx.id,
      amount: amountNum,
      category_id: selectedEntry.category_id,
      line_type: selectedEntry.line_type,
      counterparty: selectedEntry.counterparty,
      is_settled: false,
    });

    // Increment use_count
    await supabase
      .from("quick_entries")
      .update({ use_count: (selectedEntry.use_count || 0) + 1 })
      .eq("id", selectedEntry.id);

    setIsSaving(false);
    setSelectedEntry(null);
    setAmount("");
    fetchData();
  };

  if (isLoading || items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium">クイック入力</span>
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
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleQuickEntryClick(item)}
                      className="px-3 py-2 bg-secondary hover:bg-accent rounded-lg text-sm transition-colors flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Amount Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEntry?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground space-y-1">
              {selectedEntry?.category && (
                <p>カテゴリ: {selectedEntry.category.name}</p>
              )}
              {selectedEntry?.account && (
                <p>口座: {selectedEntry.account.name}</p>
              )}
              {selectedEntry?.counterparty && (
                <p>相手先: {selectedEntry.counterparty}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                金額 <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={!amount || parseInt(amount, 10) <= 0 || isSaving}
              className="w-full"
            >
              {isSaving ? "登録中..." : "登録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

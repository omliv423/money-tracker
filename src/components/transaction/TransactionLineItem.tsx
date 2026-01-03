"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPicker } from "./CategoryPicker";
import type { Tables } from "@/lib/supabase";

type Category = Tables<"categories">;
type Counterparty = Tables<"counterparties">;
type LineType = "income" | "expense" | "asset" | "liability";

export interface LineItemData {
  id: string;
  amount: number;
  categoryId: string;
  lineType: LineType;
  counterparty: string | null;
  amortizationMonths: number;
  amortizationEndDate: string | null; // 終了日（null = 按分なし）
}

interface TransactionLineItemProps {
  line: LineItemData;
  categories: Category[];
  counterparties: Counterparty[];
  onChange: (line: LineItemData) => void;
  onDelete: () => void;
  canDelete: boolean;
  onNewCounterparty?: (name: string) => Promise<void>;
}

const lineTypeOptions: { value: LineType; label: string }[] = [
  { value: "expense", label: "費用" },
  { value: "income", label: "収入" },
  { value: "asset", label: "立替（債権）" },
  { value: "liability", label: "借入（債務）" },
];


export function TransactionLineItem({
  line,
  categories,
  counterparties,
  onChange,
  onDelete,
  canDelete,
  onNewCounterparty,
}: TransactionLineItemProps) {
  // Local state for amount input to prevent formatting while typing
  const [amountInput, setAmountInput] = useState("");
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [showNewCounterpartyInput, setShowNewCounterpartyInput] = useState(false);
  const [newCounterpartyName, setNewCounterpartyName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when line.amount changes from external sources (only when not focused)
  useEffect(() => {
    if (!isAmountFocused) {
      setAmountInput(line.amount > 0 ? line.amount.toString() : "");
    }
  }, [line.amount, isAmountFocused]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    setAmountInput(rawValue);
    const numValue = parseInt(rawValue, 10) || 0;
    onChange({ ...line, amount: numValue });
  };

  const handleAmountBlur = () => {
    setIsAmountFocused(false);
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsAmountFocused(true);
    // Set raw value and select all so typing replaces existing value
    const rawValue = line.amount > 0 ? line.amount.toString() : "";
    setAmountInput(rawValue);
    // Select all text after React updates the input value
    setTimeout(() => {
      e.target.select();
    }, 0);
  };

  const isAssetOrLiability = line.lineType === "asset" || line.lineType === "liability";

  // Category type based on line type
  const categoryType = line.lineType === "income" ? "income" : "expense";

  return (
    <div className="bg-card rounded-xl p-4 space-y-3 border border-border">
      {/* Amount and Type Row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">金額</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">¥</span>
            <input
              type="number"
              value={isAmountFocused ? amountInput : (line.amount > 0 ? line.amount : "")}
              onChange={handleAmountChange}
              onFocus={handleAmountFocus}
              onBlur={handleAmountBlur}
              placeholder="0"
              className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm tabular-nums text-right ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">種別</label>
          <Select
            value={line.lineType}
            onValueChange={(value: LineType) => {
              // Reset categoryId when switching between income/expense types
              const newCategoryType = value === "income" ? "income" : "expense";
              const currentCategory = categories.find((c) => c.id === line.categoryId);
              const shouldResetCategory = currentCategory && currentCategory.type !== newCategoryType;

              onChange({
                ...line,
                lineType: value,
                categoryId: shouldResetCategory ? "" : line.categoryId,
                counterparty: value === "expense" || value === "income" ? null : line.counterparty,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lineTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category Row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">カテゴリ</label>
          <CategoryPicker
            categories={categories}
            selectedId={line.categoryId}
            onSelect={(categoryId) => onChange({ ...line, categoryId })}
            type={categoryType}
          />
        </div>

        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="mt-5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Counterparty Row (for asset/liability) */}
      {isAssetOrLiability && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {line.lineType === "asset" ? "立替先" : "借入元"}
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
                onClick={async () => {
                  if (newCounterpartyName.trim() && onNewCounterparty) {
                    await onNewCounterparty(newCounterpartyName.trim());
                    onChange({ ...line, counterparty: newCounterpartyName.trim() });
                  }
                  setShowNewCounterpartyInput(false);
                  setNewCounterpartyName("");
                }}
              >
                追加
              </Button>
              <Button
                type="button"
                variant="ghost"
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
              value={line.counterparty || ""}
              onValueChange={(v) => {
                if (v === "__new__") {
                  setShowNewCounterpartyInput(true);
                } else {
                  onChange({ ...line, counterparty: v || null });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="相手先を選択" />
              </SelectTrigger>
              <SelectContent>
                {counterparties.map((cp) => (
                  <SelectItem key={cp.id} value={cp.name}>
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
        </div>
      )}

      {/* Amortization Period (for expense only) */}
      {line.lineType === "expense" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`amortize-${line.id}`}
              checked={line.amortizationEndDate !== null}
              onCheckedChange={(checked) => {
                if (checked) {
                  // デフォルトで年末を設定
                  const year = new Date().getFullYear();
                  onChange({ ...line, amortizationEndDate: `${year}-12-31` });
                } else {
                  onChange({ ...line, amortizationEndDate: null, amortizationMonths: 1 });
                }
              }}
            />
            <label
              htmlFor={`amortize-${line.id}`}
              className="text-xs text-muted-foreground cursor-pointer"
            >
              期間按分する
            </label>
          </div>
          {line.amortizationEndDate && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 按分終了日
              </label>
              <Input
                type="date"
                value={line.amortizationEndDate}
                onChange={(e) => onChange({ ...line, amortizationEndDate: e.target.value })}
                className="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

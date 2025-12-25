"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import type { Tables } from "@/lib/supabase";

type Category = Tables<"categories">;
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
  onChange: (line: LineItemData) => void;
  onDelete: () => void;
  canDelete: boolean;
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
  onChange,
  onDelete,
  canDelete,
}: TransactionLineItemProps) {
  // Local state for amount input to prevent formatting while typing
  const [amountInput, setAmountInput] = useState("");
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const isEditingRef = useRef(false);

  // Sync local state when line.amount changes from external sources
  useEffect(() => {
    if (!isEditingRef.current) {
      setAmountInput(line.amount > 0 ? line.amount.toString() : "");
    }
  }, [line.amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    setAmountInput(rawValue);
    const numValue = parseInt(rawValue, 10) || 0;
    onChange({ ...line, amount: numValue });
  };

  const handleAmountBlur = () => {
    setIsAmountFocused(false);
    isEditingRef.current = false;
    // Update local state to match the actual value
    setAmountInput(line.amount > 0 ? line.amount.toString() : "");
  };

  const handleAmountFocus = () => {
    setIsAmountFocused(true);
    // Show raw number without formatting when focused
    setAmountInput(line.amount > 0 ? line.amount.toString() : "");
  };

  const isAssetOrLiability = line.lineType === "asset" || line.lineType === "liability";

  // Filter categories based on line type
  const categoryType = line.lineType === "income" ? "income" : "expense";
  const filteredCategories = categories.filter((cat) => cat.type === categoryType);

  // Build hierarchical category structure
  const parentCategories = filteredCategories.filter((cat) => cat.parent_id === null);
  const getChildren = (parentId: string) => filteredCategories.filter((cat) => cat.parent_id === parentId);

  return (
    <div className="bg-card rounded-xl p-4 space-y-3 border border-border">
      {/* Amount and Type Row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">金額</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
            <Input
              type="text"
              inputMode="numeric"
              value={isAmountFocused ? amountInput : (line.amount > 0 ? line.amount.toLocaleString("ja-JP") : "")}
              onChange={handleAmountChange}
              onFocus={handleAmountFocus}
              onBlur={handleAmountBlur}
              placeholder="0"
              className="pl-7 tabular-nums text-right"
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
          <Select
            value={line.categoryId}
            onValueChange={(value) => onChange({ ...line, categoryId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {parentCategories.map((parent) => {
                const children = getChildren(parent.id);
                if (children.length === 0) {
                  // No children, show as regular item
                  return (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  );
                }
                // Has children, show as group
                return (
                  <SelectGroup key={parent.id}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground px-2">
                      {parent.name}
                    </SelectLabel>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id} className="pl-6">
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
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
          <Input
            type="text"
            placeholder="例: 彼女、友人名"
            value={line.counterparty || ""}
            onChange={(e) => onChange({ ...line, counterparty: e.target.value || null })}
          />
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

"use client";

import { motion } from "framer-motion";
import { Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, LineType } from "@/types/database";

export interface LineItemData {
  id: string;
  amount: number;
  categoryId: string;
  lineType: LineType;
  counterparty: string | null;
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
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0;
    onChange({ ...line, amount: value });
  };

  const isAssetOrLiability = line.lineType === "asset" || line.lineType === "liability";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-card rounded-xl p-4 space-y-3 border border-border"
    >
      {/* Amount and Type Row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">金額</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
            <Input
              type="text"
              inputMode="numeric"
              value={line.amount.toLocaleString("ja-JP")}
              onChange={handleAmountChange}
              className="pl-7 tabular-nums text-right"
            />
          </div>
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">種別</label>
          <Select
            value={line.lineType}
            onValueChange={(value: LineType) => {
              onChange({
                ...line,
                lineType: value,
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
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
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
    </motion.div>
  );
}

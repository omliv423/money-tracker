"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function AmountInput({ value, onChange, className }: AmountInputProps) {
  const formattedValue = value.toLocaleString("ja-JP");

  const handleKeyDown = (key: string) => {
    if (key === "backspace") {
      onChange(Math.floor(value / 10));
    } else if (key === "clear") {
      onChange(0);
    } else {
      const digit = parseInt(key, 10);
      if (!isNaN(digit) && value < 100000000) {
        onChange(value * 10 + digit);
      }
    }
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"],
  ];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Display */}
      <div className="text-center py-4">
        <div className="text-muted-foreground text-xs mb-1">金額</div>
        <motion.div
          key={value}
          initial={{ scale: 1.05, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-heading text-5xl font-bold tabular-nums"
        >
          <span className="text-3xl text-muted-foreground mr-1">¥</span>
          {formattedValue}
        </motion.div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-1.5">
        {keys.flat().map((key) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleKeyDown(key)}
            className={cn(
              "h-12 rounded-xl font-medium text-lg transition-colors",
              key === "clear" || key === "backspace"
                ? "bg-secondary text-secondary-foreground"
                : "bg-card text-card-foreground hover:bg-accent"
            )}
          >
            {key === "backspace" ? "⌫" : key === "clear" ? "C" : key}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useOverdueSettlements } from "@/hooks/useOverdueSettlements";

export function OverdueSettlementsBanner() {
  const { overdueCount, totalOverdueAmount, isLoading } = useOverdueSettlements();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isLoading || overdueCount === 0 || isDismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <span className="font-medium">期限超過 {overdueCount}件</span>
            <span className="text-amber-700 dark:text-amber-300 ml-1">
              ¥{totalOverdueAmount.toLocaleString("ja-JP")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/cash-settlements"
            className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors px-2 py-1 rounded hover:bg-amber-500/20"
          >
            確認
          </Link>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-amber-500/20 rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

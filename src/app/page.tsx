"use client";

import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/transaction/TransactionForm";
import { RecurringTransactionsCard } from "@/components/recurring/RecurringTransactionsCard";
import { QuickEntryButtons } from "@/components/quick-entry/QuickEntryButtons";
import { ArrowLeftRight } from "lucide-react";

export default function Home() {
  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Quick Actions */}
        <div className="flex justify-end">
          <Link
            href="/transfer"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            資金移動
          </Link>
        </div>

        {/* Recurring Transactions */}
        <RecurringTransactionsCard />

        {/* Quick Entry Buttons */}
        <QuickEntryButtons />

        <TransactionForm />
      </div>
    </MainLayout>
  );
}

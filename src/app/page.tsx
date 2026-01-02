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
      <div className="space-y-4 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="flex justify-end lg:justify-start">
            <Link
              href="/transfer"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              資金移動
            </Link>
          </div>

          <TransactionForm />
        </div>

        <div className="space-y-4">
          {/* Recurring Transactions */}
          <RecurringTransactionsCard />

          {/* Quick Entry Buttons */}
          <QuickEntryButtons />
        </div>
      </div>
    </MainLayout>
  );
}

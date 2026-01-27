"use client";

import { useState } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/transaction/TransactionForm";
import { RecurringTransactionsCard } from "@/components/recurring/RecurringTransactionsCard";
import { QuickEntryButtons } from "@/components/quick-entry/QuickEntryButtons";
import { TourGuide } from "@/components/tour/TourGuide";
import { OverdueSettlementsBanner } from "@/components/alerts/OverdueSettlementsBanner";
import { useTour } from "@/hooks/useTour";
import { ArrowLeftRight, RefreshCw, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Home() {
  const { showTour, completeTour } = useTour();
  const [showRecurring, setShowRecurring] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  return (
    <MainLayout>
      {showTour && <TourGuide onComplete={completeTour} />}

      {/* Compact action buttons */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setShowRecurring(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary hover:bg-accent rounded-full transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          定期取引
        </button>
        <button
          onClick={() => setShowQuickEntry(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary hover:bg-accent rounded-full transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          クイック
        </button>
        <Link
          href="/transfer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          資金移動
        </Link>
      </div>

      <OverdueSettlementsBanner />

      {/* Transaction Form - main content */}
      <TransactionForm />

      {/* Recurring Transactions Sheet */}
      <Sheet open={showRecurring} onOpenChange={setShowRecurring}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              定期取引
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto h-[calc(100%-60px)]">
            <RecurringTransactionsCard embedded />
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Entry Sheet */}
      <Sheet open={showQuickEntry} onOpenChange={setShowQuickEntry}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              クイック入力
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-6">
            <QuickEntryButtons embedded />
          </div>
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/transaction/TransactionForm";
import { RecurringTransactionsCard } from "@/components/recurring/RecurringTransactionsCard";
import { QuickEntryButtons } from "@/components/quick-entry/QuickEntryButtons";
import { TourGuide } from "@/components/tour/TourGuide";
import { useTour } from "@/hooks/useTour";
import { ArrowLeftRight } from "lucide-react";
import { AboutModal } from "@/components/about/AboutModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { showTour, completeTour } = useTour();
  const { user } = useAuth();
  const [showAbout, setShowAbout] = useState(false);

  // 初回ログイン時にAboutモーダルを表示
  useEffect(() => {
    async function checkFirstLogin() {
      if (!user?.id) return;

      const { data } = await supabase
        .from("subscriptions")
        .select("has_seen_about")
        .eq("user_id", user.id)
        .single();

      if (data && data.has_seen_about === false) {
        // 少し遅延させて自然に表示
        setTimeout(() => setShowAbout(true), 500);
      }
    }

    checkFirstLogin();
  }, [user?.id]);

  const handleAboutClose = async () => {
    setShowAbout(false);

    // フラグを更新
    if (user?.id) {
      await supabase
        .from("subscriptions")
        .update({ has_seen_about: true })
        .eq("user_id", user.id);
    }
  };

  return (
    <MainLayout>
      {showTour && <TourGuide onComplete={completeTour} />}
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

      {/* 初回ログイン時のAboutモーダル */}
      <AboutModal isOpen={showAbout} onClose={handleAboutClose} />
    </MainLayout>
  );
}

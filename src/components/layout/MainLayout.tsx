"use client";

import { User, Users2 } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";
import { useViewMode } from "@/components/providers/ViewModeProvider";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { viewMode, setViewMode, isHouseholdMember } = useViewMode();

  return (
    <div className="min-h-screen pb-24 md:pb-10 safe-area-top">
      <TopNav />
      {/* Mobile header with view mode toggle */}
      {isHouseholdMember && (
        <div className="sticky top-0 z-40 md:hidden">
          <div className="bg-card/80 backdrop-blur-xl border-b border-border/70 px-4 py-2">
            <div className="flex items-center justify-between max-w-lg mx-auto">
              <span className="font-heading text-sm font-semibold">Money Tracker</span>
              <div className="flex items-center gap-1 rounded-full bg-secondary p-0.5">
                <button
                  onClick={() => setViewMode("personal")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "personal"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <User className="h-3 w-3" />
                  個人
                </button>
                <button
                  onClick={() => setViewMode("shared")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "shared"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <Users2 className="h-3 w-3" />
                  共有
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-lg px-4 py-6 md:max-w-4xl md:px-6 md:py-8 lg:max-w-6xl">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

"use client";

import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen pb-24 md:pb-10 safe-area-top">
      <TopNav />
      <main className="mx-auto max-w-lg px-4 py-6 md:max-w-4xl md:px-6 md:py-8 lg:max-w-6xl">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

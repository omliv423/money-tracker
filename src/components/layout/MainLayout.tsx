"use client";

import { BottomNav } from "./BottomNav";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="pb-20">
      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

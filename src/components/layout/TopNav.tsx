"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PlusCircle,
  List,
  PieChart,
  Users,
  Settings,
  User,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/components/providers/ViewModeProvider";

const navItems = [
  { href: "/", icon: PlusCircle, label: "記録" },
  { href: "/transactions", icon: List, label: "一覧" },
  { href: "/reports", icon: PieChart, label: "レポート" },
  { href: "/settlements", icon: Users, label: "精算" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function TopNav() {
  const pathname = usePathname();
  const { viewMode, setViewMode, isHouseholdMember } = useViewMode();

  return (
    <nav className="sticky top-0 z-40 hidden md:block">
      <div className="border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="font-heading text-lg font-semibold tracking-tight">
              Money Tracker
            </div>
            {isHouseholdMember && (
              <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                <button
                  onClick={() => setViewMode("personal")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "personal"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  個人
                </button>
                <button
                  onClick={() => setViewMode("shared")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "shared"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users2 className="h-3.5 w-3.5" />
                  共有
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

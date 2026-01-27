"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  PlusCircle,
  List,
  PieChart,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: PlusCircle, label: "記録" },
  { href: "/transactions", icon: List, label: "一覧" },
  { href: "/reports", icon: PieChart, label: "レポート" },
  { href: "/settlements", icon: Users, label: "精算" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom md:hidden">
      <div className="mx-4 mb-4">
        <div className="bg-card/85 backdrop-blur-xl border border-border/70 rounded-3xl shadow-soft max-w-lg mx-auto">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-14 h-12 rounded-xl",
                    "transition-all duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("w-5 h-5 relative z-10", isActive && "stroke-[2.5]")} />
                  <span className={cn(
                    "text-[10px] mt-0.5 font-medium relative z-10",
                    isActive && "font-semibold"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

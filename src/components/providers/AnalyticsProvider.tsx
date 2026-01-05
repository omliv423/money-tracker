"use client";

import { useAnalytics } from "@/hooks/useAnalytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  // This hook automatically tracks page views
  useAnalytics();

  return <>{children}</>;
}

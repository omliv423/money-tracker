import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Json } from "@/types/supabase";

// Generate a session ID for grouping events
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
}

export function useAnalytics() {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  // Track page views automatically
  useEffect(() => {
    if (pathname && pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      trackEvent("page_view", { path: pathname });
    }
  }, [pathname]);

  const trackEvent = useCallback(
    async (eventName: string, eventData: { [key: string]: Json | undefined } = {}) => {
      try {
        await supabase.from("analytics_events").insert({
          user_id: user?.id || null,
          event_name: eventName,
          event_data: eventData as Json,
          page_path: typeof window !== "undefined" ? window.location.pathname : null,
          session_id: getSessionId(),
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.debug("Analytics error:", error);
      }
    },
    [user?.id]
  );

  return { trackEvent };
}

// Predefined event names for consistency
export const AnalyticsEvents = {
  // Auth
  LOGIN: "login",
  LOGOUT: "logout",
  SIGNUP: "signup",

  // Transactions
  TRANSACTION_CREATE: "transaction_create",
  TRANSACTION_UPDATE: "transaction_update",
  TRANSACTION_DELETE: "transaction_delete",

  // Quick Entry
  QUICK_ENTRY_USE: "quick_entry_use",
  QUICK_ENTRY_CREATE: "quick_entry_create",

  // Recurring
  RECURRING_CREATE: "recurring_create",
  RECURRING_EXECUTE: "recurring_execute",

  // Export
  DATA_EXPORT: "data_export",

  // Subscription
  SUBSCRIPTION_START: "subscription_start",
  SUBSCRIPTION_CANCEL: "subscription_cancel",

  // Settings
  ACCOUNT_DELETE: "account_delete",

  // Pages
  PAGE_VIEW: "page_view",
} as const;

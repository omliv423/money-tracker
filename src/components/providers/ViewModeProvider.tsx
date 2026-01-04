"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";

type ViewMode = "personal" | "shared";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isHouseholdMember: boolean;
  filterByUser: boolean; // true when showing personal data only
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("shared");
  const [isHouseholdMember, setIsHouseholdMember] = useState(false);

  // Check if user is part of a household
  useEffect(() => {
    async function checkHousehold() {
      if (!user?.id) {
        setIsHouseholdMember(false);
        return;
      }

      const { data } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsHouseholdMember(!!data?.household_id);
    }

    checkHousehold();
  }, [user?.id]);

  // Load saved preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("viewMode");
      if (saved === "personal" || saved === "shared") {
        setViewMode(saved);
      }
    }
  }, []);

  // Save preference to localStorage
  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("viewMode", mode);
    }
  };

  // If not in a household, always show personal data
  const effectiveViewMode = isHouseholdMember ? viewMode : "personal";
  const filterByUser = effectiveViewMode === "personal";

  return (
    <ViewModeContext.Provider
      value={{
        viewMode: effectiveViewMode,
        setViewMode: handleSetViewMode,
        isHouseholdMember,
        filterByUser,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}

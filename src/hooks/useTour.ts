"use client";

import { useState, useEffect, useCallback } from "react";

const TOUR_COMPLETED_KEY = "money-tracker-tour-completed";

export function useTour() {
  const [showTour, setShowTour] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if tour has been completed
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!completed) {
      setShowTour(true);
    }
    setIsLoading(false);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    setShowTour(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setShowTour(true);
  }, []);

  return {
    showTour,
    isLoading,
    completeTour,
    resetTour,
  };
}

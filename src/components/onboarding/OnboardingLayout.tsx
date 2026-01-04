"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: 1 | 2;
  totalSteps?: number;
  title: string;
  description?: string;
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps = 2,
  title,
  description,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen px-4 py-10 safe-area-top">
      <div className="mx-auto w-full max-w-md">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i + 1 === currentStep
                  ? "w-8 bg-primary"
                  : i + 1 < currentStep
                  ? "w-2 bg-primary"
                  : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

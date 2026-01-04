"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Wallet, PlusCircle, BarChart3, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  image?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "ようこそ！",
    description: "Money Trackerへようこそ！\nこのツアーでアプリの基本的な使い方をご紹介します。",
    icon: Wallet,
  },
  {
    title: "取引を記録",
    description: "画面下の「＋」ボタンから、収入や支出を簡単に記録できます。\nカテゴリを選んで金額を入力するだけ！",
    icon: PlusCircle,
  },
  {
    title: "レポートで分析",
    description: "「レポート」タブで、月別の収支や\nカテゴリ別の支出を確認できます。",
    icon: BarChart3,
  },
  {
    title: "定期取引",
    description: "毎月の固定費は「定期取引」に登録すると\n自動で記録されるので便利です。",
    icon: RefreshCw,
  },
  {
    title: "パートナーと共有",
    description: "設定から「パートナー共有」を使うと\n家計簿を共有できます。",
    icon: Users,
  },
];

interface TourGuideProps {
  onComplete: () => void;
}

export function TourGuide({ onComplete }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const step = tourSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card rounded-3xl p-6 w-full max-w-sm border border-border shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-6">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? "w-6 bg-primary"
                      : index < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Icon */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center mb-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-10 h-10 text-primary" />
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              key={`content-${currentStep}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-center mb-8"
            >
              <h2 className="font-bold text-xl mb-3">{step.title}</h2>
              <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed">
                {step.description}
              </p>
            </motion.div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStep > 0 ? (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  戻る
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="flex-1 text-muted-foreground"
                >
                  スキップ
                </Button>
              )}
              <Button onClick={handleNext} className="flex-1">
                {isLastStep ? (
                  "始める"
                ) : (
                  <>
                    次へ
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

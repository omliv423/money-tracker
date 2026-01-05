"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plane, Calendar, CreditCard, Sparkles } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-12 bottom-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[85vh] bg-card rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="font-heading text-lg font-bold">このアプリについて</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Hero Illustration */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
                <SketchIllustration />
              </motion.div>

              {/* Story Section 1 - きっかけ */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <h3 className="font-heading text-xl font-bold text-primary">
                  きっかけ
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  8月に沖縄旅行に行くとします。2月に飛行機を予約して、カードで支払いました。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  普通の家計簿だと、これは「2月の交通費」として記録されます。でも実際に旅行するのは8月。沖縄で使ったお金も「8月の娯楽費」になります。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  同じ旅行なのに、費用の計上タイミングがバラバラで、ずっとモヤモヤしていました。
                </p>
              </motion.div>

              {/* Divider with icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-3"
              >
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <div className="p-2 rounded-full bg-secondary">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </motion.div>

              {/* Story Section 2 - 試行錯誤 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <p className="text-muted-foreground leading-relaxed">
                  なんとかできないか考えて、しばらくはスプレッドシートにカードの明細をエクスポートして、発生日を編集することで実現していましたが、毎日エクスポートするのは大変だし、月1回でも忘れてしまって、結局続けられませんでした...
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  「費用の発生」と「お金の動き」を分けて、毎日記録ができるアプリがあったらいいなと思い、作ってみることにしました。
                </p>
                <p className="text-foreground leading-relaxed">
                  収益/費用の発生タイミングと入出金タイミングを分けることができ、それを
                  <span className="text-primary font-medium">PL、BS、CF</span>
                  で確認できるアプリです。
                </p>
              </motion.div>

              {/* Divider with icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-center gap-3"
              >
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </motion.div>

              {/* Story Section 3 - できないこと */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
              >
                <h3 className="font-heading text-xl font-bold">
                  できないこと
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  よくある家計簿アプリにある「口座の自動連携」には対応していません。法人化して許諾を取ればできるらしいのですが、今のところはやる予定はありません。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  むしろ、自分が使ったお金を丁寧に手入力して、
                  <span className="text-foreground font-medium">「家計の財務」を自分で管理したい</span>
                  という方に使っていただけたら嬉しいです。
                </p>
              </motion.div>

              {/* Contact */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-5 border border-primary/10"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  何かあれば
                  <a
                    href="mailto:moneytracker001@gmail.com"
                    className="text-primary hover:underline font-medium mx-1"
                  >
                    moneytracker001@gmail.com
                  </a>
                  までご連絡ください！
                </p>
              </motion.div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center pt-4"
              >
                <p className="text-xs text-muted-foreground/70">
                  Made with 💚 for mindful money tracking
                </p>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hand-drawn style illustration component
function SketchIllustration() {
  return (
    <div className="relative bg-gradient-to-br from-secondary/80 to-secondary/40 rounded-2xl p-6 border border-border/50 overflow-hidden">
      {/* Background pattern - notebook lines */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="border-b border-primary/30"
            style={{ marginTop: i === 0 ? "24px" : "24px" }}
          />
        ))}
      </div>

      {/* Main illustration */}
      <div className="relative">
        {/* Timeline */}
        <div className="flex items-center justify-between mb-6">
          {/* February */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-xl bg-card border-2 border-dashed border-primary/40 flex flex-col items-center justify-center transform -rotate-2 shadow-sm">
              <Calendar className="w-4 h-4 text-primary/60 mb-1" />
              <span className="text-xs font-bold text-primary">2月</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-2">予約・支払</span>
          </motion.div>

          {/* Arrow with plane */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="flex-1 flex items-center justify-center relative"
          >
            {/* Dotted line */}
            <div className="absolute w-full border-t-2 border-dashed border-primary/30" />

            {/* Plane */}
            <motion.div
              animate={{
                x: [0, 5, 0],
                y: [0, -3, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              }}
              className="relative z-10 bg-card p-2 rounded-full shadow-md border border-primary/20"
            >
              <Plane className="w-5 h-5 text-primary transform rotate-45" />
            </motion.div>
          </motion.div>

          {/* August */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-xl bg-primary/10 border-2 border-primary flex flex-col items-center justify-center transform rotate-2 shadow-sm">
              <span className="text-lg">🏝️</span>
              <span className="text-xs font-bold text-primary">8月</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-2">実際の旅行</span>
          </motion.div>
        </div>

        {/* Annotation */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground">
            ↑ 同じ旅行なのに、記録がバラバラ？
          </p>
          <p className="text-sm font-medium text-primary mt-1">
            発生日 = 8月 で統一したい！
          </p>
        </motion.div>
      </div>

      {/* Decorative elements - hand-drawn style circles */}
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full border-2 border-dashed border-accent/30 transform rotate-12" />
      <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full border-2 border-dashed border-primary/20 transform -rotate-6" />
    </div>
  );
}

// Export a trigger button component for convenience
export function AboutTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-muted-foreground/70 hover:text-primary transition-colors underline-offset-2 hover:underline"
    >
      このアプリについて
    </button>
  );
}

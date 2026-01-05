"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plane, Calendar, CreditCard, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    } catch {
      setError("ログインに失敗しました");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-top">
      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative h-20 w-20 mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/20 rotate-6" />
            <div className="absolute inset-1 rounded-[0.9rem] border border-white/70 bg-glass shadow-soft" />
            <div className="absolute inset-2 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-glow flex items-center justify-center">
              <span className="font-heading text-2xl font-semibold tracking-tight text-white">
                MT
              </span>
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            <span className="text-gradient">Money</span>
            <span className="text-foreground"> Tracker</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            お金の流れを、もっとシンプルに
          </p>
        </motion.div>

        {/* Login Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            size="lg"
            className="w-full h-14 text-base gap-3 shadow-soft"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
              />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Googleで始める
              </>
            )}
          </Button>
        </motion.div>

        {/* About Section - Inline */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <h2 className="font-heading text-lg font-bold text-center">
            このアプリについて
          </h2>

          {/* Illustration */}
          <SketchIllustration />

          {/* Story */}
          <div className="space-y-4 text-sm">
            <div className="space-y-3">
              <h3 className="font-heading font-bold text-primary">きっかけ</h3>
              <p className="text-muted-foreground leading-relaxed">
                8月に沖縄旅行に行くとします。2月に飛行機を予約して、カードで支払いました。
              </p>
              <p className="text-muted-foreground leading-relaxed">
                普通の家計簿だと、これは「2月の交通費」として記録されます。でも実際に旅行するのは8月。同じ旅行なのに、費用の計上タイミングがバラバラで、ずっとモヤモヤしていました。
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <CreditCard className="w-4 h-4 text-muted-foreground/50" />
              <div className="h-px flex-1 bg-border" />
            </div>

            <p className="text-muted-foreground leading-relaxed">
              「費用の発生」と「お金の動き」を分けて記録できるアプリがあったらいいなと思い、作ってみることにしました。
            </p>
            <p className="text-foreground leading-relaxed">
              収益/費用の発生タイミングと入出金タイミングを分けて、
              <span className="text-primary font-medium">PL、BS、CF</span>
              で確認できるアプリです。
            </p>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <Sparkles className="w-4 h-4 text-primary/50" />
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <h3 className="font-heading font-bold">できないこと</h3>
              <p className="text-muted-foreground leading-relaxed">
                よくある家計簿アプリにある「口座の自動連携」には対応していません。
                むしろ、自分が使ったお金を丁寧に手入力して、
                <span className="text-foreground font-medium">「家計の財務」を自分で管理したい</span>
                という方に使っていただけたら嬉しいです。
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-secondary/50 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">
              何かあれば
              <a
                href="mailto:moneytracker001@gmail.com"
                className="text-primary hover:underline font-medium mx-1"
              >
                moneytracker001@gmail.com
              </a>
              まで
            </p>
          </div>
        </motion.section>

        {/* How to use link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Link
            href="/how-to-use"
            className="flex items-center justify-center gap-2 text-primary hover:underline font-medium"
          >
            できることを見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="border-t border-border/50 py-6 px-6"
      >
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <Link href="/login" className="hover:text-foreground transition-colors">
            ホーム
          </Link>
          <Link href="/how-to-use" className="hover:text-foreground transition-colors">
            使い方
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            利用規約
          </Link>
          <Link href="/support" className="hover:text-foreground transition-colors">
            サポート
          </Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            料金
          </Link>
        </nav>
        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          © 2025 Money Tracker
        </p>
      </motion.footer>
    </div>
  );
}

// Hand-drawn style illustration component
function SketchIllustration() {
  return (
    <div className="relative bg-gradient-to-br from-secondary/80 to-secondary/40 rounded-xl p-4 border border-border/50 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border-b border-primary/30"
            style={{ marginTop: "20px" }}
          />
        ))}
      </div>

      {/* Main illustration */}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          {/* February */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-lg bg-card border-2 border-dashed border-primary/40 flex flex-col items-center justify-center transform -rotate-2 shadow-sm">
              <Calendar className="w-3 h-3 text-primary/60 mb-0.5" />
              <span className="text-[10px] font-bold text-primary">2月</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">予約・支払</span>
          </motion.div>

          {/* Arrow with plane */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="flex-1 flex items-center justify-center relative mx-2"
          >
            <div className="absolute w-full border-t-2 border-dashed border-primary/30" />
            <motion.div
              animate={{ x: [0, 4, 0], y: [0, -2, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="relative z-10 bg-card p-1.5 rounded-full shadow-md border border-primary/20"
            >
              <Plane className="w-4 h-4 text-primary transform rotate-45" />
            </motion.div>
          </motion.div>

          {/* August */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-lg bg-primary/10 border-2 border-primary flex flex-col items-center justify-center transform rotate-2 shadow-sm">
              <span className="text-base">🏝️</span>
              <span className="text-[10px] font-bold text-primary">8月</span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-1">実際の旅行</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <p className="text-[10px] text-muted-foreground">
            同じ旅行なのに、記録がバラバラ？
          </p>
          <p className="text-xs font-medium text-primary mt-0.5">
            発生日 = 8月 で統一したい！
          </p>
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Shield } from "lucide-react";
import Link from "next/link";
import { AboutModal, AboutTrigger } from "@/components/about/AboutModal";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // 初回訪問時は自動でAboutモーダルを表示
  useEffect(() => {
    const hasSeenAbout = localStorage.getItem("hasSeenAbout");
    if (!hasSeenAbout) {
      // 少し遅延させてアニメーションを自然に
      const timer = setTimeout(() => {
        setIsAboutOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAboutClose = () => {
    setIsAboutOpen(false);
    localStorage.setItem("hasSeenAbout", "true");
  };

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

  const features = [
    { icon: TrendingUp, label: "見える化", bg: "bg-gradient-success" },
    { icon: Users, label: "共有", bg: "bg-gradient-primary" },
    { icon: Shield, label: "安全", bg: "bg-gradient-accent" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 safe-area-top">
      <div className="w-full max-w-5xl">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center md:text-left space-y-6"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative mx-auto h-28 w-28 md:mx-0 md:h-32 md:w-32"
            >
              <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-br from-primary/15 to-accent/20 rotate-6" />
              <div className="absolute inset-1 rounded-[1.9rem] border border-white/70 bg-glass shadow-soft" />
              <div className="absolute inset-2 rounded-[1.6rem] bg-gradient-to-br from-primary to-primary/70 shadow-glow flex items-center justify-center">
                <span className="font-heading text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  MT
                </span>
              </div>
            </motion.div>

            {/* Title */}
            <div className="space-y-3">
              <h1 className="font-heading text-4xl font-extrabold tracking-tight md:text-5xl">
                <span className="text-gradient">Money</span>
                <span className="text-foreground"> Tracker</span>
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl">
                お金の流れを、もっとシンプルに
              </p>
            </div>
          </motion.div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-card/80 rounded-3xl p-8 border border-border/70 shadow-soft backdrop-blur-sm space-y-6"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-destructive/10 text-destructive text-sm p-4 rounded-2xl font-medium"
              >
                {error}
              </motion.div>
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

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-border/60 bg-card/70 shadow-soft backdrop-blur-sm"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${feature.bg} shadow-soft ring-1 ring-white/60`}>
                    <feature.icon className="h-5 w-5 text-white" strokeWidth={1.7} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {feature.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center space-y-3"
        >
          <p className="text-xs text-muted-foreground/70">
            ログインすることで、
            <Link href="/terms" className="underline hover:text-foreground transition-colors">
              利用規約
            </Link>
            に同意したものとみなされます
          </p>
          <AboutTrigger onClick={() => setIsAboutOpen(true)} />
        </motion.div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={handleAboutClose} />
    </div>
  );
}

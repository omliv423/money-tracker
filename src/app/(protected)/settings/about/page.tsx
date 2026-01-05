"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Github, FileText, Mail } from "lucide-react";

const APP_VERSION = "0.1.0";
const BUILD_DATE = "2026-01-04";

export default function AboutPage() {
  const router = useRouter();

  return (
    <MainLayout>
      <div className="space-y-6 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-xl font-bold">アプリについて</h1>
        </div>

        {/* App Info Card */}
        <div className="bg-card rounded-xl p-6 border border-border text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">💰</span>
          </div>
          <h2 className="font-bold text-xl mb-1">Money Tracker</h2>
          <p className="text-sm text-muted-foreground mb-4">
            シンプルな家計簿アプリ
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono font-medium">{APP_VERSION}</span>
          </div>
        </div>

        {/* Version Details */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="flex justify-between items-center p-4">
            <span className="text-sm text-muted-foreground">アプリバージョン</span>
            <span className="font-mono text-sm">{APP_VERSION}</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-sm text-muted-foreground">ビルド日</span>
            <span className="font-mono text-sm">{BUILD_DATE}</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-sm text-muted-foreground">フレームワーク</span>
            <span className="font-mono text-sm">Next.js 16</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-sm text-muted-foreground">データベース</span>
            <span className="font-mono text-sm">Supabase</span>
          </div>
        </div>

        {/* Links */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <Link
            href="/terms"
            className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1">利用規約</span>
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </Link>
          <a
            href="mailto:support@example.com"
            className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
          >
            <Mail className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1">お問い合わせ</span>
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>&copy; 2026 Money Tracker</p>
          <p className="mt-1">Made with Next.js & Supabase</p>
        </div>
      </div>
    </MainLayout>
  );
}

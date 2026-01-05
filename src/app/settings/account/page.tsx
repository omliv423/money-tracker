"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== "退会する") {
      setError("確認テキストが一致しません");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "退会処理に失敗しました");
      }

      // Redirect to login page after successful deletion
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "退会処理に失敗しました");
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-2xl font-bold">アカウント設定</h1>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-card rounded-xl border border-border p-4">
            <h2 className="font-medium mb-2">ログイン中のアカウント</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        )}

        {/* Data Export Reminder */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h3 className="font-medium text-blue-600 mb-2">
            退会前にデータをエクスポート
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            退会するとすべてのデータが削除され、復元できません。
            退会前にデータをエクスポートすることをお勧めします。
          </p>
          <Link
            href="/settings/export"
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            データエクスポートへ →
          </Link>
        </div>

        {/* Delete Account Section */}
        <div className="bg-card rounded-xl border border-destructive/30 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-destructive">退会する</h2>
              <p className="text-sm text-muted-foreground mt-1">
                アカウントと全てのデータを完全に削除します。この操作は取り消せません。
              </p>
            </div>
          </div>

          {!showConfirm ? (
            <Button
              variant="outline"
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setShowConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              退会手続きを開始
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-destructive/5 rounded-lg p-4">
                <h3 className="font-medium text-destructive mb-2">
                  削除されるデータ
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• すべての取引データ</li>
                  <li>• 口座・カテゴリ・相手先</li>
                  <li>• 定期取引・クイック入力</li>
                  <li>• 予算・残高項目</li>
                  <li>• 家計共有設定</li>
                  <li>• サブスクリプション情報</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  確認のため「退会する」と入力してください
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="退会する"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  disabled={isDeleting}
                />
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmText("");
                    setError(null);
                  }}
                  disabled={isDeleting}
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={isDeleting || confirmText !== "退会する"}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      削除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      退会する
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

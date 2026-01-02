"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Users, Check, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

interface InvitationDetails {
  id: string;
  household_id: string;
  invited_email: string | null;
  household: {
    name: string;
  };
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    async function fetchInvitation() {
      if (!token) {
        setError("招待リンクが無効です");
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("household_members")
        .select(`
          id,
          household_id,
          invited_email,
          status,
          household:households(name)
        `)
        .eq("invite_token", token)
        .single();

      if (fetchError || !data) {
        setError("招待リンクが見つかりません");
        setIsLoading(false);
        return;
      }

      if (data.status !== "pending") {
        setError("この招待は既に使用されています");
        setIsLoading(false);
        return;
      }

      setInvitation(data as unknown as InvitationDetails);
      setIsLoading(false);
    }

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!user || !invitation) return;

    setIsProcessing(true);

    const { error: updateError } = await supabase
      .from("household_members")
      .update({
        user_id: user.id,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      setError("参加に失敗しました。もう一度お試しください。");
      setIsProcessing(false);
      return;
    }

    router.push("/settings/household");
  };

  const handleDecline = async () => {
    if (!invitation) return;

    setIsProcessing(true);

    await supabase
      .from("household_members")
      .delete()
      .eq("id", invitation.id);

    router.push("/settings/household");
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
          />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-heading text-xl font-bold">{error}</h1>
          <Button onClick={() => router.push("/settings/household")}>
            設定に戻る
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-bold">ログインが必要です</h1>
          <p className="text-muted-foreground text-center">
            招待を受け入れるにはログインしてください
          </p>
          <Button onClick={() => router.push("/login")}>
            ログイン
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
        <div className="flex flex-col items-center justify-center py-12 space-y-6 md:py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-10 h-10 text-primary" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-bold">
            家計共有への招待
          </h1>
          <p className="text-muted-foreground">
            「{invitation?.household.name}」への参加が招待されています
          </p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border w-full max-w-sm md:max-w-md space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">参加すると...</p>
            <ul className="list-disc list-inside space-y-1">
              <li>口座・残高を共有できます</li>
              <li>取引履歴を確認できます</li>
              <li>一緒に家計管理ができます</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  辞退
                </>
              )}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  参加する
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <MainLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </MainLayout>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

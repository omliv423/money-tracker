"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Check,
  X,
  Copy,
  Loader2,
  Crown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

interface Household {
  id: string;
  name: string;
  owner_id: string;
}

interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  role: string;
  invited_email: string | null;
  invite_token: string | null;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

interface PendingInvitation {
  id: string;
  household_id: string;
  invite_token: string;
  household: {
    name: string;
    owner_id: string;
  };
}

function generateInviteToken() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

export default function HouseholdSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Leave/remove confirmation
  const [confirmAction, setConfirmAction] = useState<{
    type: "leave" | "remove";
    memberId?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    setIsLoading(true);

    // Check if user owns a household
    const { data: ownedHousehold } = await supabase
      .from("households")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (ownedHousehold) {
      setHousehold(ownedHousehold);
      setIsOwner(true);

      // Fetch members
      const { data: householdMembers } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", ownedHousehold.id);

      setMembers(householdMembers || []);
    } else {
      // Check if user is a member of another household
      const { data: membership } = await supabase
        .from("household_members")
        .select(`
          *,
          household:households(*)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (membership && membership.household) {
        setHousehold(membership.household as unknown as Household);
        setIsOwner(false);

        // Fetch all members
        const { data: householdMembers } = await supabase
          .from("household_members")
          .select("*")
          .eq("household_id", membership.household_id);

        setMembers(householdMembers || []);
      }
    }

    // Check for pending invitations for this user's email
    if (user.email) {
      const { data: invitations } = await supabase
        .from("household_members")
        .select(`
          id,
          household_id,
          invite_token,
          household:households(name, owner_id)
        `)
        .eq("invited_email", user.email)
        .eq("status", "pending");

      setPendingInvitations(invitations as unknown as PendingInvitation[] || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateHousehold = async () => {
    if (!user) return;

    setIsProcessing(true);

    const { data, error } = await supabase
      .from("households")
      .insert({
        owner_id: user.id,
        name: "我が家の家計",
      })
      .select()
      .single();

    if (!error && data) {
      setHousehold(data);
      setIsOwner(true);
    }

    setIsProcessing(false);
  };

  const handleInvitePartner = async () => {
    if (!user || !household || !inviteEmail.trim()) return;

    setIsInviting(true);

    const token = generateInviteToken();

    const { error } = await supabase
      .from("household_members")
      .insert({
        household_id: household.id,
        invited_email: inviteEmail.trim().toLowerCase(),
        invite_token: token,
        role: "member",
        status: "pending",
      });

    if (!error) {
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/settings/household/accept?token=${token}`);
      fetchData();
    }

    setIsInviting(false);
  };

  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    if (!user) return;

    setIsProcessing(true);

    const { error } = await supabase
      .from("household_members")
      .update({
        user_id: user.id,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (!error) {
      fetchData();
    }

    setIsProcessing(false);
  };

  const handleDeclineInvitation = async (invitation: PendingInvitation) => {
    setIsProcessing(true);

    await supabase
      .from("household_members")
      .delete()
      .eq("id", invitation.id);

    fetchData();
    setIsProcessing(false);
  };

  const handleLeaveHousehold = async () => {
    if (!user || !household) return;

    setIsProcessing(true);

    await supabase
      .from("household_members")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", user.id);

    setHousehold(null);
    setMembers([]);
    setConfirmAction(null);
    setIsProcessing(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    setIsProcessing(true);

    await supabase
      .from("household_members")
      .delete()
      .eq("id", memberId);

    fetchData();
    setConfirmAction(null);
    setIsProcessing(false);
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold">パートナー共有</h1>
            <p className="text-xs text-muted-foreground">
              家計簿をパートナーと共有
            </p>
          </div>
        </div>

        {/* Pending invitations for this user */}
        {pendingInvitations.length > 0 && (
          <div className="bg-primary/10 rounded-xl p-4 border border-primary/20 space-y-3">
            <h2 className="font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              招待が届いています
            </h2>
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-card rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{invitation.household.name}</p>
                  <p className="text-xs text-muted-foreground">
                    から招待されています
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeclineInvitation(invitation)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvitation(invitation)}
                    disabled={isProcessing}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    参加する
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No household yet */}
        {!household && (
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="font-medium mb-2">まだ家計を共有していません</h2>
            <p className="text-sm text-muted-foreground mb-4">
              パートナーと家計簿を共有するには、まず共有グループを作成してください
            </p>
            <Button onClick={handleCreateHousehold} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              共有グループを作成
            </Button>
          </div>
        )}

        {/* Has household */}
        {household && (
          <>
            {/* Household info */}
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-medium">{household.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {isOwner ? "あなたがオーナーです" : "メンバーとして参加中"}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setInviteEmail("");
                      setInviteLink(null);
                      setShowInviteDialog(true);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    招待
                  </Button>
                )}
              </div>

              {/* Members list */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">メンバー</p>

                {/* Owner */}
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Crown className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isOwner ? "あなた" : "オーナー"}
                      </p>
                      <p className="text-xs text-muted-foreground">オーナー</p>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <AnimatePresence>
                  {members.map((member) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          member.status === "active"
                            ? "bg-green-500/20"
                            : "bg-orange-500/20"
                        }`}>
                          {member.status === "active" ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-orange-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {member.user_id === user?.id
                              ? "あなた"
                              : member.invited_email || "メンバー"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.status === "active" ? "参加中" : "招待中"}
                          </p>
                        </div>
                      </div>
                      {isOwner && member.user_id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmAction({ type: "remove", memberId: member.id })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {!isOwner && member.user_id === user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmAction({ type: "leave" })}
                        >
                          退出
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-secondary/30 rounded-xl p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">共有されるデータ</p>
              <ul className="list-disc list-inside space-y-1">
                <li>口座・残高</li>
                <li>取引履歴</li>
                <li>カテゴリ・予算</li>
                <li>定期取引・クイック入力</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パートナーを招待</DialogTitle>
            <DialogDescription>
              パートナーのメールアドレスを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {!inviteLink ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    メールアドレス
                  </label>
                  <Input
                    type="email"
                    placeholder="partner@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleInvitePartner}
                  disabled={!inviteEmail.trim() || isInviting}
                  className="w-full"
                >
                  {isInviting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  招待リンクを作成
                </Button>
              </>
            ) : (
              <>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">招待リンクが作成されました</p>
                  <p className="text-xs text-muted-foreground">
                    以下のリンクをパートナーに共有してください
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={inviteLink}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setInviteLink(null);
                    setInviteEmail("");
                  }}
                  className="w-full"
                >
                  別のパートナーを招待
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "leave"
                ? "グループから退出しますか？"
                : "メンバーを削除しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "leave"
                ? "退出すると、このグループのデータにアクセスできなくなります。"
                : "このメンバーをグループから削除します。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "leave") {
                  handleLeaveHousehold();
                } else if (confirmAction?.memberId) {
                  handleRemoveMember(confirmAction.memberId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : confirmAction?.type === "leave" ? (
                "退出する"
              ) : (
                "削除する"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

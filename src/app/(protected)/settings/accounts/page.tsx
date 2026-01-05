"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, Wallet, CreditCard, Trash2, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { supabase, type Tables } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

type Account = Tables<"accounts"> & {
  is_shared?: boolean;
  partner_user_id?: string | null;
  partner_name?: string | null;
  default_split_ratio?: number;
};

interface HouseholdMember {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  status: string;
}

const accountTypes = [
  { value: "bank", label: "銀行口座" },
  { value: "card", label: "クレジットカード" },
  { value: "cash", label: "現金" },
  { value: "points", label: "ポイント・電子マネー" },
];

const ownerTypes = [
  { value: "self", label: "自分" },
  { value: "shared", label: "共同" },
];

export default function AccountsSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  // Form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("bank");
  const [newOwner, setNewOwner] = useState("self");
  const [newOpeningBalance, setNewOpeningBalance] = useState("");
  const [newOpeningDate, setNewOpeningDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editOpeningBalance, setEditOpeningBalance] = useState("");
  const [editOpeningDate, setEditOpeningDate] = useState("");
  const [editCurrentBalance, setEditCurrentBalance] = useState("");

  // Shared account settings - new
  const [newIsShared, setNewIsShared] = useState(false);
  const [newPartnerType, setNewPartnerType] = useState<"member" | "manual">("member");
  const [newPartnerUserId, setNewPartnerUserId] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newSplitRatio, setNewSplitRatio] = useState("50");

  // Shared account settings - edit
  const [editIsShared, setEditIsShared] = useState(false);
  const [editPartnerType, setEditPartnerType] = useState<"member" | "manual">("member");
  const [editPartnerUserId, setEditPartnerUserId] = useState("");
  const [editPartnerName, setEditPartnerName] = useState("");
  const [editSplitRatio, setEditSplitRatio] = useState("50");

  // Household members for partner selection
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);

  const fetchAccounts = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("name");

    if (data) {
      setAccounts(data);
    }
    setIsLoading(false);
  };

  const fetchHouseholdMembers = async () => {
    if (!user) return;

    // Get household where user is owner
    const { data: ownedHousehold } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    let householdId = ownedHousehold?.id;

    // If not owner, check if user is a member
    if (!householdId) {
      const { data: membership } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      householdId = membership?.household_id;
    }

    if (householdId) {
      const { data: members } = await supabase
        .from("household_members")
        .select("id, user_id, invited_email, status")
        .eq("household_id", householdId)
        .eq("status", "active")
        .neq("user_id", user.id);

      setHouseholdMembers(members || []);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchHouseholdMembers();
  }, [user]);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    setIsSaving(true);
    const openingBalanceValue = newOpeningBalance ? parseInt(newOpeningBalance) : 0;
    await (supabase as any).from("accounts").insert({
      user_id: user?.id,
      name: newName.trim(),
      type: newType,
      owner: newOwner,
      opening_balance: openingBalanceValue,
      current_balance: openingBalanceValue,
      opening_date: newOpeningDate || null,
      is_shared: newIsShared,
      partner_user_id: newIsShared && newPartnerType === "member" && newPartnerUserId ? newPartnerUserId : null,
      partner_name: newIsShared && newPartnerType === "manual" && newPartnerName ? newPartnerName : null,
      default_split_ratio: newIsShared ? parseInt(newSplitRatio) || 50 : 50,
    });

    setNewName("");
    setNewType("bank");
    setNewOwner("self");
    setNewOpeningBalance("");
    setNewOpeningDate("");
    setNewIsShared(false);
    setNewPartnerType("member");
    setNewPartnerUserId("");
    setNewPartnerName("");
    setNewSplitRatio("50");
    setShowAddDialog(false);
    setIsSaving(false);
    fetchAccounts();
  };

  const handleEdit = (account: Account) => {
    setEditAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditOwner(account.owner);
    setEditOpeningBalance(account.opening_balance?.toString() || "0");
    setEditOpeningDate((account as any).opening_date || "");
    setEditCurrentBalance(account.current_balance?.toString() || "");
    // Shared account settings
    setEditIsShared(account.is_shared || false);
    if (account.partner_user_id) {
      setEditPartnerType("member");
      setEditPartnerUserId(account.partner_user_id);
      setEditPartnerName("");
    } else if (account.partner_name) {
      setEditPartnerType("manual");
      setEditPartnerUserId("");
      setEditPartnerName(account.partner_name);
    } else {
      setEditPartnerType("member");
      setEditPartnerUserId("");
      setEditPartnerName("");
    }
    setEditSplitRatio((account.default_split_ratio ?? 50).toString());
  };

  const handleSaveEdit = async () => {
    if (!editAccount || !editName.trim()) return;

    setIsSaving(true);
    await (supabase as any)
      .from("accounts")
      .update({
        name: editName.trim(),
        type: editType,
        owner: editOwner,
        opening_balance: editOpeningBalance ? parseInt(editOpeningBalance) : 0,
        current_balance: editCurrentBalance !== "" ? parseInt(editCurrentBalance) : null,
        opening_date: editOpeningDate || null,
        is_shared: editIsShared,
        partner_user_id: editIsShared && editPartnerType === "member" && editPartnerUserId ? editPartnerUserId : null,
        partner_name: editIsShared && editPartnerType === "manual" && editPartnerName ? editPartnerName : null,
        default_split_ratio: editIsShared ? parseInt(editSplitRatio) || 50 : 50,
      })
      .eq("id", editAccount.id);

    setEditAccount(null);
    setIsSaving(false);
    fetchAccounts();
  };

  const handleToggleActive = async (account: Account) => {
    await supabase
      .from("accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id);
    fetchAccounts();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    await supabase.from("accounts").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchAccounts();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-xl font-bold">口座管理</h1>
          </div>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Accounts List */}
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors cursor-pointer ${
                  !account.is_active ? "opacity-50" : ""
                }`}
                onClick={() => handleEdit(account)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {account.type === "card" ? (
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Wallet className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {accountTypes.find((t) => t.value === account.type)?.label || account.type}
                        </span>
                        {account.owner === "shared" && (
                          <span className="text-primary">(共同)</span>
                        )}
                        {account.is_shared && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Users className="w-3 h-3" />
                            {account.default_split_ratio}:{100 - (account.default_split_ratio ?? 50)}
                          </span>
                        )}
                      </div>
                      {(account.current_balance ?? 0) !== 0 && (
                        <p className={`text-xs mt-1 ${(account.current_balance ?? 0) < 0 ? "text-destructive" : "text-income"}`}>
                          残高: ¥{account.current_balance?.toLocaleString("ja-JP")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleActive(account)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        account.is_active
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {account.is_active ? "有効" : "無効"}
                    </button>
                    <button
                      onClick={() => setDeleteId(account.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>口座を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto -mx-6 px-6">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">名前</label>
              <Input
                placeholder="例: 楽天銀行"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">種類</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">所有者</label>
              <Select value={newOwner} onValueChange={setNewOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownerTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">初期残高（任意）</label>
              <Input
                type="number"
                placeholder="0"
                value={newOpeningBalance}
                onChange={(e) => setNewOpeningBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">開始日（任意）</label>
              <Input
                type="date"
                value={newOpeningDate}
                onChange={(e) => setNewOpeningDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                この日付より前の取引は残高計算に含まれません
              </p>
            </div>

            {/* 共有口座設定 */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setNewIsShared(!newIsShared)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  newIsShared
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-secondary/50 border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">共有口座として設定</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  newIsShared ? "bg-blue-500" : "bg-muted"
                }`}>
                  <div className={`w-5 h-5 mt-0.5 rounded-full bg-white shadow transition-transform ${
                    newIsShared ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                  }`} />
                </div>
              </button>

              {newIsShared && (
                <div className="mt-3 space-y-3 p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">パートナー</label>
                    <Select
                      value={newPartnerType === "member" ? newPartnerUserId || "select" : "manual"}
                      onValueChange={(value) => {
                        if (value === "manual") {
                          setNewPartnerType("manual");
                          setNewPartnerUserId("");
                        } else if (value !== "select") {
                          setNewPartnerType("member");
                          setNewPartnerUserId(value);
                          setNewPartnerName("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="パートナーを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {householdMembers.length > 0 ? (
                          <>
                            {householdMembers.map((member) => (
                              <SelectItem key={member.id} value={member.user_id || member.id}>
                                {member.invited_email || "パートナー"}
                              </SelectItem>
                            ))}
                            <SelectItem value="manual">その他（手動入力）</SelectItem>
                          </>
                        ) : (
                          <SelectItem value="manual">手動入力</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {newPartnerType === "manual" && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">パートナー名</label>
                      <Input
                        placeholder="例: あさみ"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      自分の負担比率: {newSplitRatio}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={newSplitRatio}
                      onChange={(e) => setNewSplitRatio(e.target.value)}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>自分: {newSplitRatio}%</span>
                      <span>パートナー: {100 - parseInt(newSplitRatio)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : "追加する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAccount} onOpenChange={() => setEditAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>口座を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto -mx-6 px-6">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">名前</label>
              <Input
                placeholder="例: 楽天銀行"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">種類</label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">所有者</label>
              <Select value={editOwner} onValueChange={setEditOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownerTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">初期残高</label>
              <Input
                type="number"
                placeholder="0"
                value={editOpeningBalance}
                onChange={(e) => setEditOpeningBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">開始日</label>
              <Input
                type="date"
                value={editOpeningDate}
                onChange={(e) => setEditOpeningDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                この日付より前の取引は残高計算に含まれません
              </p>
            </div>
            {/* 現在残高 */}
            <div className="border-t border-border pt-4">
              <label className="text-sm text-muted-foreground mb-1 block">現在残高</label>
              <Input
                type="number"
                placeholder="0"
                value={editCurrentBalance}
                onChange={(e) => setEditCurrentBalance(e.target.value)}
                className={parseInt(editCurrentBalance || "0") < 0 ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground mt-1">
                消し込みで自動更新。手動で修正も可能
              </p>
            </div>

            {/* 共有口座設定 */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setEditIsShared(!editIsShared)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  editIsShared
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-secondary/50 border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">共有口座として設定</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  editIsShared ? "bg-blue-500" : "bg-muted"
                }`}>
                  <div className={`w-5 h-5 mt-0.5 rounded-full bg-white shadow transition-transform ${
                    editIsShared ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                  }`} />
                </div>
              </button>

              {editIsShared && (
                <div className="mt-3 space-y-3 p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">パートナー</label>
                    <Select
                      value={editPartnerType === "member" ? editPartnerUserId || "select" : "manual"}
                      onValueChange={(value) => {
                        if (value === "manual") {
                          setEditPartnerType("manual");
                          setEditPartnerUserId("");
                        } else if (value !== "select") {
                          setEditPartnerType("member");
                          setEditPartnerUserId(value);
                          setEditPartnerName("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="パートナーを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {householdMembers.length > 0 ? (
                          <>
                            {householdMembers.map((member) => (
                              <SelectItem key={member.id} value={member.user_id || member.id}>
                                {member.invited_email || "パートナー"}
                              </SelectItem>
                            ))}
                            <SelectItem value="manual">その他（手動入力）</SelectItem>
                          </>
                        ) : (
                          <SelectItem value="manual">手動入力</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {editPartnerType === "manual" && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">パートナー名</label>
                      <Input
                        placeholder="例: あさみ"
                        value={editPartnerName}
                        onChange={(e) => setEditPartnerName(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      自分の負担比率: {editSplitRatio}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editSplitRatio}
                      onChange={(e) => setEditSplitRatio(e.target.value)}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>自分: {editSplitRatio}%</span>
                      <span>パートナー: {100 - parseInt(editSplitRatio)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>口座を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この口座を使用している取引がある場合、削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

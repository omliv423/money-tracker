"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Trash2, Building, Car, Landmark, PiggyBank, CreditCard, Wallet, Users } from "lucide-react";
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

type BalanceItem = Tables<"balance_items">;
type Account = Tables<"accounts">;

interface CashBalance {
  accountId: string;
  accountName: string;
  balance: number;
}

interface PayableBalance {
  accountId: string;
  accountName: string;
  totalAmount: number;
}

interface CounterpartyBalance {
  counterparty: string;
  amount: number;
}

const itemTypes = [
  { value: "asset", label: "資産" },
  { value: "liability", label: "負債" },
];

const assetCategories = [
  { value: "investment", label: "投資（株・投信）", icon: TrendingUp },
  { value: "real_estate", label: "不動産", icon: Building },
  { value: "vehicle", label: "車・バイク", icon: Car },
  { value: "savings", label: "貯蓄性保険", icon: PiggyBank },
  { value: "other_asset", label: "その他資産", icon: Landmark },
];

const liabilityCategories = [
  { value: "mortgage", label: "住宅ローン", icon: Building },
  { value: "car_loan", label: "カーローン", icon: Car },
  { value: "education_loan", label: "教育ローン", icon: Landmark },
  { value: "credit", label: "クレジット残債", icon: CreditCard },
  { value: "other_liability", label: "その他負債", icon: TrendingDown },
];

const getCategoryIcon = (category: string | null) => {
  const allCategories = [...assetCategories, ...liabilityCategories];
  const found = allCategories.find(c => c.value === category);
  return found?.icon || Landmark;
};

const getCategoryLabel = (category: string | null) => {
  const allCategories = [...assetCategories, ...liabilityCategories];
  const found = allCategories.find(c => c.value === category);
  return found?.label || category || "未分類";
};

export default function BalanceItemsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<BalanceItem[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [payables, setPayables] = useState<PayableBalance[]>([]);
  const [receivables, setReceivables] = useState<CounterpartyBalance[]>([]);
  const [borrowings, setBorrowings] = useState<CounterpartyBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<BalanceItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("asset");
  const [formCategory, setFormCategory] = useState("");
  const [formBalance, setFormBalance] = useState("");
  const [formBalanceDate, setFormBalanceDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 借入/立替の新規作成用
  const [showCounterpartyDialog, setShowCounterpartyDialog] = useState(false);
  const [counterpartyType, setCounterpartyType] = useState<"asset" | "liability">("liability");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyAmount, setCounterpartyAmount] = useState("");
  const [counterpartyDate, setCounterpartyDate] = useState("");

  const fetchItems = async () => {
    setIsLoading(true);

    // Fetch balance_items
    const { data } = await supabase
      .from("balance_items")
      .select("*")
      .order("item_type")
      .order("name");

    if (data) {
      setItems(data);
    }

    // Fetch accounts with opening_balance (現預金)
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true);

    if (accounts) {
      setAllAccounts(accounts);
      const cashList = accounts
        .filter((acc) => acc.opening_balance && acc.opening_balance !== 0)
        .map((acc) => ({
          accountId: acc.id,
          accountName: acc.name,
          balance: acc.opening_balance || 0,
        }));
      setCashBalances(cashList);
    }

    // Fetch unpaid transactions (未払金)
    const { data: unpaidTx } = await supabase
      .from("transactions")
      .select(`
        id, total_amount, settled_amount, account_id,
        account:accounts!transactions_account_id_fkey(id, name),
        transaction_lines(amount, line_type)
      `)
      .eq("is_cash_settled", false);

    const payableMap = new Map<string, PayableBalance>();
    (unpaidTx || []).forEach((tx: any) => {
      if (!tx.account) return;
      let totalOutflow = 0;
      let totalInflow = 0;
      (tx.transaction_lines || []).forEach((line: any) => {
        if (line.line_type === "income" || line.line_type === "liability") {
          totalInflow += line.amount;
        } else {
          totalOutflow += line.amount;
        }
      });
      if (totalOutflow > totalInflow) {
        const remaining = tx.total_amount - (tx.settled_amount || 0);
        if (remaining > 0) {
          const existing = payableMap.get(tx.account.id);
          if (existing) {
            existing.totalAmount += remaining;
          } else {
            payableMap.set(tx.account.id, {
              accountId: tx.account.id,
              accountName: tx.account.name,
              totalAmount: remaining,
            });
          }
        }
      }
    });
    setPayables(Array.from(payableMap.values()));

    // Fetch unsettled receivables/liabilities (立替金・借入金)
    const { data: lines } = await supabase
      .from("transaction_lines")
      .select("amount, line_type, counterparty, is_settled, settled_amount")
      .not("counterparty", "is", null);

    const receivableMap = new Map<string, number>();
    const borrowingMap = new Map<string, number>();

    (lines || []).forEach((line) => {
      if (!line.counterparty) return;
      const settledAmount = line.settled_amount ?? 0;
      const unsettled = line.is_settled && settledAmount === 0 ? 0 : line.amount - settledAmount;
      if (unsettled <= 0) return;

      if (line.line_type === "asset") {
        receivableMap.set(line.counterparty, (receivableMap.get(line.counterparty) || 0) + unsettled);
      } else if (line.line_type === "liability") {
        borrowingMap.set(line.counterparty, (borrowingMap.get(line.counterparty) || 0) + unsettled);
      }
    });

    setReceivables(Array.from(receivableMap.entries()).map(([counterparty, amount]) => ({ counterparty, amount })));
    setBorrowings(Array.from(borrowingMap.entries()).map(([counterparty, amount]) => ({ counterparty, amount })));

    setIsLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormType("asset");
    setFormCategory("");
    setFormBalance("");
    setFormBalanceDate("");
    setFormNote("");
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formBalance) return;

    setIsSaving(true);
    await supabase.from("balance_items").insert({
      user_id: user?.id,
      name: formName.trim(),
      item_type: formType,
      category: formCategory || null,
      balance: parseInt(formBalance),
      balance_date: formBalanceDate || null,
      note: formNote || null,
    });

    resetForm();
    setShowAddDialog(false);
    setIsSaving(false);
    fetchItems();
  };

  const handleEdit = (item: BalanceItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormType(item.item_type);
    setFormCategory(item.category || "");
    setFormBalance(item.balance.toString());
    setFormBalanceDate(item.balance_date || "");
    setFormNote(item.note || "");
  };

  const handleSaveEdit = async () => {
    if (!editItem || !formName.trim() || !formBalance) return;

    setIsSaving(true);
    await supabase
      .from("balance_items")
      .update({
        name: formName.trim(),
        item_type: formType,
        category: formCategory || null,
        balance: parseInt(formBalance),
        balance_date: formBalanceDate || null,
        note: formNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editItem.id);

    resetForm();
    setEditItem(null);
    setIsSaving(false);
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    await supabase.from("balance_items").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchItems();
  };

  // 借入/立替の新規作成
  const handleAddCounterparty = async () => {
    if (!counterpartyName.trim() || !counterpartyAmount) return;

    setIsSaving(true);

    try {
      const amount = parseInt(counterpartyAmount);
      const date = counterpartyDate || new Date().toISOString().split("T")[0];

      // 最初の口座を使用（期首残高調整用なので任意の口座でOK）
      const defaultAccountId = allAccounts[0]?.id;
      if (!defaultAccountId) {
        throw new Error("口座が登録されていません");
      }

      // 取引を作成
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user?.id,
          date: date,
          description: counterpartyType === "liability"
            ? `${counterpartyName}からの借入金（期首残高）`
            : `${counterpartyName}への立替金（期首残高）`,
          total_amount: amount,
          account_id: defaultAccountId,
          is_cash_settled: false,
        })
        .select()
        .single();

      if (txError) throw txError;

      // 汎用カテゴリを取得
      const categoryType = counterpartyType === "liability" ? "income" : "expense";
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("type", categoryType)
        .ilike("name", "%その他%")
        .limit(1)
        .single();

      // 明細行を作成
      await supabase.from("transaction_lines").insert({
        transaction_id: tx.id,
        amount: amount,
        line_type: counterpartyType,
        counterparty: counterpartyName.trim(),
        category_id: category?.id,
        is_settled: false,
      });

      // フォームリセット
      setCounterpartyName("");
      setCounterpartyAmount("");
      setCounterpartyDate("");
      setShowCounterpartyDialog(false);
      fetchItems();
    } catch (error) {
      console.error("Error creating counterparty balance:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const assets = items.filter(i => i.item_type === "asset" && i.is_active);
  const liabilities = items.filter(i => i.item_type === "liability" && i.is_active);
  const totalAssets = assets.reduce((sum, i) => sum + i.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, i) => sum + i.balance, 0);

  const categories = formType === "asset" ? assetCategories : liabilityCategories;

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

  const FormContent = () => (
    <div className="space-y-4 pt-4">
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">種類</label>
        <Select value={formType} onValueChange={(v) => { setFormType(v); setFormCategory(""); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itemTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">名前</label>
        <Input
          placeholder="例: 住宅ローン、投資信託"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">カテゴリ</label>
        <Select value={formCategory} onValueChange={setFormCategory}>
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          残高（{formType === "asset" ? "資産額" : "借入残高"}）
        </label>
        <Input
          type="number"
          placeholder="0"
          value={formBalance}
          onChange={(e) => setFormBalance(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">残高基準日</label>
        <Input
          type="date"
          value={formBalanceDate}
          onChange={(e) => setFormBalanceDate(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">メモ（任意）</label>
        <Input
          placeholder="メモ"
          value={formNote}
          onChange={(e) => setFormNote(e.target.value)}
        />
      </div>
    </div>
  );

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
            <h1 className="font-heading text-xl font-bold">資産・負債</h1>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          投資や住宅ローンなど、日常取引以外の資産・負債を登録できます。
          ここで登録した内容はBS（貸借対照表）に反映されます。
        </p>

        {/* 現預金（口座残高） */}
        {cashBalances.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-income" />
              現預金（口座残高）
            </h2>
            <div className="space-y-2">
              {cashBalances.map((cash, index) => (
                <motion.div
                  key={cash.accountId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-income" />
                      <div>
                        <p className="font-medium">{cash.accountName}</p>
                        <p className="text-xs text-muted-foreground">口座管理で編集</p>
                      </div>
                    </div>
                    <span className="font-heading font-bold tabular-nums text-income">
                      ¥{cash.balance.toLocaleString("ja-JP")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 立替金（資産） */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-income" />
              立替金
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCounterpartyType("asset");
                setCounterpartyName("");
                setCounterpartyAmount("");
                setCounterpartyDate("");
                setShowCounterpartyDialog(true);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              追加
            </Button>
          </div>
          {receivables.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              立替金なし
            </p>
          ) : (
            <div className="space-y-2">
              {receivables.map((item, index) => (
                <motion.div
                  key={item.counterparty}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-income" />
                      <div>
                        <p className="font-medium">{item.counterparty}</p>
                        <p className="text-xs text-muted-foreground">立替・精算で精算</p>
                      </div>
                    </div>
                    <span className="font-heading font-bold tabular-nums text-income">
                      ¥{item.amount.toLocaleString("ja-JP")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* その他資産（追加登録） */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-income" />
            その他資産
          </h2>
          {assets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              投資や不動産等の資産登録なし
            </p>
          ) : (
            <div className="space-y-2">
              {assets.map((item, index) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleEdit(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-income" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(item.category)}
                            {item.balance_date && ` (${item.balance_date})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="font-heading font-bold tabular-nums text-income">
                          ¥{item.balance.toLocaleString("ja-JP")}
                        </span>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* 未払金（負債） */}
        {payables.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-expense" />
              未払金
            </h2>
            <div className="space-y-2">
              {payables.map((item, index) => (
                <motion.div
                  key={item.accountId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-expense" />
                      <div>
                        <p className="font-medium">{item.accountName}</p>
                        <p className="text-xs text-muted-foreground">入出金消し込みで精算</p>
                      </div>
                    </div>
                    <span className="font-heading font-bold tabular-nums text-expense">
                      ¥{item.totalAmount.toLocaleString("ja-JP")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 借入金（負債） */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-expense" />
              借入金
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCounterpartyType("liability");
                setCounterpartyName("");
                setCounterpartyAmount("");
                setCounterpartyDate("");
                setShowCounterpartyDialog(true);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              追加
            </Button>
          </div>
          {borrowings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              借入金なし
            </p>
          ) : (
            <div className="space-y-2">
              {borrowings.map((item, index) => (
                <motion.div
                  key={item.counterparty}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-expense" />
                      <div>
                        <p className="font-medium">{item.counterparty}</p>
                        <p className="text-xs text-muted-foreground">立替・精算で返済</p>
                      </div>
                    </div>
                    <span className="font-heading font-bold tabular-nums text-expense">
                      ¥{item.amount.toLocaleString("ja-JP")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* その他負債（追加登録） */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-expense" />
            その他負債
          </h2>
          {liabilities.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm bg-card rounded-xl border border-border">
              住宅ローン等の負債登録なし
            </p>
          ) : (
            <div className="space-y-2">
              {liabilities.map((item, index) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleEdit(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-expense" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getCategoryLabel(item.category)}
                            {item.balance_date && ` (${item.balance_date})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="font-heading font-bold tabular-nums text-expense">
                          ¥{item.balance.toLocaleString("ja-JP")}
                        </span>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>資産・負債を追加</DialogTitle>
          </DialogHeader>
          <FormContent />
          <Button
            onClick={handleAdd}
            disabled={!formName.trim() || !formBalance || isSaving}
            className="w-full mt-4"
          >
            {isSaving ? "保存中..." : "追加する"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>資産・負債を編集</DialogTitle>
          </DialogHeader>
          <FormContent />
          <Button
            onClick={handleSaveEdit}
            disabled={!formName.trim() || !formBalance || isSaving}
            className="w-full mt-4"
          >
            {isSaving ? "保存中..." : "保存する"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
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

      {/* Counterparty Dialog (借入/立替) */}
      <Dialog open={showCounterpartyDialog} onOpenChange={setShowCounterpartyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {counterpartyType === "liability" ? "借入金を追加" : "立替金を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                {counterpartyType === "liability" ? "借入元" : "立替先"}
              </label>
              <Input
                placeholder={counterpartyType === "liability" ? "例: よしこねえちゃん" : "例: 越川"}
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                {counterpartyType === "liability" ? "借入残高" : "立替残高"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={counterpartyAmount}
                  onChange={(e) => setCounterpartyAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                基準日（任意）
              </label>
              <Input
                type="date"
                value={counterpartyDate}
                onChange={(e) => setCounterpartyDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                過去の借入/立替の場合、その時点の日付を入力してください
              </p>
            </div>
          </div>
          <Button
            onClick={handleAddCounterparty}
            disabled={!counterpartyName.trim() || !counterpartyAmount || isSaving}
            className="w-full mt-4"
          >
            {isSaving ? "保存中..." : "追加する"}
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

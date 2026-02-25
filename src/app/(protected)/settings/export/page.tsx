"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ExportPage() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportComplete(false);

    try {
      const supabase = createClient();

      // Fetch transactions with related data
      const { data: transactions, error: fetchError } = await supabase
        .from("transactions")
        .select(`
          id,
          date,
          payment_date,
          description,
          total_amount,
          is_cash_settled,
          created_at,
          account_id,
          counterparties(name),
          transaction_lines(
            amount,
            line_type,
            note,
            counterparty,
            categories(name, type)
          )
        `)
        .eq("user_id", user?.id ?? "")
        .order("date", { ascending: false });

      // Fetch accounts separately to avoid relationship ambiguity
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("user_id", user?.id ?? "");

      const accountMap = new Map(accounts?.map(a => [a.id, a.name]) || []);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!transactions || transactions.length === 0) {
        setError("エクスポートするデータがありません");
        setIsExporting(false);
        return;
      }

      // Flatten data for CSV
      const rows: string[][] = [];

      // Header row
      rows.push([
        "取引日",
        "支払日",
        "説明",
        "口座",
        "相手先",
        "カテゴリ",
        "種別",
        "金額",
        "明細メモ",
        "消し込み済み",
        "作成日時",
      ]);

      // Data rows
      for (const tx of transactions) {
        const accountName = accountMap.get(tx.account_id) || "";
        const counterparty = tx.counterparties as { name: string } | null;
        const lines = tx.transaction_lines as Array<{
          amount: number;
          line_type: string;
          note: string | null;
          counterparty: string | null;
          categories: { name: string; type: string } | null;
        }>;

        if (lines && lines.length > 0) {
          for (const line of lines) {
            const lineTypeMap: Record<string, string> = {
              income: "収入",
              expense: "支出",
              advance: "立替",
              loan: "借入",
              asset: "資産",
              liability: "負債",
            };
            const lineType = lineTypeMap[line.line_type] || line.line_type;
            const category = line.categories?.name || "";

            rows.push([
              tx.date,
              tx.payment_date || "",
              tx.description,
              accountName,
              counterparty?.name || line.counterparty || "",
              category,
              lineType,
              String(line.amount),
              line.note || "",
              tx.is_cash_settled ? "済" : "",
              tx.created_at.split("T")[0],
            ]);
          }
        } else {
          // Transaction without lines
          rows.push([
            tx.date,
            tx.payment_date || "",
            tx.description,
            accountName,
            counterparty?.name || "",
            "",
            "",
            String(tx.total_amount),
            "",
            tx.is_cash_settled ? "済" : "",
            tx.created_at.split("T")[0],
          ]);
        }
      }

      // Helper to escape CSV values and prevent formula injection
      const escapeCSV = (value: string): string => {
        let cell = String(value);

        // Prevent CSV formula injection (values starting with =, +, -, @, tab, or carriage return)
        if (/^[=+\-@\t\r]/.test(cell)) {
          cell = "'" + cell;
        }

        // Escape quotes
        const escaped = cell.replace(/"/g, '""');

        // Wrap in quotes if contains comma, newline, or quotes
        if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"') || escaped !== cell) {
          return `"${escaped}"`;
        }
        return escaped;
      };

      // Convert to CSV
      const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\n");

      // Add BOM for Excel compatibility with Japanese
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `money-tracker-transactions-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportComplete(true);
    } catch (err) {
      console.error("Export error:", err);
      setError(err instanceof Error ? err.message : "エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
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
          <h1 className="font-heading text-2xl font-bold">データエクスポート</h1>
        </div>

        {/* Export Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg mb-1">取引データをエクスポート</h2>
              <p className="text-sm text-muted-foreground">
                すべての取引データをCSV形式でダウンロードします。
                Excelやスプレッドシートで開くことができます。
              </p>
            </div>
          </div>

          {/* Export Info */}
          <div className="bg-secondary/50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-sm mb-2">エクスポートされる項目</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 取引日、支払日</li>
              <li>• 説明、口座、相手先</li>
              <li>• カテゴリ、種別（収入/支出/立替/借入/資産/負債）</li>
              <li>• 金額、メモ</li>
              <li>• 消し込み済みフラグ、作成日</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {exportComplete && (
            <div className="bg-green-500/10 text-green-600 rounded-lg p-4 mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm">エクスポートが完了しました</p>
            </div>
          )}

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                エクスポート中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                CSVをダウンロード
              </>
            )}
          </Button>
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground text-center">
          エクスポートしたデータはお使いの端末にダウンロードされます。
        </p>
      </div>
    </MainLayout>
  );
}

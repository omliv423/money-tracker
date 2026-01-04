"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  PlusCircle,
  Wallet,
  Tag,
  BarChart3,
  RefreshCw,
  Users,
  Zap,
  ArrowLeftRight,
  CreditCard,
  HelpCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  items: {
    question: string;
    answer: string;
  }[];
}

const helpSections: HelpSection[] = [
  {
    id: "basics",
    title: "基本的な使い方",
    icon: HelpCircle,
    items: [
      {
        question: "取引を記録するには？",
        answer:
          "ホーム画面で、収入か支出を選び、金額とカテゴリを入力して「記録」ボタンを押します。メモや日付も追加できます。",
      },
      {
        question: "取引を修正・削除するには？",
        answer:
          "取引一覧から修正したい取引をタップすると、編集画面が開きます。右上の削除ボタンで削除もできます。",
      },
      {
        question: "資金移動とは？",
        answer:
          "銀行口座からクレジットカードの引き落とし口座への移動など、自分の口座間でお金を移動する時に使います。ホーム画面の「資金移動」から記録できます。",
      },
    ],
  },
  {
    id: "accounts",
    title: "口座管理",
    icon: Wallet,
    items: [
      {
        question: "口座を追加するには？",
        answer:
          "設定 → 口座管理 → 「追加」ボタンから、銀行口座やクレジットカード、現金、電子マネーを追加できます。",
      },
      {
        question: "口座の残高を修正するには？",
        answer:
          "設定 → 口座管理から口座を選択し、開始残高を変更できます。取引を記録すると自動的に残高が更新されます。",
      },
      {
        question: "クレジットカードの使い方は？",
        answer:
          "支出を記録する際に口座をクレジットカードにします。引き落とし時に「入出金消し込み」で銀行口座から引き落としを記録します。",
      },
    ],
  },
  {
    id: "categories",
    title: "カテゴリ",
    icon: Tag,
    items: [
      {
        question: "カテゴリを追加するには？",
        answer:
          "設定 → カテゴリ管理 → 「追加」ボタンから、収入用・支出用のカテゴリを追加できます。親カテゴリを設定して階層化も可能です。",
      },
      {
        question: "カテゴリを削除できますか？",
        answer:
          "使用中のカテゴリは削除できません。そのカテゴリを使っている取引を先に修正してください。",
      },
    ],
  },
  {
    id: "recurring",
    title: "定期取引",
    icon: RefreshCw,
    items: [
      {
        question: "定期取引とは？",
        answer:
          "毎月の家賃や給料など、定期的に発生する取引をテンプレートとして登録できます。ワンタップで記録できるようになります。",
      },
      {
        question: "定期取引を登録するには？",
        answer:
          "設定 → 定期取引 → 「追加」ボタンから登録します。毎月の支払日も設定できます。",
      },
      {
        question: "定期取引から記録するには？",
        answer:
          "ホーム画面の「今月の定期取引」セクションから、記録したい項目の「記録」ボタンを押すだけです。",
      },
    ],
  },
  {
    id: "quick",
    title: "クイック入力",
    icon: Zap,
    items: [
      {
        question: "クイック入力とは？",
        answer:
          "コンビニでの買い物など、よく発生する取引パターンを登録しておくと、ワンタップで記録できます。",
      },
      {
        question: "クイック入力を登録するには？",
        answer:
          "設定 → クイック入力 → 「追加」ボタンから、取引名・金額・カテゴリを登録します。",
      },
    ],
  },
  {
    id: "reports",
    title: "レポート",
    icon: BarChart3,
    items: [
      {
        question: "レポートで何が見れますか？",
        answer:
          "月別の収支サマリー、カテゴリ別の支出内訳、キャッシュフロー（現金の流れ）、貸借対照表（資産・負債）などが確認できます。",
      },
      {
        question: "過去のデータを見るには？",
        answer: "レポート画面で月を切り替えることで、過去のデータも確認できます。",
      },
    ],
  },
  {
    id: "sharing",
    title: "パートナー共有",
    icon: Users,
    items: [
      {
        question: "パートナーと共有するには？",
        answer:
          "設定 → パートナー共有 → 「グループを作成」でグループを作り、パートナーを招待します。パートナーはGoogleログイン後に招待を承認すると共有が開始されます。",
      },
      {
        question: "共有すると何が見えますか？",
        answer:
          "口座、取引、カテゴリなど、すべてのデータがパートナーと共有されます。どちらからでも編集可能です。",
      },
    ],
  },
  {
    id: "settlements",
    title: "入出金消し込み",
    icon: CreditCard,
    items: [
      {
        question: "入出金消し込みとは？",
        answer:
          "クレジットカードの引き落としや、立替金の精算時に使います。未消し込みの取引を選んで、実際に入出金があったことを記録します。",
      },
      {
        question: "どうやって使いますか？",
        answer:
          "設定 → 入出金消し込み から、未消し込みの取引を選択し、引き落とし元の口座を指定して消し込みを行います。",
      },
    ],
  },
];

export default function HelpPage() {
  const router = useRouter();
  const { resetTour } = useTour();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleStartTour = () => {
    resetTour();
    router.push("/");
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-bold">使い方ガイド</h1>
            <p className="text-xs text-muted-foreground">
              アプリの使い方を確認できます
            </p>
          </div>
        </div>

        {/* Restart Tour Button */}
        <Button
          variant="outline"
          onClick={handleStartTour}
          className="w-full gap-2"
        >
          <PlayCircle className="w-4 h-4" />
          ツアーをもう一度見る
        </Button>

        {/* Help Sections */}
        <div className="space-y-3">
          {helpSections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;

            return (
              <div
                key={section.id}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedSection(isExpanded ? null : section.id)
                  }
                  className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-secondary">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-left font-medium">
                    {section.title}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {section.items.map((item, idx) => {
                          const itemKey = `${section.id}-${idx}`;
                          const isItemExpanded = expandedItem === itemKey;

                          return (
                            <div
                              key={idx}
                              className="bg-secondary/50 rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() =>
                                  setExpandedItem(
                                    isItemExpanded ? null : itemKey
                                  )
                                }
                                className="w-full flex items-center gap-2 p-3 text-left hover:bg-secondary transition-colors"
                              >
                                <span className="flex-1 text-sm font-medium">
                                  {item.question}
                                </span>
                                <ChevronRight
                                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                                    isItemExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                              <AnimatePresence>
                                {isItemExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="px-3 pb-3 text-sm text-muted-foreground">
                                      {item.answer}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}

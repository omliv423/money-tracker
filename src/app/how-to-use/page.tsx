"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Receipt,
  PieChart,
  Wallet,
  TrendingUp,
  Users,
  CalendarClock,
  Zap,
  ArrowLeft,
  CreditCard,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HowToUsePage() {
  return (
    <div className="min-h-screen flex flex-col safe-area-top">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/login"
            className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-lg font-bold">使い方</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
            Money Trackerでできること
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            「費用の発生」と「お金の動き」を分けて記録できる、
            <br className="hidden sm:block" />
            ちょっと本格的な家計簿アプリです。
          </p>
        </motion.section>

        {/* Section: このサービスについて */}
        <Section delay={0.1}>
          <SectionHeader
            icon={Sparkles}
            title="このサービスについて"
            color="text-primary"
            bg="bg-primary/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Money Trackerは、家計を<strong className="text-foreground">PL（損益計算書）・BS（貸借対照表）・CF（キャッシュフロー）</strong>で管理できるアプリです。
            </p>
            <p>
              普通の家計簿では、クレジットカードで払った瞬間に「支出」として記録されます。でも実際の引き落としは翌月。この「発生」と「支払い」のズレが気になる方のために作りました。
            </p>
            <p>
              例えば、8月の沖縄旅行の飛行機代を2月にカードで予約した場合。Money Trackerでは「発生日=8月、支払日=3月（カード引き落とし日）」のように分けて記録できます。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: 取引を記録 */}
        <Section delay={0.15}>
          <SectionHeader
            icon={Receipt}
            title="取引を記録する"
            color="text-blue-500"
            bg="bg-blue-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              日々の収入・支出を記録します。シンプルな入力フォームで、必要な情報だけをサッと入力できます。
            </p>
            <FeatureList
              items={[
                "日付、金額、カテゴリ、口座を選んで記録",
                "発生日と支払日を分けて登録可能",
                "メモを残して後から振り返り",
                "按分機能で1つの支出を複数カテゴリに分割",
              ]}
            />
            <p>
              入力した取引は一覧で確認でき、後から編集・削除もできます。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: PL */}
        <Section delay={0.2}>
          <SectionHeader
            icon={PieChart}
            title="PL（損益計算書）"
            color="text-green-500"
            bg="bg-green-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              月ごとの収入と支出を一覧で確認できます。「今月いくら使ったか」「何にお金を使っているか」が一目でわかります。
            </p>
            <FeatureList
              items={[
                "月別の収入・支出・収支を表示",
                "カテゴリ別の内訳をグラフで可視化",
                "前月比・前年同月比で傾向を把握",
                "発生日ベースで正確な月次損益を計算",
              ]}
            />
            <p>
              企業の決算書でいう「損益計算書」と同じ考え方。家計の「稼ぐ力」と「使い方」がわかります。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: BS */}
        <Section delay={0.25}>
          <SectionHeader
            icon={Wallet}
            title="BS（貸借対照表）"
            color="text-purple-500"
            bg="bg-purple-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              資産・負債・純資産の現在残高を確認できます。「今いくら持っているか」「借金はいくらあるか」が把握できます。
            </p>
            <FeatureList
              items={[
                "銀行口座、現金、電子マネーなどの資産",
                "クレジットカードの未払い残高（負債）",
                "投資・ポイントなども管理可能",
                "純資産（資産 − 負債）で家計の健全性を確認",
              ]}
            />
            <p>
              月末時点の残高推移も見られるので、資産が増えているか減っているかの傾向もわかります。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: CF */}
        <Section delay={0.3}>
          <SectionHeader
            icon={TrendingUp}
            title="CF（キャッシュフロー）"
            color="text-orange-500"
            bg="bg-orange-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              実際のお金の動きを追跡します。PLは「発生」ベースですが、CFは「支払い」ベース。現金がいつ入っていつ出ていくかがわかります。
            </p>
            <FeatureList
              items={[
                "収入・支出の入出金タイミングを可視化",
                "クレジットカードの引き落とし予定を確認",
                "精算（立替金の受け渡し）も反映",
                "月ごとのキャッシュ増減を把握",
              ]}
            />
            <p>
              「お金はあるはずなのに足りない」という事態を防ぐために、現金の動きを把握しましょう。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: パートナー共有 */}
        <Section delay={0.35}>
          <SectionHeader
            icon={Users}
            title="パートナーと共有"
            color="text-pink-500"
            bg="bg-pink-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              家族やパートナーと家計を共有できます。同じデータを見ながら、一緒に家計を管理しましょう。
            </p>
            <FeatureList
              items={[
                "招待リンクを送るだけで簡単に共有",
                "お互いの取引を確認・編集可能",
                "共有口座の管理もスムーズ",
                "立替金の精算機能で「誰がいくら払ったか」を管理",
              ]}
            />
            <p>
              共有しても、それぞれのスマホからアクセスできます。お金の話がしやすくなります。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: 定期取引 */}
        <Section delay={0.4}>
          <SectionHeader
            icon={CalendarClock}
            title="定期取引"
            color="text-cyan-500"
            bg="bg-cyan-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              毎月の固定費を登録しておけば、ワンタップで記録できます。記録忘れを防ぎます。
            </p>
            <FeatureList
              items={[
                "家賃、光熱費、サブスクなどを事前登録",
                "毎月の発生日・支払日を設定可能",
                "ホーム画面に「今日の定期取引」を表示",
                "タップするだけで取引を作成",
              ]}
            />
            <p>
              毎月同じ金額の支出は、定期取引に登録しておくと便利です。
            </p>
          </div>
        </Section>

        <Divider />

        {/* Section: クイック入力 */}
        <Section delay={0.45}>
          <SectionHeader
            icon={Zap}
            title="クイック入力"
            color="text-yellow-500"
            bg="bg-yellow-500/10"
          />
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              よく使う取引をテンプレートとして保存。日常の支出をサッと記録できます。
            </p>
            <FeatureList
              items={[
                "コンビニ、カフェ、ランチなどを事前登録",
                "金額は都度入力、それ以外は自動入力",
                "使用頻度順に並び替え",
                "ホーム画面からワンタップで呼び出し",
              ]}
            />
            <p>
              「毎日買うコーヒー」「週末のスーパー」など、パターン化された支出に便利です。
            </p>
          </div>
        </Section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 bg-primary text-primary-foreground rounded-xl font-medium shadow-soft hover:opacity-90 transition-opacity"
          >
            無料で始める
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Googleアカウントで簡単登録・基本機能は無料
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Section({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="py-2"
    >
      {children}
    </motion.section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  color,
  bg,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}
      >
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <h3 className="font-heading text-lg font-bold">{title}</h3>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-primary mt-1.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 py-8">
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-6 px-6">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <Link href="/login" className="hover:text-foreground transition-colors">
          ホーム
        </Link>
        <Link
          href="/how-to-use"
          className="hover:text-foreground transition-colors"
        >
          使い方
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          利用規約
        </Link>
        <Link
          href="/support"
          className="hover:text-foreground transition-colors"
        >
          サポート
        </Link>
        <Link
          href="/pricing"
          className="hover:text-foreground transition-colors"
        >
          料金
        </Link>
      </nav>
      <p className="text-center text-xs text-muted-foreground/50 mt-4">
        © 2025 Money Tracker
      </p>
    </footer>
  );
}

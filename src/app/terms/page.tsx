"use client";

import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const router = useRouter();

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
          <h1 className="font-heading text-xl font-bold">利用規約</h1>
        </div>

        {/* Terms Content */}
        <div className="bg-card rounded-xl p-6 border border-border space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-bold text-base mb-3">第1条（適用）</h2>
            <p className="text-muted-foreground">
              本規約は、本サービス「Money Tracker」（以下「本サービス」といいます）の利用条件を定めるものです。
              ユーザーの皆様には、本規約に従って本サービスをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第2条（利用登録）</h2>
            <div className="text-muted-foreground space-y-2">
              <p>
                本サービスにおいては、登録希望者が本規約に同意の上、Googleアカウント認証によって利用登録を行うものとします。
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第3条（禁止事項）</h2>
            <p className="text-muted-foreground mb-2">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>他のユーザーに迷惑をかける行為</li>
              <li>不正アクセスをし、またはこれを試みる行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第4条（本サービスの提供の停止等）</h2>
            <p className="text-muted-foreground">
              運営者は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
              <li>地震、落雷、火災、停電などの不可抗力により本サービスの提供が困難となった場合</li>
              <li>その他、運営者が本サービスの提供が困難と判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第5条（免責事項）</h2>
            <div className="text-muted-foreground space-y-2">
              <p>
                運営者は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
              </p>
              <p>
                本サービスは家計管理の補助を目的としており、ユーザーの財務上の判断や行動について一切の責任を負いません。
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第6条（データの取り扱い）</h2>
            <div className="text-muted-foreground space-y-2">
              <p>
                ユーザーが本サービスに登録したデータは、ユーザー本人および共有設定したパートナーのみがアクセスできます。
              </p>
              <p>
                運営者は、法令に基づく場合を除き、ユーザーの同意なく第三者にデータを開示することはありません。
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第7条（サービス内容の変更等）</h2>
            <p className="text-muted-foreground">
              運営者は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第8条（利用規約の変更）</h2>
            <p className="text-muted-foreground">
              運営者は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
              変更後の利用規約は、本サービス上に掲示した時点から効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">第9条（準拠法・裁判管轄）</h2>
            <p className="text-muted-foreground">
              本規約の解釈にあたっては、日本法を準拠法とします。
            </p>
          </section>

          <div className="pt-4 text-center text-xs text-muted-foreground border-t">
            <p>制定日：2026年1月4日</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

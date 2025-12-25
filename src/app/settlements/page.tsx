import { MainLayout } from "@/components/layout/MainLayout";
import { Users, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function SettlementsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">立替・精算</h1>

        {/* Outstanding balances */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h2 className="font-medium text-sm text-muted-foreground mb-4">
            未精算の立替
          </h2>

          <div className="space-y-4">
            {/* Example: Girlfriend */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">彼女</p>
                  <p className="text-xs text-muted-foreground">
                    3件の未精算
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-income" />
                <span className="font-heading font-bold text-income tabular-nums">
                  ¥0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors">
            <ArrowUpRight className="w-5 h-5 text-income mb-2" />
            <p className="font-medium">精算を記録</p>
            <p className="text-xs text-muted-foreground">
              お金を受け取った
            </p>
          </button>
          <button className="bg-card rounded-xl p-4 border border-border text-left hover:bg-accent transition-colors">
            <ArrowDownLeft className="w-5 h-5 text-expense mb-2" />
            <p className="font-medium">返済を記録</p>
            <p className="text-xs text-muted-foreground">
              お金を返した
            </p>
          </button>
        </div>

        {/* Settlement history */}
        <div>
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            精算履歴
          </h2>
          <div className="text-center py-8 text-muted-foreground">
            <p>精算履歴がありません</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

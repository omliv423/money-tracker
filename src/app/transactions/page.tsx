import { MainLayout } from "@/components/layout/MainLayout";

export default function TransactionsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">取引一覧</h1>
        <p className="text-muted-foreground">
          過去の取引履歴がここに表示されます
        </p>

        {/* Placeholder for transaction list */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card rounded-xl p-4 border border-border animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
                <div className="h-5 w-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

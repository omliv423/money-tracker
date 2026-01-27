export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="h-8 w-32 bg-secondary rounded-lg animate-pulse" />

      {/* Chart skeleton */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="h-48 bg-secondary rounded-lg animate-pulse" />
      </div>

      {/* Summary skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border">
            <div className="h-3 w-12 bg-secondary rounded animate-pulse mb-2" />
            <div className="h-6 w-20 bg-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

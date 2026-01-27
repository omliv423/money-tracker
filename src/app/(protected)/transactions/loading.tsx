export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="h-8 w-32 bg-secondary rounded-lg animate-pulse" />

      {/* List skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
                <div className="h-3 w-16 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-secondary rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

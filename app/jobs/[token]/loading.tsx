export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading job">
      <div className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-2/3 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
            style={{ width: `${90 - (i % 4) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

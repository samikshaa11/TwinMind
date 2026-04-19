export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-800/80 ${className}`}
      aria-hidden
    />
  );
}

export function SuggestionSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
      <SkeletonLine className="h-3 w-2/3" />
      <SkeletonLine className="h-3 w-5/6" />
    </div>
  );
}

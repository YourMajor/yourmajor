function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

/** Tournament-area loading state: the hub's shape — header block, then the
 *  leaderboard plate — so the page settles instead of popping in. */
export default function TournamentLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col gap-6">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="plate mt-4 overflow-hidden">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    </div>
  )
}

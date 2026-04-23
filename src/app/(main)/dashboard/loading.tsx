import { Card, CardContent, CardHeader } from '@/components/ui/card'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function DashboardLoading() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Header skeleton */}
      <div className="rounded-xl bg-primary p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full bg-white/20" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48 bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/10" />
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <Skeleton className="h-10 w-20 bg-white/10" />
          <Skeleton className="h-10 w-20 bg-white/10" />
          <Skeleton className="h-10 w-20 bg-white/10" />
        </div>
      </div>

      {/* Tournament cards skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-24 w-full rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

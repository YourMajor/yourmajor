export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { getSeasonHistory } from '@/lib/season-history'
import { getLeagueRootId } from '@/lib/league-events'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button-variants'
import { Trophy } from 'lucide-react'

export default async function SeasonHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, isLeague: true, parentTournamentId: true, name: true },
  })
  if (!tournament) notFound()

  const tier = await getTournamentTier(tournament.id)
  if (!TIER_LIMITS[tier].seasonOverSeasonTracking) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-heading font-bold">Season History</h1>
        <p className="text-muted-foreground">
          Season-over-season player tracking is available on the Club and Tour plans.
        </p>
        <Link href="/pricing" className={buttonVariants({ size: 'lg' })}>
          View Plans
        </Link>
      </main>
    )
  }

  const rootId = (await getLeagueRootId(tournament.id)) ?? tournament.id
  const history = await getSeasonHistory(rootId)

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${slug}/season`} className="hover:text-foreground transition-colors">Season</Link>
          {' › '}History
        </p>
        <h1 className="text-2xl font-heading font-bold">Season History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top finishers from each season of this league, going back through the renewal chain.
        </p>
      </div>

      {history.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No season standings yet. As events are completed and renewed year-over-year, history will appear here.
        </p>
      )}

      <div className="space-y-4">
        {history.map((season) => (
          <Card key={season.rootTournamentId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {season.year ? `${season.year} — ${season.name}` : season.name}
                  </CardTitle>
                  <CardDescription>Scoring: {season.scoringMethod}</CardDescription>
                </div>
                <Link
                  href={`/${season.slug}/season`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View season →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {season.topFinishers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed events.</p>
              ) : (
                <ol className="space-y-2">
                  {season.topFinishers.map((finisher) => (
                    <li
                      key={finisher.userId}
                      className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <span className="w-7 text-sm font-bold text-muted-foreground tabular-nums">
                        {finisher.rank === 1 ? (
                          <Trophy className="w-4 h-4 text-amber-500" />
                        ) : (
                          `${finisher.rank}.`
                        )}
                      </span>
                      {finisher.avatar ? (
                        <Image
                          src={finisher.avatar}
                          alt={finisher.displayName}
                          width={28}
                          height={28}
                          className="rounded-full object-cover h-7 w-7"
                          unoptimized
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {finisher.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{finisher.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {finisher.eventsPlayed} event{finisher.eventsPlayed === 1 ? '' : 's'} played
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{finisher.pointsOrTotal}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getSeasonStandings, getSeasonAwards } from '@/lib/season-standings'
import { getLatestEventRecap } from '@/lib/season-recap'
import { SeasonDashboard } from '@/components/season/SeasonDashboard'

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, parentTournamentId: true, isLeague: true },
  })
  if (!tournament) return null

  // Show season page for leagues (isLeague) or tournaments in a chain
  const hasChain = !!tournament.parentTournamentId
  const isLeague = tournament.isLeague

  if (!hasChain && !isLeague) {
    // Check if root has season scoring configured
    let seasonConfigured = false
    const root = await prisma.tournament.findFirst({
      where: { id: tournament.id, seasonScoringMethod: { not: null } },
    })
    seasonConfigured = !!root

    if (!seasonConfigured) {
      return (
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Season Standings</h1>
          <p className="text-muted-foreground">
            Season standings are available for leagues with multiple linked events.
            Renew your tournament to start building a season history.
          </p>
        </main>
      )
    }
  }

  const [seasonData, awards, recap] = await Promise.all([
    getSeasonStandings(tournament.id),
    getSeasonAwards(tournament.id),
    getLatestEventRecap(tournament.id),
  ])

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SeasonDashboard
        standings={seasonData.standings}
        events={seasonData.events}
        scoringMethod={seasonData.scoringMethod}
        seasonName={seasonData.seasonName}
        awards={awards}
        recap={recap}
        slug={slug}
      />
    </main>
  )
}

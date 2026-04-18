export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'
import { maybeAutoAdvanceStatus } from '@/lib/tournament-status'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      rounds: { orderBy: { roundNumber: 'asc' } },
    },
  })
  if (!tournament) return null

  const effectiveStatus = await maybeAutoAdvanceStatus(
    tournament.id,
    tournament.status,
    tournament.rounds,
    tournament.startDate,
    tournament.endDate,
  )

  const initialStandings = await getLeaderboard(tournament.id)
  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold mb-4 lg:mb-6 text-foreground">Leaderboard</h1>
      <LiveLeaderboard
        initialData={initialStandings}
        tournamentId={tournament.id}
        roundNumbers={roundNumbers}
        slug={slug}
        status={effectiveStatus}
        handicapSystem={tournament.handicapSystem}
      />
    </main>
  )
}

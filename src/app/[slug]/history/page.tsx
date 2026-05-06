export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPodiumHistory, getChainRoster } from '@/lib/tournament-chain'
import { SponsorStrip } from '@/components/hub/SponsorStrip'
import { HistoryPodiumCard } from '@/components/history/HistoryPodiumCard'
import { HistoryRosterTable } from '@/components/history/HistoryRosterTable'

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, isLeague: true, parentTournamentId: true },
  })
  if (!tournament) notFound()

  // Leagues use the full Season Dashboard at /season — never the History tab.
  if (tournament.isLeague) redirect(`/${slug}/season`)
  // Brand-new (non-renewed) tournaments have no chain to summarize.
  if (!tournament.parentTournamentId) redirect(`/${slug}`)

  const [podiums, roster] = await Promise.all([
    getPodiumHistory(tournament.id, 3),
    getChainRoster(tournament.id),
  ])

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <SponsorStrip tournamentId={tournament.id} />

      <header>
        <h1 className="text-2xl font-heading font-bold">History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Past podiums and the all-time roster across every edition of {tournament.name}.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-base font-heading font-bold">Past Editions</h2>
        {podiums.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No completed past editions yet. Once a previous tournament wraps up, its podium will appear here.
          </p>
        ) : (
          <div className="space-y-4">
            {podiums.map((p) => (
              <HistoryPodiumCard key={p.tournamentId} podium={p} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-heading font-bold">All-Time Roster</h2>
        <HistoryRosterTable
          entries={roster.entries}
          totalYears={roster.totalYearsInChain}
        />
      </section>
    </main>
  )
}

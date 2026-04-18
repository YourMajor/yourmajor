import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'
import { getAncestorChain } from '@/lib/tournament-chain'
import { VaultClient } from './VaultClient'

export default async function VaultPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, parentTournamentId: true },
  })

  if (!tournament || !tournament.parentTournamentId) {
    redirect(`/${slug}`)
  }

  const ancestors = await getAncestorChain(tournament.id)
  const completedAncestors = ancestors.filter((a) => a.status === 'COMPLETED')

  if (completedAncestors.length === 0) {
    redirect(`/${slug}`)
  }

  // Fetch leaderboards for each completed ancestor
  const vaultEntries = await Promise.all(
    completedAncestors.map(async (a) => {
      const standings = await getLeaderboard(a.id)
      return {
        tournamentId: a.id,
        name: a.name,
        year: a.startDate ? a.startDate.getFullYear() : a.endDate ? a.endDate.getFullYear() : 0,
        championName: a.championName,
        standings: standings.map((s) => ({
          rank: s.rank,
          playerName: s.playerName,
          avatarUrl: s.avatarUrl,
          handicap: s.handicap,
          holesPlayed: s.holesPlayed,
          grossTotal: s.grossTotal,
          netTotal: s.netTotal,
          grossVsPar: s.grossVsPar,
          netVsPar: s.netVsPar,
        })),
      }
    })
  )

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold mb-6">Tournament Vault</h1>
      <VaultClient entries={vaultEntries} />
    </main>
  )
}

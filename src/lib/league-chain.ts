import { prisma } from '@/lib/prisma'

/**
 * Walk up the parent chain to find the root tournament's id. Returns the
 * passed id unchanged if no parent exists. Bounded at 100 hops to defend
 * against pathological data; in practice league chains are 1-4 levels deep.
 *
 * Use this whenever a feature scoped to "the league" needs the root id —
 * chat threads, roster, season standings, etc. Each call still costs one
 * `findUnique` per level; if a hot path needs to avoid the walk entirely,
 * denormalize a `leagueRootId` column onto Tournament.
 */
export async function getRootTournamentId(tournamentId: string): Promise<string> {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!t || !t.parentTournamentId) return currentId
    currentId = t.parentTournamentId
  }
  return currentId
}

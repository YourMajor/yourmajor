import { prisma } from '@/lib/prisma'
import { getSeasonStandings } from '@/lib/season-standings'

export interface SeasonHistoryEntry {
  rootTournamentId: string
  slug: string
  name: string
  year: number | null
  scoringMethod: string
  topFinishers: Array<{
    userId: string
    displayName: string
    avatar: string | null
    rank: number
    pointsOrTotal: number
    eventsPlayed: number
  }>
}

/**
 * Returns season history for a league root, walking the parentTournamentId
 * chain backward. Each entry summarizes one season's top finishers.
 *
 * Ordered most-recent-first. Includes the given root.
 */
export async function getSeasonHistory(rootTournamentId: string): Promise<SeasonHistoryEntry[]> {
  // Walk backward through the chain of league roots
  const rootsChrono: Array<{
    id: string
    slug: string
    name: string
    startDate: Date | null
    endDate: Date | null
  }> = []

  let currentId: string | null = rootTournamentId
  for (let i = 0; i < 50; i++) {
    if (!currentId) break
    const t: { id: string; slug: string; name: string; startDate: Date | null; endDate: Date | null; parentTournamentId: string | null } | null = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        slug: true,
        name: true,
        startDate: true,
        endDate: true,
        parentTournamentId: true,
      },
    })
    if (!t) break
    rootsChrono.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
    })
    currentId = t.parentTournamentId
  }

  const entries: SeasonHistoryEntry[] = []
  for (const root of rootsChrono) {
    try {
      const standings = await getSeasonStandings(root.id)

      const top = standings.standings.slice(0, 5).map((s) => ({
        userId: s.userId,
        displayName: s.playerName,
        avatar: s.avatarUrl,
        rank: s.rank,
        pointsOrTotal: s.value,
        eventsPlayed: s.eventsPlayed,
      }))

      entries.push({
        rootTournamentId: root.id,
        slug: root.slug,
        name: root.name,
        year: root.startDate
          ? root.startDate.getFullYear()
          : root.endDate
            ? root.endDate.getFullYear()
            : null,
        scoringMethod: standings.scoringMethod,
        topFinishers: top,
      })
    } catch {
      // If a season has no standings (no completed events), skip it gracefully.
    }
  }

  return entries
}

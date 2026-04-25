// Server-only helpers for walking the league-event chain (parent/child tournaments
// linked via Tournament.parentTournamentId).

import { prisma } from '@/lib/prisma'

export interface LeagueEventSummary {
  id: string
  slug: string
  name: string
  date: Date | null
  status: 'REGISTRATION' | 'ACTIVE' | 'COMPLETED'
  isRoot: boolean
}

/**
 * Walk to the root of the league chain (the tournament with isLeague=true and
 * no parentTournamentId). Returns the input id if already the root, or null
 * if the input isn't part of a league chain.
 */
export async function getLeagueRootId(tournamentId: string): Promise<string | null> {
  let currentId: string = tournamentId
  // 8 hops is plenty — bound the walk to avoid runaway queries on bad data.
  for (let i = 0; i < 8; i++) {
    const row: { id: string; parentTournamentId: string | null; isLeague: boolean } | null =
      await prisma.tournament.findUnique({
        where: { id: currentId },
        select: { id: true, parentTournamentId: true, isLeague: true },
      })
    if (!row) return null
    if (!row.parentTournamentId) {
      return row.isLeague ? row.id : null
    }
    currentId = row.parentTournamentId
  }
  return null
}

/**
 * Returns all events in a league chain (root + descendants), sorted by their
 * first round date ascending. Pass any tournament id in the chain — it walks
 * up to find the root and then collects descendants.
 */
export async function getLeagueEvents(tournamentId: string): Promise<LeagueEventSummary[]> {
  const rootId = await getLeagueRootId(tournamentId)
  if (!rootId) return []

  // Pull root + all descendants in one go via recursive walk. Most leagues are
  // small (< 50 events) so a simple BFS is fine.
  const collected: Array<{
    id: string
    slug: string
    name: string
    status: 'REGISTRATION' | 'ACTIVE' | 'COMPLETED'
    parentTournamentId: string | null
    rounds: { date: Date | null }[]
  }> = []

  let frontier = [rootId]
  while (frontier.length > 0) {
    const layer = await prisma.tournament.findMany({
      where: { OR: [{ id: { in: frontier } }, { parentTournamentId: { in: frontier } }] },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        parentTournamentId: true,
        rounds: { orderBy: { roundNumber: 'asc' }, take: 1, select: { date: true } },
      },
    })
    const newOnes = layer.filter((t) => !collected.find((c) => c.id === t.id))
    if (newOnes.length === 0) break
    collected.push(...newOnes)
    frontier = newOnes.map((t) => t.id)
  }

  return collected
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      date: t.rounds[0]?.date ?? null,
      status: t.status,
      isRoot: t.id === rootId,
    }))
    .sort((a, b) => {
      const ta = a.date?.getTime() ?? 0
      const tb = b.date?.getTime() ?? 0
      return ta - tb
    })
}

/**
 * Returns the immediately previous event before the given tournament in its
 * league chain (sorted by date). Null if there is no prior event.
 */
export async function getPreviousLeagueEvent(tournamentId: string): Promise<LeagueEventSummary | null> {
  const events = await getLeagueEvents(tournamentId)
  const idx = events.findIndex((e) => e.id === tournamentId)
  if (idx <= 0) return null
  return events[idx - 1]
}

/**
 * For a given tournament, return a userId → Set<userId> map of partners
 * that each player was grouped with in the *previous* league event. Returns
 * empty map if not part of a league or no prior event exists.
 */
export async function getRecentPartners(
  tournamentId: string,
): Promise<Record<string, Set<string>>> {
  const prev = await getPreviousLeagueEvent(tournamentId)
  if (!prev) return {}

  const groups = await prisma.tournamentGroup.findMany({
    where: { tournamentId: prev.id },
    select: {
      members: {
        select: {
          tournamentPlayer: { select: { userId: true } },
        },
      },
    },
  })

  const partners: Record<string, Set<string>> = {}
  for (const group of groups) {
    const userIds = group.members.map((m) => m.tournamentPlayer.userId)
    for (const u of userIds) {
      if (!partners[u]) partners[u] = new Set()
      for (const v of userIds) {
        if (v !== u) partners[u].add(v)
      }
    }
  }
  return partners
}

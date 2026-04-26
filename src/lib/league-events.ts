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
  // The chain is parent-linked: each tournament has at most one parent, so the
  // walk to the root is O(chain length). Cap at 100 so a 50+ event season still
  // resolves; 8 was too tight and silently returned null on long chains.
  for (let i = 0; i < 100; i++) {
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
    startDate: Date | null
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
        startDate: true,
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
      date: t.startDate ?? null,
      status: t.status,
      isRoot: t.id === rootId,
    }))
    .sort((a, b) => {
      const ta = a.date?.getTime() ?? 0
      const tb = b.date?.getTime() ?? 0
      return ta - tb
    })
}

export interface LeagueEventAdminSummary extends LeagueEventSummary {
  courseName: string | null
  roundCount: number
  participantCount: number
  groupCount: number
  scoreCount: number
  /** scoreCount / (roundCount × 18 × participantCount), rounded; 0 when no participants. */
  scoreCompletionPct: number
  /** True when at least one TournamentGroup exists for the event. */
  hasGroups: boolean
}

/**
 * Like getLeagueEvents but enriches each row with metrics admins care about
 * on the season events table: course, participants, groups, score progress.
 * Single batched query — no N+1.
 */
export async function getLeagueEventsForAdmin(
  tournamentId: string,
): Promise<LeagueEventAdminSummary[]> {
  const summaries = await getLeagueEvents(tournamentId)
  if (summaries.length === 0) return []

  const ids = summaries.map((e) => e.id)
  const enriched = await prisma.tournament.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      rounds: {
        orderBy: { roundNumber: 'asc' },
        select: { course: { select: { name: true } } },
      },
      _count: {
        select: {
          rounds: true,
          groups: true,
          players: { where: { isParticipant: true } },
        },
      },
    },
  })

  const scoreRows = await prisma.score.groupBy({
    by: ['roundId'],
    where: { round: { tournamentId: { in: ids } } },
    _count: { _all: true },
  })

  // Map roundId → tournamentId for the score grouping above.
  const roundLookup = await prisma.tournamentRound.findMany({
    where: { tournamentId: { in: ids } },
    select: { id: true, tournamentId: true },
  })
  const roundToTournament = new Map(roundLookup.map((r) => [r.id, r.tournamentId]))

  const scoreCountByTournament = new Map<string, number>()
  for (const row of scoreRows) {
    const tid = roundToTournament.get(row.roundId)
    if (!tid) continue
    scoreCountByTournament.set(tid, (scoreCountByTournament.get(tid) ?? 0) + row._count._all)
  }

  const enrichedById = new Map(enriched.map((e) => [e.id, e]))

  return summaries.map((s) => {
    const e = enrichedById.get(s.id)
    const roundCount = e?._count.rounds ?? 0
    const participantCount = e?._count.players ?? 0
    const groupCount = e?._count.groups ?? 0
    const scoreCount = scoreCountByTournament.get(s.id) ?? 0
    const expected = roundCount * 18 * participantCount
    const scoreCompletionPct = expected > 0 ? Math.min(100, Math.round((scoreCount / expected) * 100)) : 0

    return {
      ...s,
      courseName: e?.rounds[0]?.course?.name ?? null,
      roundCount,
      participantCount,
      groupCount,
      scoreCount,
      scoreCompletionPct,
      hasGroups: groupCount > 0,
    }
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

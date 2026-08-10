import { prisma } from '@/lib/prisma'
import { getCachedLeaderboard } from '@/lib/scoring'

/** Upper bound on how far the parent/child chain walks are followed. */
const MAX_CHAIN_DEPTH = 20

export interface PastChampion {
  slug: string
  headerImage: string | null
  tournamentName: string
  year: number
  startDate: string | null
  endDate: string | null
  championName: string
  championUserId: string
  championAvatarUrl: string | null
  grossTotal: number | null
  grossVsPar: number | null
  roundScores: number[]
}

export interface AncestorTournament {
  id: string
  slug: string
  name: string
  headerImage: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  championUserId: string | null
  championName: string | null
  parentTournamentId: string | null
}

/**
 * Walk the parentTournamentId chain backwards, returning ancestors
 * ordered most-recent-first. Does NOT include the current tournament.
 */
export async function getAncestorChain(tournamentId: string): Promise<AncestorTournament[]> {
  const ancestors: AncestorTournament[] = []
  let currentId: string | null = tournamentId

  // First fetch the current tournament to get its parent
  const current = await prisma.tournament.findUnique({
    where: { id: currentId },
    select: { parentTournamentId: true },
  })
  currentId = current?.parentTournamentId ?? null

  // Bounded like getLatestInChain below. parentTournamentId is a plain
  // self-relation with no cycle constraint, so an A→B→A pair would otherwise
  // spin here forever and hang the request rather than just being slow.
  for (let i = 0; currentId && i < MAX_CHAIN_DEPTH; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        slug: true,
        name: true,
        headerImage: true,
        status: true,
        startDate: true,
        endDate: true,
        championUserId: true,
        championName: true,
        parentTournamentId: true,
      },
    })
    if (!t) break
    ancestors.push(t)
    currentId = t.parentTournamentId
  }

  return ancestors
}

export interface LatestTournament {
  slug: string
  name: string
}

/**
 * Walk the childTournaments chain forward from the given tournament,
 * returning the most recent (latest) descendant. Returns null if this
 * tournament IS the latest (has no children).
 */
export async function getLatestInChain(tournamentId: string): Promise<LatestTournament | null> {
  let currentId = tournamentId
  let latest: { slug: string; name: string } | null = null

  for (let i = 0; i < MAX_CHAIN_DEPTH; i++) {
    const child = await prisma.tournament.findFirst({
      where: { parentTournamentId: currentId },
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!child) break
    latest = { slug: child.slug, name: child.name }
    currentId = child.id
  }

  return latest
}

/**
 * Returns past champion history with rich data (avatar, scores, dates).
 * Ordered most-recent-first. Only includes completed tournaments with a champion.
 */
export async function getChampionHistory(tournamentId: string): Promise<PastChampion[]> {
  const ancestors = await getAncestorChain(tournamentId)
  const completed = ancestors.filter(
    (t) => t.status === 'COMPLETED' && t.championUserId && t.championName
  )

  if (completed.length === 0) return []

  // Batch every lookup up front. This used to run 4 serial queries per
  // ancestor (~80 round trips for a 20-event chain).
  const championIds = [...new Set(completed.map((t) => t.championUserId!))]

  const [profiles, users, memberships] = await Promise.all([
    prisma.playerProfile.findMany({
      where: { userId: { in: championIds } },
      select: { userId: true, avatar: true },
    }),
    prisma.user.findMany({
      where: { id: { in: championIds } },
      select: { id: true, image: true },
    }),
    prisma.tournamentPlayer.findMany({
      where: {
        tournamentId: { in: completed.map((t) => t.id) },
        userId: { in: championIds },
      },
      select: { id: true, tournamentId: true, userId: true },
    }),
  ])

  const avatarByUserId = new Map(profiles.map((p) => [p.userId, p.avatar]))
  const imageByUserId = new Map(users.map((u) => [u.id, u.image]))
  // Keyed by tournament+user because the same champion can win several events.
  const membershipByKey = new Map(memberships.map((m) => [`${m.tournamentId}:${m.userId}`, m.id]))

  const scores = memberships.length > 0
    ? await prisma.score.findMany({
        where: { tournamentPlayerId: { in: memberships.map((m) => m.id) } },
        include: {
          hole: { select: { par: true } },
          round: { select: { roundNumber: true } },
        },
      })
    : []

  const scoresByPlayer = new Map<string, typeof scores>()
  for (const s of scores) {
    const list = scoresByPlayer.get(s.tournamentPlayerId)
    if (list) list.push(s)
    else scoresByPlayer.set(s.tournamentPlayerId, [s])
  }

  const champions: PastChampion[] = []

  for (const t of completed) {
    const membershipId = membershipByKey.get(`${t.id}:${t.championUserId!}`)

    let grossTotal: number | null = null
    let grossVsPar: number | null = null
    let roundScores: number[] = []

    const playerScores = membershipId ? scoresByPlayer.get(membershipId) : undefined
    if (playerScores && playerScores.length > 0) {
      grossTotal = playerScores.reduce((sum, s) => sum + s.strokes, 0)
      const totalPar = playerScores.reduce((sum, s) => sum + (s.hole?.par ?? 4), 0)
      grossVsPar = grossTotal - totalPar

      // Group by round
      const byRound = new Map<number, number>()
      for (const s of playerScores) {
        const rn = s.round.roundNumber
        byRound.set(rn, (byRound.get(rn) ?? 0) + s.strokes)
      }
      roundScores = Array.from(byRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([, total]) => total)
    }

    champions.push({
      slug: t.slug,
      headerImage: t.headerImage,
      tournamentName: t.name,
      year: t.startDate ? t.startDate.getFullYear() : t.endDate ? t.endDate.getFullYear() : 0,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      championName: t.championName!,
      championUserId: t.championUserId!,
      // `has` not `??`: the original only fell back to User.image when no
      // PlayerProfile row existed at all, not when its avatar was null.
      championAvatarUrl: avatarByUserId.has(t.championUserId!)
        ? avatarByUserId.get(t.championUserId!) ?? null
        : imageByUserId.get(t.championUserId!) ?? null,
      grossTotal,
      grossVsPar,
      roundScores,
    })
  }

  return champions
}

// ─── History tab utilities ───────────────────────────────────────────────────
// Used by the new /[slug]/history page on non-league renewed tournaments.

export interface PodiumFinisher {
  rank: number
  userId: string | null
  tournamentPlayerId: string
  playerName: string
  avatarUrl: string | null
  grossTotal: number | null
  netTotal: number | null
  grossVsPar: number | null
  netVsPar: number | null
}

export interface PastTournamentPodium {
  tournamentId: string
  slug: string
  name: string
  headerImage: string | null
  year: number | null
  finishers: PodiumFinisher[]
}

/**
 * Returns the top-N finishers for each completed ancestor in the chain,
 * most-recent-first. Reuses getCachedLeaderboard so past completed events
 * hit the leaderboard cache.
 */
export async function getPodiumHistory(
  tournamentId: string,
  topN = 3,
): Promise<PastTournamentPodium[]> {
  const ancestors = await getAncestorChain(tournamentId)
  const completed = ancestors.filter((t) => t.status === 'COMPLETED')

  // Batch both halves the way getChampionHistory already does. This used to
  // run a leaderboard read and a player lookup serially per ancestor.
  const standingsByTournament = await Promise.all(
    completed.map((t) => getCachedLeaderboard(t.id, t.status)),
  )
  const podiums = standingsByTournament.map((s) => s.slice(0, topN))

  const allPlayerIds = [...new Set(podiums.flat().map((s) => s.tournamentPlayerId))]
  const players = allPlayerIds.length
    ? await prisma.tournamentPlayer.findMany({
        where: { id: { in: allPlayerIds } },
        select: { id: true, userId: true },
      })
    : []
  const userIdByPlayer = new Map(players.map((p) => [p.id, p.userId]))

  const results: PastTournamentPodium[] = []

  completed.forEach((t, i) => {
    const top = podiums[i]
    if (top.length === 0) return

    results.push({
      tournamentId: t.id,
      slug: t.slug,
      name: t.name,
      headerImage: t.headerImage,
      year: t.startDate?.getFullYear() ?? t.endDate?.getFullYear() ?? null,
      finishers: top.map((s) => ({
        rank: s.rank,
        userId: userIdByPlayer.get(s.tournamentPlayerId) ?? null,
        tournamentPlayerId: s.tournamentPlayerId,
        playerName: s.playerName,
        avatarUrl: s.avatarUrl,
        grossTotal: s.grossTotal,
        netTotal: s.netTotal,
        grossVsPar: s.grossVsPar,
        netVsPar: s.netVsPar,
      })),
    })
  })

  return results
}

export interface RosterBestFinish {
  rank: number
  year: number | null
  tournamentName: string
  slug: string
}

export interface RosterEntry {
  userId: string
  playerName: string
  avatarUrl: string | null
  yearsPlayed: number
  bestFinish: RosterBestFinish | null
}

export interface ChainRoster {
  totalYearsInChain: number
  entries: RosterEntry[]
}

/** Minimal standing fields needed by the roster aggregator. */
export interface RosterStandingInput {
  rank: number
  tournamentPlayerId: string
  playerName: string
  avatarUrl: string | null
}

export interface RosterTournamentInput {
  tournament: { slug: string; name: string; year: number | null }
  standings: RosterStandingInput[]
  /** Maps tournamentPlayerId → userId (null for guests). */
  userIdByPlayer: Map<string, string | null>
}

/**
 * Pure aggregator: given completed tournaments (already chronologically
 * ordered) plus their leaderboards and userId lookups, returns the unified
 * roster. Skips rows where userId is null. Sort: best rank asc, then
 * yearsPlayed desc, then name asc.
 *
 * Order of `inputs` matters for tie-breaking name/avatar: the FIRST occurrence
 * of a userId wins for displayed name + avatar. Pass current-first.
 */
export function aggregateChainRoster(
  inputs: RosterTournamentInput[],
): ChainRoster {
  const aggregate = new Map<
    string,
    {
      userId: string
      playerName: string
      avatarUrl: string | null
      yearsPlayed: number
      bestFinish: RosterBestFinish | null
    }
  >()

  for (const { tournament, standings, userIdByPlayer } of inputs) {
    for (const s of standings) {
      const userId = userIdByPlayer.get(s.tournamentPlayerId)
      if (!userId) continue

      const existing = aggregate.get(userId)
      if (!existing) {
        aggregate.set(userId, {
          userId,
          playerName: s.playerName,
          avatarUrl: s.avatarUrl,
          yearsPlayed: 1,
          bestFinish: {
            rank: s.rank,
            year: tournament.year,
            tournamentName: tournament.name,
            slug: tournament.slug,
          },
        })
      } else {
        existing.yearsPlayed += 1
        if (
          existing.bestFinish === null ||
          s.rank < existing.bestFinish.rank
        ) {
          existing.bestFinish = {
            rank: s.rank,
            year: tournament.year,
            tournamentName: tournament.name,
            slug: tournament.slug,
          }
        }
      }
    }
  }

  const entries = Array.from(aggregate.values()).sort((a, b) => {
    const ra = a.bestFinish?.rank ?? Number.MAX_SAFE_INTEGER
    const rb = b.bestFinish?.rank ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    if (a.yearsPlayed !== b.yearsPlayed) return b.yearsPlayed - a.yearsPlayed
    return a.playerName.localeCompare(b.playerName)
  })

  return {
    totalYearsInChain: inputs.length,
    entries,
  }
}

/**
 * Returns the unique-by-userId roster across the full chain (ancestors + the
 * given tournament if completed), aggregating yearsPlayed and bestFinish.
 *
 * Skips guest entries (rows where TournamentPlayer.userId is null) — they
 * cannot be reliably deduped across editions.
 */
export async function getChainRoster(tournamentId: string): Promise<ChainRoster> {
  const current = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  })

  const ancestors = await getAncestorChain(tournamentId)

  const chain: Array<{
    id: string
    slug: string
    name: string
    status: string
    startDate: Date | null
    endDate: Date | null
  }> = []
  if (current) chain.push(current)
  for (const a of ancestors) {
    chain.push({
      id: a.id,
      slug: a.slug,
      name: a.name,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
    })
  }

  const completed = chain.filter((t) => t.status === 'COMPLETED')

  // One leaderboard fan-out and one player lookup for the whole chain, rather
  // than a pair of serial awaits per completed edition.
  const standingsByTournament = await Promise.all(
    completed.map((t) => getCachedLeaderboard(t.id, t.status)),
  )

  const allPlayerIds = [
    ...new Set(standingsByTournament.flat().map((s) => s.tournamentPlayerId)),
  ]
  const players = allPlayerIds.length
    ? await prisma.tournamentPlayer.findMany({
        where: { id: { in: allPlayerIds } },
        select: { id: true, userId: true },
      })
    : []
  const userIdByPlayer = new Map<string, string | null>(
    players.map((p) => [p.id, p.userId]),
  )

  const inputs: RosterTournamentInput[] = []
  completed.forEach((t, i) => {
    const standings = standingsByTournament[i]
    if (standings.length === 0) return

    inputs.push({
      tournament: {
        slug: t.slug,
        name: t.name,
        year: t.startDate?.getFullYear() ?? t.endDate?.getFullYear() ?? null,
      },
      standings: standings.map((s) => ({
        rank: s.rank,
        tournamentPlayerId: s.tournamentPlayerId,
        playerName: s.playerName,
        avatarUrl: s.avatarUrl,
      })),
      userIdByPlayer,
    })
  })

  return aggregateChainRoster(inputs)
}

import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'
import type { PlayerStanding } from '@/lib/scoring-utils'
import type { SeasonScoringMethod } from '@/generated/prisma/client'
import {
  parseTiebreakers,
  compareWithTiebreakers,
  type Tiebreaker as TiebreakerImpl,
  type EventResult as EventResultImpl,
  type SeasonPlayerSummary as SeasonPlayerSummaryImpl,
} from '@/lib/season-tiebreakers'

// Re-export for backwards compatibility with existing callers that imported types from here.
export type Tiebreaker = TiebreakerImpl
export type EventResult = EventResultImpl
export type SeasonPlayerSummary = SeasonPlayerSummaryImpl
export {
  DEFAULT_TIEBREAKERS,
  parseTiebreakers,
  compareTiebreaker,
  compareWithTiebreakers,
} from '@/lib/season-tiebreakers'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeasonStandingsResult {
  standings: SeasonPlayerSummary[]
  events: SeasonEvent[]
  scoringMethod: SeasonScoringMethod
  seasonName: string
}

export interface SeasonEvent {
  tournamentId: string
  slug: string
  name: string
  date: string | null
  status: string
}

// ─── Chain walking ───────────────────────────────────────────────────────────

/**
 * Get all tournaments in a chain (both ancestors and descendants),
 * ordered chronologically. Includes the given tournament.
 */
async function getFullChain(tournamentId: string) {
  // Walk up to root
  const ancestors: string[] = []
  let currentId: string | null = tournamentId
  while (currentId) {
    const t: { id: string; parentTournamentId: string | null } | null = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!t) break
    if (t.id !== tournamentId) ancestors.unshift(t.id)
    currentId = t.parentTournamentId
  }

  // Walk down from current to find descendants
  const descendants: string[] = []
  let childSearch = [tournamentId]
  for (let i = 0; i < 100; i++) {
    const children = await prisma.tournament.findMany({
      where: { parentTournamentId: { in: childSearch } },
      select: { id: true },
    })
    if (children.length === 0) break
    const childIds = children.map((c) => c.id)
    descendants.push(...childIds)
    childSearch = childIds
  }

  const allIds = [...ancestors, tournamentId, ...descendants]

  return prisma.tournament.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      seasonScoringMethod: true,
      seasonBestOf: true,
      seasonPointsTable: true,
    },
    orderBy: { startDate: 'asc' },
  })
}

/**
 * Find the root tournament in a chain (the one with no parent).
 */
async function getRootTournament(tournamentId: string) {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        parentTournamentId: true,
        seasonScoringMethod: true,
        seasonBestOf: true,
        seasonPointsTable: true,
        seasonDropLowest: true,
        seasonTiebreakers: true,
        seasonAttendanceBonus: true,
        name: true,
      },
    })
    if (!t) break
    if (!t.parentTournamentId) return t
    currentId = t.parentTournamentId
  }
  return null
}

// ─── Tiebreakers ─────────────────────────────────────────────────────────────
// Pure helpers live in '@/lib/season-tiebreakers' and are re-exported above.

// ─── Default points table ────────────────────────────────────────────────────

const DEFAULT_POINTS_TABLE: Record<number, number> = {
  1: 25, 2: 20, 3: 16, 4: 13, 5: 11,
  6: 10, 7: 9, 8: 8, 9: 7, 10: 6,
  11: 5, 12: 4, 13: 3, 14: 2, 15: 1,
}

function getPointsForRank(rank: number, pointsTable: Record<number, number>): number {
  return pointsTable[rank] ?? 0
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function getSeasonStandings(tournamentId: string): Promise<SeasonStandingsResult> {
  const root = await getRootTournament(tournamentId)
  const chain = await getFullChain(tournamentId)

  // Only include completed or active tournaments for standings
  const scorableEvents = chain.filter((t) => t.status === 'COMPLETED' || t.status === 'ACTIVE')

  const scoringMethod: SeasonScoringMethod = root?.seasonScoringMethod ?? 'POINTS'
  const bestOf = root?.seasonBestOf ?? null
  const dropLowest = root?.seasonDropLowest ?? null
  const tiebreakers = parseTiebreakers(root?.seasonTiebreakers)
  const pointsTable: Record<number, number> = (root?.seasonPointsTable as Record<number, number>) ?? DEFAULT_POINTS_TABLE

  // Manual point/stroke adjustments applied per user
  const adjustmentRows = root
    ? await prisma.seasonAdjustment.findMany({
        where: { rootTournamentId: root.id },
        select: { userId: true, delta: true },
      })
    : []
  const adjustmentByUser = new Map<string, number>()
  for (const row of adjustmentRows) {
    adjustmentByUser.set(row.userId, (adjustmentByUser.get(row.userId) ?? 0) + row.delta)
  }

  // Build per-player, per-event results
  const playerMap = new Map<string, {
    userId: string
    playerName: string
    avatarUrl: string | null
    eventResults: EventResult[]
  }>()

  for (const event of scorableEvents) {
    const standings = await getLeaderboard(event.id)
    if (standings.length === 0) continue

    // Batch: resolve all tournamentPlayer.userId in one query instead of
    // one findUnique per standing (was O(events × players)).
    const tpIds = standings.map((s) => s.tournamentPlayerId)
    const tps = await prisma.tournamentPlayer.findMany({
      where: { id: { in: tpIds } },
      select: { id: true, userId: true },
    })
    const tpUserId = new Map(tps.map((t) => [t.id, t.userId]))

    for (const s of standings) {
      const userId = tpUserId.get(s.tournamentPlayerId)
      if (!userId) continue

      if (!playerMap.has(userId)) {
        playerMap.set(userId, {
          userId,
          playerName: s.playerName,
          avatarUrl: s.avatarUrl,
          eventResults: [],
        })
      }

      const player = playerMap.get(userId)!
      // Update name/avatar to latest
      player.playerName = s.playerName
      if (s.avatarUrl) player.avatarUrl = s.avatarUrl

      player.eventResults.push({
        tournamentId: event.id,
        tournamentSlug: event.slug,
        tournamentName: event.name,
        date: event.startDate?.toISOString() ?? null,
        rank: s.rank,
        grossVsPar: s.grossVsPar,
        netVsPar: s.netVsPar,
        points: s.points,
        grossTotal: s.grossTotal,
        netTotal: s.netTotal,
      })
    }
  }

  // Compute season value per player based on scoring method
  const seasonPlayers: SeasonPlayerSummary[] = []

  for (const [, player] of playerMap) {
    let value: number

    switch (scoringMethod) {
      case 'POINTS': {
        let results = player.eventResults.map((r) => getPointsForRank(r.rank, pointsTable))
        // Drop the lowest N (worst) results before keep-best-N.
        if (dropLowest && dropLowest > 0 && results.length > dropLowest) {
          results = results.sort((a, b) => b - a).slice(0, results.length - dropLowest)
        }
        if (bestOf && results.length > bestOf) {
          results = results.sort((a, b) => b - a).slice(0, bestOf)
        }
        value = results.reduce((sum, v) => sum + v, 0)
        break
      }
      case 'STROKE_AVG': {
        let netScores = player.eventResults
          .map((r) => r.netVsPar ?? r.grossVsPar)
          .filter((v): v is number => v !== null)
        if (dropLowest && dropLowest > 0 && netScores.length > dropLowest) {
          // Lower-is-better: drop the highest (worst) N values.
          netScores = netScores.sort((a, b) => a - b).slice(0, netScores.length - dropLowest)
        }
        value = netScores.length > 0
          ? netScores.reduce((sum, v) => sum + v, 0) / netScores.length
          : 0
        break
      }
      case 'BEST_OF_N': {
        const n = bestOf ?? player.eventResults.length
        const netScores = player.eventResults
          .map((r) => r.netVsPar ?? r.grossVsPar)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b)
          .slice(0, n)
        value = netScores.length > 0
          ? netScores.reduce((sum, v) => sum + v, 0) / netScores.length
          : 0
        break
      }
      case 'STABLEFORD_CUMULATIVE': {
        let results = player.eventResults.map((r) => r.points ?? 0)
        if (dropLowest && dropLowest > 0 && results.length > dropLowest) {
          results = results.sort((a, b) => b - a).slice(0, results.length - dropLowest)
        }
        if (bestOf && results.length > bestOf) {
          results = results.sort((a, b) => b - a).slice(0, bestOf)
        }
        value = results.reduce((sum, v) => sum + v, 0)
        break
      }
      default:
        value = 0
    }

    // Apply manual season adjustments (always additive; affects POINTS-style methods directly,
    // and stroke methods as a stroke delta).
    const adjustment = adjustmentByUser.get(player.userId) ?? 0
    if (adjustment !== 0) value += adjustment

    seasonPlayers.push({
      userId: player.userId,
      playerName: player.playerName,
      avatarUrl: player.avatarUrl,
      eventsPlayed: player.eventResults.length,
      totalEvents: scorableEvents.length,
      value,
      eventResults: player.eventResults,
      trend: null,
      rank: 0,
    })
  }

  // Sort: POINTS and STABLEFORD_CUMULATIVE are higher-is-better; stroke methods are lower-is-better.
  // Apply tiebreaker ladder when primary values are equal.
  const higherIsBetter = scoringMethod === 'POINTS' || scoringMethod === 'STABLEFORD_CUMULATIVE'
  seasonPlayers.sort((a, b) => {
    const primary = higherIsBetter ? b.value - a.value : a.value - b.value
    return compareWithTiebreakers(a, b, primary, tiebreakers)
  })

  // Assign ranks. Ties are only "true ties" when all tiebreakers also returned 0 —
  // the comparator above will have placed truly-tied players adjacently with cmp=0.
  let rank = 1
  for (let i = 0; i < seasonPlayers.length; i++) {
    if (i > 0) {
      const prev = seasonPlayers[i - 1]
      const cur = seasonPlayers[i]
      const primary = higherIsBetter ? prev.value - cur.value : cur.value - prev.value
      const cmp = compareWithTiebreakers(cur, prev, primary, tiebreakers)
      if (cmp !== 0) rank = i + 1
    }
    seasonPlayers[i].rank = rank
  }

  // Compute trends by comparing ranks with and without the most recent event
  if (scorableEvents.length >= 2) {
    const latestEventId = scorableEvents[scorableEvents.length - 1].id

    // Build previous standings (without latest event)
    const prevValues = new Map<string, number>()
    for (const player of seasonPlayers) {
      const prevResults = player.eventResults.filter((r) => r.tournamentId !== latestEventId)
      if (prevResults.length === 0) continue

      let prevValue: number
      switch (scoringMethod) {
        case 'POINTS': {
          let results = prevResults.map((r) => getPointsForRank(r.rank, pointsTable))
          if (bestOf && results.length > bestOf) {
            results = results.sort((a, b) => b - a).slice(0, bestOf)
          }
          prevValue = results.reduce((sum, v) => sum + v, 0)
          break
        }
        case 'STROKE_AVG': {
          const scores = prevResults.map((r) => r.netVsPar ?? r.grossVsPar).filter((v): v is number => v !== null)
          prevValue = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : 0
          break
        }
        case 'BEST_OF_N': {
          const n = bestOf ?? prevResults.length
          const scores = prevResults.map((r) => r.netVsPar ?? r.grossVsPar).filter((v): v is number => v !== null).sort((a, b) => a - b).slice(0, n)
          prevValue = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : 0
          break
        }
        case 'STABLEFORD_CUMULATIVE': {
          let results = prevResults.map((r) => r.points ?? 0)
          if (bestOf && results.length > bestOf) {
            results = results.sort((a, b) => b - a).slice(0, bestOf)
          }
          prevValue = results.reduce((sum, v) => sum + v, 0)
          break
        }
        default:
          prevValue = 0
      }
      prevValues.set(player.userId, prevValue)
    }

    // Sort previous values to get previous ranks
    const prevEntries = Array.from(prevValues.entries())
      .sort(([, a], [, b]) => higherIsBetter ? b - a : a - b)
    const prevRanks = new Map<string, number>()
    let prevRank = 1
    for (let i = 0; i < prevEntries.length; i++) {
      if (i > 0 && prevEntries[i][1] !== prevEntries[i - 1][1]) {
        prevRank = i + 1
      }
      prevRanks.set(prevEntries[i][0], prevRank)
    }

    for (const player of seasonPlayers) {
      const prev = prevRanks.get(player.userId)
      if (prev === undefined) {
        player.trend = null // new player
      } else {
        player.trend = prev - player.rank // positive = improved
      }
    }
  }

  const events: SeasonEvent[] = chain.map((t) => ({
    tournamentId: t.id,
    slug: t.slug,
    name: t.name,
    date: t.startDate?.toISOString() ?? null,
    status: t.status,
  }))

  return {
    standings: seasonPlayers,
    events,
    scoringMethod,
    seasonName: root?.name ?? chain[0]?.name ?? 'Season',
  }
}

// ─── Player Season Stats ─────────────────────────────────────────────────────

export interface PlayerSeasonStats {
  userId: string
  playerName: string
  avatarUrl: string | null
  eventsPlayed: number
  totalEvents: number
  seasonRank: number
  seasonValue: number
  scoringMethod: SeasonScoringMethod
  avgGrossVsPar: number | null
  bestFinish: number
  worstFinish: number
  avgFinish: number
  totalBirdies: number
  totalPars: number
  totalBogeys: number
  totalEagles: number
  totalDoubles: number
  fairwayPct: number | null
  girPct: number | null
  avgPutts: number | null
  handicapHistory: { eventName: string; date: string | null; handicap: number }[]
  eventResults: EventResult[]
  headToHead: HeadToHeadRecord[]
  personalBests: PersonalBest[]
}

export interface HeadToHeadRecord {
  opponentUserId: string
  opponentName: string
  opponentAvatar: string | null
  wins: number
  losses: number
  ties: number
}

export interface PersonalBest {
  label: string
  value: string
  eventName: string
  date: string | null
}

export async function getPlayerSeasonStats(
  tournamentId: string,
  userId: string
): Promise<PlayerSeasonStats | null> {
  const seasonData = await getSeasonStandings(tournamentId)
  const playerSummary = seasonData.standings.find((s) => s.userId === userId)
  if (!playerSummary) return null

  const chain = await getFullChain(tournamentId)
  const scorableEvents = chain.filter((t) => t.status === 'COMPLETED' || t.status === 'ACTIVE')

  // Aggregate detailed stats across all events
  let totalBirdies = 0, totalPars = 0, totalBogeys = 0, totalEagles = 0, totalDoubles = 0
  let fairwayHits = 0, fairwayAttempts = 0
  let girHits = 0, girAttempts = 0
  let totalPutts = 0, puttsCount = 0
  const handicapHistory: { eventName: string; date: string | null; handicap: number }[] = []

  // Head-to-head tracking
  const h2hMap = new Map<string, { name: string; avatar: string | null; wins: number; losses: number; ties: number }>()

  // Personal bests
  let bestRound: { total: number; eventName: string; date: string | null } | null = null
  let bestFinishRank = Infinity
  let bestFinishEvent = ''
  let bestFinishDate: string | null = null
  let mostBirdiesInEvent = 0
  let mostBirdiesEventName = ''
  let mostBirdiesDate: string | null = null

  for (const event of scorableEvents) {
    const standings = await getLeaderboard(event.id)
    if (standings.length === 0) continue

    // Batch-resolve every standing's userId in one query so we can do both
    // "find this player's standing" and head-to-head lookups without N+1.
    const tpIds = standings.map((s) => s.tournamentPlayerId)
    const tps = await prisma.tournamentPlayer.findMany({
      where: { id: { in: tpIds } },
      select: { id: true, userId: true },
    })
    const tpUserId = new Map(tps.map((t) => [t.id, t.userId]))

    // Find this player's standing
    let playerStanding: PlayerStanding | null = null
    let playerTpId: string | null = null

    for (const s of standings) {
      if (tpUserId.get(s.tournamentPlayerId) === userId) {
        playerStanding = s
        playerTpId = s.tournamentPlayerId
        break
      }
    }
    if (!playerStanding || !playerTpId) continue

    // Handicap history
    handicapHistory.push({
      eventName: event.name,
      date: event.startDate?.toISOString() ?? null,
      handicap: playerStanding.handicap,
    })

    // Score breakdown
    let eventBirdies = 0
    for (const hole of playerStanding.holes) {
      if (hole.diff === null) continue
      if (hole.diff <= -2) totalEagles++
      else if (hole.diff === -1) { totalBirdies++; eventBirdies++ }
      else if (hole.diff === 0) totalPars++
      else if (hole.diff === 1) totalBogeys++
      else if (hole.diff >= 2) totalDoubles++
    }

    // Detailed stats from scores
    const scores = await prisma.score.findMany({
      where: { tournamentPlayerId: playerTpId },
      select: { fairwayHit: true, gir: true, putts: true, strokes: true, round: { select: { roundNumber: true } } },
    })

    for (const score of scores) {
      if (score.fairwayHit !== null) { fairwayAttempts++; if (score.fairwayHit) fairwayHits++ }
      if (score.gir !== null) { girAttempts++; if (score.gir) girHits++ }
      if (score.putts !== null) { puttsCount++; totalPutts += score.putts }
    }

    // Best round (by round total)
    for (const [, total] of Object.entries(playerStanding.roundTotals)) {
      if (!bestRound || total < bestRound.total) {
        bestRound = { total, eventName: event.name, date: event.startDate?.toISOString() ?? null }
      }
    }

    // Best finish
    if (playerStanding.rank < bestFinishRank) {
      bestFinishRank = playerStanding.rank
      bestFinishEvent = event.name
      bestFinishDate = event.startDate?.toISOString() ?? null
    }

    // Most birdies in single event
    if (eventBirdies > mostBirdiesInEvent) {
      mostBirdiesInEvent = eventBirdies
      mostBirdiesEventName = event.name
      mostBirdiesDate = event.startDate?.toISOString() ?? null
    }

    // Head-to-head: compare vs every other player in same event. Uses the
    // tpUserId map built above — no per-opponent findUnique.
    for (const opponent of standings) {
      if (opponent.tournamentPlayerId === playerTpId) continue
      const oppUserId = tpUserId.get(opponent.tournamentPlayerId)
      if (!oppUserId) continue

      if (!h2hMap.has(oppUserId)) {
        h2hMap.set(oppUserId, {
          name: opponent.playerName,
          avatar: opponent.avatarUrl,
          wins: 0, losses: 0, ties: 0,
        })
      }
      const record = h2hMap.get(oppUserId)!
      record.name = opponent.playerName
      if (opponent.avatarUrl) record.avatar = opponent.avatarUrl

      if (playerStanding.rank < opponent.rank) record.wins++
      else if (playerStanding.rank > opponent.rank) record.losses++
      else record.ties++
    }
  }

  const finishes = playerSummary.eventResults.map((r) => r.rank)

  const personalBests: PersonalBest[] = []
  if (bestRound) {
    personalBests.push({ label: 'Best Round', value: String(bestRound.total), eventName: bestRound.eventName, date: bestRound.date })
  }
  if (bestFinishRank < Infinity) {
    personalBests.push({ label: 'Best Finish', value: ordinal(bestFinishRank), eventName: bestFinishEvent, date: bestFinishDate })
  }
  if (mostBirdiesInEvent > 0) {
    personalBests.push({ label: 'Most Birdies (Event)', value: String(mostBirdiesInEvent), eventName: mostBirdiesEventName, date: mostBirdiesDate })
  }

  const headToHead: HeadToHeadRecord[] = Array.from(h2hMap.entries())
    .map(([oppUserId, r]) => ({
      opponentUserId: oppUserId,
      opponentName: r.name,
      opponentAvatar: r.avatar,
      wins: r.wins,
      losses: r.losses,
      ties: r.ties,
    }))
    .sort((a, b) => (b.wins + b.losses + b.ties) - (a.wins + a.losses + a.ties))

  return {
    userId,
    playerName: playerSummary.playerName,
    avatarUrl: playerSummary.avatarUrl,
    eventsPlayed: playerSummary.eventsPlayed,
    totalEvents: playerSummary.totalEvents,
    seasonRank: playerSummary.rank,
    seasonValue: playerSummary.value,
    scoringMethod: seasonData.scoringMethod,
    avgGrossVsPar: finishes.length > 0
      ? playerSummary.eventResults
          .map((r) => r.grossVsPar)
          .filter((v): v is number => v !== null)
          .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || null
      : null,
    bestFinish: finishes.length > 0 ? Math.min(...finishes) : 0,
    worstFinish: finishes.length > 0 ? Math.max(...finishes) : 0,
    avgFinish: finishes.length > 0 ? finishes.reduce((sum, v) => sum + v, 0) / finishes.length : 0,
    totalBirdies,
    totalPars,
    totalBogeys,
    totalEagles,
    totalDoubles,
    fairwayPct: fairwayAttempts > 0 ? (fairwayHits / fairwayAttempts) * 100 : null,
    girPct: girAttempts > 0 ? (girHits / girAttempts) * 100 : null,
    avgPutts: puttsCount > 0 ? totalPutts / puttsCount : null,
    handicapHistory,
    eventResults: playerSummary.eventResults,
    headToHead,
    personalBests,
  }
}

// ─── Season Awards ───────────────────────────────────────────────────────────

export interface SeasonAward {
  title: string
  description: string
  playerName: string
  playerAvatar: string | null
  value: string
}

export async function getSeasonAwards(tournamentId: string): Promise<SeasonAward[]> {
  const seasonData = await getSeasonStandings(tournamentId)
  if (seasonData.standings.length === 0) return []

  const awards: SeasonAward[] = []

  // Best Round — lowest single-round gross score across the whole season.
  // One query for every score in the chain; sum by (player × round) and find the min.
  const eventIds = seasonData.events
    .filter((e) => e.status === 'COMPLETED' || e.status === 'ACTIVE')
    .map((e) => e.tournamentId)
  if (eventIds.length > 0) {
    const scores = await prisma.score.findMany({
      where: { round: { tournamentId: { in: eventIds } } },
      select: {
        strokes: true,
        roundId: true,
        tournamentPlayerId: true,
        round: { select: { roundNumber: true, tournamentId: true } },
        tournamentPlayer: {
          select: {
            userId: true,
            user: { select: { name: true, email: true, profile: { select: { avatar: true } }, image: true } },
          },
        },
      },
    })

    const roundTotals = new Map<string, {
      total: number
      playerName: string
      playerAvatar: string | null
      tournamentId: string
      roundNumber: number
    }>()
    for (const s of scores) {
      const key = `${s.tournamentPlayerId}:${s.roundId}`
      const existing = roundTotals.get(key)
      const player = s.tournamentPlayer
      if (existing) {
        existing.total += s.strokes
      } else {
        roundTotals.set(key, {
          total: s.strokes,
          playerName: player.user.name ?? player.user.email.split('@')[0],
          playerAvatar: player.user.profile?.avatar ?? player.user.image ?? null,
          tournamentId: s.round.tournamentId,
          roundNumber: s.round.roundNumber,
        })
      }
    }

    if (roundTotals.size > 0) {
      const lowest = Math.min(...Array.from(roundTotals.values()).map((r) => r.total))
      const winners = Array.from(roundTotals.values()).filter((r) => r.total === lowest)
      if (winners.length > 0) {
        const event = seasonData.events.find((e) => e.tournamentId === winners[0].tournamentId)
        const tied = winners.length > 1 ? ` (+${winners.length - 1} tied)` : ''
        awards.push({
          title: 'Best Round',
          description: `${event?.name ?? 'Season'} · Round ${winners[0].roundNumber}${tied}`,
          playerName: winners[0].playerName,
          playerAvatar: winners[0].playerAvatar,
          value: String(lowest),
        })
      }
    }
  }

  // Iron Man — most events played (only if 100% attendance)
  const maxEvents = seasonData.standings[0]?.totalEvents ?? 0
  const ironMen = seasonData.standings.filter((s) => s.eventsPlayed === maxEvents && maxEvents > 0)
  if (ironMen.length > 0) {
    awards.push({
      title: 'Iron Man',
      description: 'Perfect attendance',
      playerName: ironMen[0].playerName,
      playerAvatar: ironMen[0].avatarUrl,
      value: `${ironMen[0].eventsPlayed}/${maxEvents} events`,
    })
  }

  // Most Consistent — lowest variance in finish position
  const playersWithMultiple = seasonData.standings.filter((s) => s.eventsPlayed >= 3)
  if (playersWithMultiple.length > 0) {
    let lowestVariance = Infinity
    let consistentPlayer = playersWithMultiple[0]
    for (const player of playersWithMultiple) {
      const finishes = player.eventResults.map((r) => r.rank)
      const avg = finishes.reduce((a, b) => a + b, 0) / finishes.length
      const variance = finishes.reduce((sum, f) => sum + Math.pow(f - avg, 2), 0) / finishes.length
      if (variance < lowestVariance) {
        lowestVariance = variance
        consistentPlayer = player
      }
    }
    awards.push({
      title: 'Consistency Award',
      description: 'Most consistent finishes',
      playerName: consistentPlayer.playerName,
      playerAvatar: consistentPlayer.avatarUrl,
      value: `Avg finish: ${ordinal(Math.round(consistentPlayer.eventResults.map((r) => r.rank).reduce((a, b) => a + b, 0) / consistentPlayer.eventResults.length))}`,
    })
  }

  // Comeback King — most positions gained in a single event
  let biggestComeback = 0
  let comebackPlayer = seasonData.standings[0]
  let comebackEvent = ''
  for (const player of seasonData.standings) {
    if (player.eventResults.length < 2) continue
    for (let i = 1; i < player.eventResults.length; i++) {
      const gain = player.eventResults[i - 1].rank - player.eventResults[i].rank
      if (gain > biggestComeback) {
        biggestComeback = gain
        comebackPlayer = player
        comebackEvent = player.eventResults[i].tournamentName
      }
    }
  }
  if (biggestComeback > 0) {
    awards.push({
      title: 'Comeback King',
      description: `Gained ${biggestComeback} positions in ${comebackEvent}`,
      playerName: comebackPlayer.playerName,
      playerAvatar: comebackPlayer.avatarUrl,
      value: `+${biggestComeback} positions`,
    })
  }

  return awards
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceRow {
  userId: string
  playerName: string
  avatarUrl: string | null
  events: { tournamentId: string; attended: boolean }[]
  attendancePct: number
}

export async function getSeasonAttendance(tournamentId: string): Promise<{
  rows: AttendanceRow[]
  events: SeasonEvent[]
}> {
  const chain = await getFullChain(tournamentId)
  const scorableEvents = chain.filter((t) => t.status === 'COMPLETED' || t.status === 'ACTIVE')

  // Get all players who participated in any event
  const playerMap = new Map<string, { name: string; avatar: string | null }>()
  const participation = new Map<string, Set<string>>() // userId -> set of tournamentIds

  for (const event of scorableEvents) {
    const players = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: event.id, isParticipant: true },
      include: { user: { include: { profile: { select: { avatar: true } } } } },
    })

    for (const p of players) {
      if (!playerMap.has(p.userId)) {
        playerMap.set(p.userId, {
          name: p.user.name ?? p.user.email.split('@')[0],
          avatar: p.user.profile?.avatar ?? p.user.image ?? null,
        })
      }
      if (!participation.has(p.userId)) {
        participation.set(p.userId, new Set())
      }
      participation.get(p.userId)!.add(event.id)
    }
  }

  const rows: AttendanceRow[] = Array.from(playerMap.entries()).map(([userId, info]) => {
    const attended = participation.get(userId) ?? new Set()
    return {
      userId,
      playerName: info.name,
      avatarUrl: info.avatar,
      events: scorableEvents.map((e) => ({
        tournamentId: e.id,
        attended: attended.has(e.id),
      })),
      attendancePct: scorableEvents.length > 0
        ? (attended.size / scorableEvents.length) * 100
        : 0,
    }
  }).sort((a, b) => b.attendancePct - a.attendancePct)

  const events: SeasonEvent[] = scorableEvents.map((t) => ({
    tournamentId: t.id,
    slug: t.slug,
    name: t.name,
    date: t.startDate?.toISOString() ?? null,
    status: t.status,
  }))

  return { rows, events }
}

// ─── Course Analytics ────────────────────────────────────────────────────────

export interface CourseHoleAnalytics {
  holeNumber: number
  par: number
  avgScore: number
  avgVsPar: number
  birdieRate: number
  bogeyRate: number
  hardestRank: number
}

export interface CourseAnalytics {
  courseId: string
  courseName: string
  timesPlayed: number
  holes: CourseHoleAnalytics[]
  courseRecord: { playerName: string; total: number; date: string | null } | null
}

export async function getCourseAnalytics(tournamentId: string): Promise<CourseAnalytics[]> {
  const chain = await getFullChain(tournamentId)
  const scorableEvents = chain.filter((t) => t.status === 'COMPLETED' || t.status === 'ACTIVE')
  const eventIds = scorableEvents.map((e) => e.id)

  // Get all rounds for these tournaments
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId: { in: eventIds } },
    include: {
      course: { include: { holes: { orderBy: { number: 'asc' } } } },
      scores: { include: { hole: true, tournamentPlayer: { include: { user: true } } } },
    },
  })

  // Group by course
  const courseMap = new Map<string, {
    name: string
    timesPlayed: number
    holeScores: Map<number, { par: number; scores: number[] }>
    bestRound: { playerName: string; total: number; date: string | null } | null
  }>()

  for (const round of rounds) {
    const courseId = round.courseId
    if (!courseMap.has(courseId)) {
      courseMap.set(courseId, {
        name: round.course.name,
        timesPlayed: 0,
        holeScores: new Map(),
        bestRound: null,
      })
    }
    const course = courseMap.get(courseId)!
    course.timesPlayed++

    // Track scores by hole
    for (const score of round.scores) {
      const holeNum = score.hole.number
      if (!course.holeScores.has(holeNum)) {
        course.holeScores.set(holeNum, { par: score.hole.par, scores: [] })
      }
      course.holeScores.get(holeNum)!.scores.push(score.strokes)
    }

    // Track best round
    const playerRoundTotals = new Map<string, { name: string; total: number }>()
    for (const score of round.scores) {
      const tpId = score.tournamentPlayerId
      if (!playerRoundTotals.has(tpId)) {
        playerRoundTotals.set(tpId, {
          name: score.tournamentPlayer.user.name ?? 'Player',
          total: 0,
        })
      }
      playerRoundTotals.get(tpId)!.total += score.strokes
    }

    const event = scorableEvents.find((e) => e.id === round.tournamentId)
    for (const [, prt] of playerRoundTotals) {
      if (!course.bestRound || prt.total < course.bestRound.total) {
        course.bestRound = {
          playerName: prt.name,
          total: prt.total,
          date: event?.startDate?.toISOString() ?? null,
        }
      }
    }
  }

  return Array.from(courseMap.entries()).map(([courseId, data]) => {
    const holes: CourseHoleAnalytics[] = Array.from(data.holeScores.entries())
      .sort(([a], [b]) => a - b)
      .map(([holeNumber, holeData]) => {
        const avg = holeData.scores.reduce((a, b) => a + b, 0) / holeData.scores.length
        const birdies = holeData.scores.filter((s) => s < holeData.par).length
        const bogeys = holeData.scores.filter((s) => s > holeData.par).length
        return {
          holeNumber,
          par: holeData.par,
          avgScore: Math.round(avg * 100) / 100,
          avgVsPar: Math.round((avg - holeData.par) * 100) / 100,
          birdieRate: Math.round((birdies / holeData.scores.length) * 100),
          bogeyRate: Math.round((bogeys / holeData.scores.length) * 100),
          hardestRank: 0,
        }
      })

    // Rank holes by difficulty (avgVsPar descending)
    const sorted = [...holes].sort((a, b) => b.avgVsPar - a.avgVsPar)
    sorted.forEach((h, i) => { h.hardestRank = i + 1 })

    return {
      courseId,
      courseName: data.name,
      timesPlayed: data.timesPlayed,
      holes,
      courseRecord: data.bestRound,
    }
  }).sort((a, b) => b.timesPlayed - a.timesPlayed)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'
import type { PlayerStanding } from '@/lib/scoring-utils'
import type { SeasonScoringMethod } from '@/generated/prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeasonPlayerSummary {
  userId: string
  playerName: string
  avatarUrl: string | null
  eventsPlayed: number
  totalEvents: number
  /** Primary sort value — meaning depends on scoring method */
  value: number
  /** Per-event results for drill-down */
  eventResults: EventResult[]
  /** Rank change vs previous event: positive = moved up, negative = moved down, 0 = unchanged, null = new */
  trend: number | null
  rank: number
}

export interface EventResult {
  tournamentId: string
  tournamentSlug: string
  tournamentName: string
  date: string | null
  rank: number
  grossVsPar: number | null
  netVsPar: number | null
  points: number | null
  grossTotal: number | null
  netTotal: number | null
}

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
      select: { id: true, parentTournamentId: true, seasonScoringMethod: true, seasonBestOf: true, seasonPointsTable: true, name: true },
    })
    if (!t) break
    if (!t.parentTournamentId) return t
    currentId = t.parentTournamentId
  }
  return null
}

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
  const pointsTable: Record<number, number> = (root?.seasonPointsTable as Record<number, number>) ?? DEFAULT_POINTS_TABLE

  // Build per-player, per-event results
  const playerMap = new Map<string, {
    userId: string
    playerName: string
    avatarUrl: string | null
    eventResults: EventResult[]
  }>()

  for (const event of scorableEvents) {
    const standings = await getLeaderboard(event.id)

    for (const s of standings) {
      // Resolve userId from tournamentPlayer
      const tp = await prisma.tournamentPlayer.findUnique({
        where: { id: s.tournamentPlayerId },
        select: { userId: true },
      })
      if (!tp) continue

      if (!playerMap.has(tp.userId)) {
        playerMap.set(tp.userId, {
          userId: tp.userId,
          playerName: s.playerName,
          avatarUrl: s.avatarUrl,
          eventResults: [],
        })
      }

      const player = playerMap.get(tp.userId)!
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
        if (bestOf && results.length > bestOf) {
          results = results.sort((a, b) => b - a).slice(0, bestOf)
        }
        value = results.reduce((sum, v) => sum + v, 0)
        break
      }
      case 'STROKE_AVG': {
        const netScores = player.eventResults
          .map((r) => r.netVsPar ?? r.grossVsPar)
          .filter((v): v is number => v !== null)
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
        if (bestOf && results.length > bestOf) {
          results = results.sort((a, b) => b - a).slice(0, bestOf)
        }
        value = results.reduce((sum, v) => sum + v, 0)
        break
      }
      default:
        value = 0
    }

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

  // Sort: POINTS and STABLEFORD_CUMULATIVE are higher-is-better; stroke methods are lower-is-better
  const higherIsBetter = scoringMethod === 'POINTS' || scoringMethod === 'STABLEFORD_CUMULATIVE'
  seasonPlayers.sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value)

  // Assign ranks (handle ties)
  let rank = 1
  for (let i = 0; i < seasonPlayers.length; i++) {
    if (i > 0 && seasonPlayers[i].value !== seasonPlayers[i - 1].value) {
      rank = i + 1
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

    // Find this player's standing
    let playerStanding: PlayerStanding | null = null
    let playerTpId: string | null = null

    for (const s of standings) {
      const tp = await prisma.tournamentPlayer.findUnique({
        where: { id: s.tournamentPlayerId },
        select: { userId: true },
      })
      if (tp?.userId === userId) {
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

    // Head-to-head: compare vs every other player in same event
    for (const opponent of standings) {
      if (opponent.tournamentPlayerId === playerTpId) continue
      const oppTp = await prisma.tournamentPlayer.findUnique({
        where: { id: opponent.tournamentPlayerId },
        select: { userId: true },
      })
      if (!oppTp) continue

      if (!h2hMap.has(oppTp.userId)) {
        h2hMap.set(oppTp.userId, {
          name: opponent.playerName,
          avatar: opponent.avatarUrl,
          wins: 0, losses: 0, ties: 0,
        })
      }
      const record = h2hMap.get(oppTp.userId)!
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

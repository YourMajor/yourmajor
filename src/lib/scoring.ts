import { prisma } from '@/lib/prisma'
import { allocateHandicapStrokes, callawayDeduction, getCallawayAdjustment } from '@/lib/scoring-utils'

// Re-export everything from scoring-utils so existing imports still work
export { scoreName, scoreClass, formatVsPar, allocateHandicapStrokes, callawayDeduction, getCallawayAdjustment } from '@/lib/scoring-utils'
export type { HoleResult, PlayerStanding } from '@/lib/scoring-utils'

export async function getLeaderboard(
  tournamentId: string,
  roundId?: string
) {
  const [players, rounds, tournament] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      include: {
        user: { include: { profile: { select: { handicap: true, avatar: true } } } },
        scores: {
          where: roundId ? { roundId } : undefined,
          include: {
            hole: { select: { number: true, par: true, handicap: true } },
            round: { select: { roundNumber: true, courseId: true } },
          },
        },
        playerPowerups: {
          where: { status: 'USED' },
        },
      },
    }),
    prisma.tournamentRound.findMany({
      where: { tournamentId },
      include: { course: { select: { par: true, holes: { select: { number: true, par: true, handicap: true } } } } },
      orderBy: { roundNumber: 'asc' },
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { handicapSystem: true },
    }),
  ])

  const handicapSystem = tournament?.handicapSystem ?? 'WHS'

  const allRoundNumbers = new Set<number>()
  for (const p of players) for (const s of p.scores) allRoundNumbers.add(s.round.roundNumber)
  const todayRoundNumber = allRoundNumbers.size > 0 ? Math.max(...allRoundNumbers) : null

  const standings = players.map((player) => {
    const name = player.user.name ?? player.user.email.split('@')[0]
    const avatarUrl = player.user.profile?.avatar ?? player.user.image ?? null
    const effectiveHandicap = player.handicap || player.user.profile?.handicap || 0

    const grossTotal = player.scores.length > 0
      ? player.scores.reduce((sum, s) => sum + s.strokes, 0)
      : null

    // Par for only the holes actually played (correct for mid-round display)
    const playedPar = player.scores.reduce((sum, s) => sum + s.hole.par, 0)

    const roundTotals: Record<number, number> = {}
    for (const score of player.scores) {
      const rn = score.round.roundNumber
      roundTotals[rn] = (roundTotals[rn] ?? 0) + score.strokes
    }

    const todayTotal = todayRoundNumber !== null ? (roundTotals[todayRoundNumber] ?? null) : null

    let netTotal: number | null = null
    let points: number | null = null
    let netVsPar: number | null = null

    // Apply powerup modifiers to gross BEFORE handicap calculation
    const powerupModifier = player.playerPowerups.reduce(
      (sum: number, pp: { scoreModifier: number | null }) => sum + (pp.scoreModifier ?? 0),
      0,
    )
    const adjustedGross = grossTotal !== null ? grossTotal + powerupModifier : null

    if (adjustedGross !== null) {
      if (handicapSystem === 'NONE') {
        // No handicap — net equals gross
        netTotal = adjustedGross
        netVsPar = adjustedGross - playedPar
      } else if (handicapSystem === 'STABLEFORD') {
        const firstRoundHoles = rounds[0]?.course.holes ?? []
        const strokeSet = allocateHandicapStrokes(effectiveHandicap, firstRoundHoles)
        const holePoints = player.scores.map((s) => {
          const handicapStrokes = strokeSet.has(s.hole.number) ? 1 : 0
          return Math.max(0, 2 + s.hole.par + handicapStrokes - s.strokes)
        })
        points = holePoints.reduce((sum, p) => sum + p, 0)
      } else if (handicapSystem === 'CALLAWAY') {
        const deduction = callawayDeduction(adjustedGross, player.scores.map((s) => ({ strokes: s.strokes, par: s.hole.par, holeNumber: s.hole.number })))
        netTotal = adjustedGross - deduction
        netVsPar = netTotal - playedPar
      } else {
        // For WHS/Peoria: allocate handicap strokes only to played holes
        const firstRoundHoles = rounds[0]?.course.holes ?? []
        const strokeSet = allocateHandicapStrokes(effectiveHandicap, firstRoundHoles)
        const handicapStrokesApplied = player.scores.filter((s) => strokeSet.has(s.hole.number)).length
        netTotal = adjustedGross - handicapStrokesApplied
        netVsPar = netTotal - playedPar
      }
    }

    const grossVsPar = adjustedGross !== null ? adjustedGross - playedPar : null

    return {
      rank: 0,
      tournamentPlayerId: player.id,
      playerName: name,
      avatarUrl,
      handicap: effectiveHandicap,
      holesPlayed: player.scores.length,
      grossTotal,
      netTotal,
      grossVsPar,
      netVsPar,
      todayTotal,
      points,
      roundTotals,
      holes: player.scores.map((s) => ({
        holeNumber: s.hole.number,
        par: s.hole.par,
        strokes: s.strokes,
        diff: s.strokes - s.hole.par,
        roundNumber: s.round.roundNumber,
      })),
    }
  })

  if (handicapSystem === 'STABLEFORD') {
    standings.sort((a, b) => {
      if (a.points === null && b.points === null) return 0
      if (a.points === null) return 1
      if (b.points === null) return -1
      return b.points - a.points
    })
  } else {
    // WHS and Callaway sort by netVsPar; Peoria also netVsPar.
    // Gross-only display (no handicap) falls back to grossVsPar.
    standings.sort((a, b) => {
      const av = a.netVsPar ?? a.grossVsPar
      const bv = b.netVsPar ?? b.grossVsPar
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return av - bv
    })
  }

  let rank = 1
  for (let i = 0; i < standings.length; i++) {
    const getSortVal = (s: typeof standings[0]) =>
      handicapSystem === 'STABLEFORD' ? s.points : (s.netVsPar ?? s.grossVsPar)
    const sortVal = getSortVal(standings[i])
    const prevVal = i > 0 ? getSortVal(standings[i - 1]) : null
    if (i > 0 && sortVal !== prevVal) rank = i + 1
    standings[i].rank = rank
  }

  return standings
}

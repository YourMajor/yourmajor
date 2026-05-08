// Stroke Play strategy — gross + net total strokes; lower wins.
// CLIENT-SAFE — no prisma imports.

import { allocateHandicapStrokes, callawayDeduction, type PlayerStanding } from '@/lib/scoring-utils'
import { cappedPeoriaScore, computePeoriaHandicap } from '@/lib/peoria'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'
import { getHoleHandicapPairs } from './context-helpers'

function playerStanding(ctx: ScoringContext, p: ScoringPlayer): PlayerStanding {
  const grossTotal = p.scores.length > 0
    ? p.scores.reduce((sum, s) => sum + s.strokes, 0)
    : null

  const playedPar = p.scores.reduce((sum, s) => sum + s.par, 0)
  const adjustedGross = grossTotal !== null ? grossTotal + p.scoreModifier : null

  const roundTotals: Record<number, number> = {}
  for (const score of p.scores) {
    roundTotals[score.roundNumber] = (roundTotals[score.roundNumber] ?? 0) + score.strokes
  }
  const todayRound = ctx.rounds.length > 0 ? ctx.rounds[ctx.rounds.length - 1].roundNumber : null
  const todayTotal = todayRound !== null ? roundTotals[todayRound] ?? null : null

  let netTotal: number | null = null
  let netVsPar: number | null = null
  let peoriaRoundDetails: PlayerStanding['peoriaRoundDetails'] = undefined

  if (adjustedGross !== null) {
    if (ctx.handicapSystem === 'NONE') {
      netTotal = adjustedGross
      netVsPar = adjustedGross - playedPar
    } else if (ctx.handicapSystem === 'CALLAWAY') {
      const deduction = callawayDeduction(
        adjustedGross,
        p.scores.map((s) => ({ strokes: s.strokes, par: s.par, holeNumber: s.holeNumber })),
      )
      netTotal = adjustedGross - deduction
      netVsPar = netTotal - playedPar
    } else if (ctx.handicapSystem === 'PEORIA') {
      // Per-round Peoria handicap: only completed rounds (every participant has
      // 18 scores) contribute. While any round is still in progress its 6 secret
      // holes stay hidden and net stays null — that's the whole point of the
      // format. Multi-round events reveal round-by-round as each finishes.
      let totalPeoriaHandicap = 0
      let anyRoundComplete = false
      const details: NonNullable<PlayerStanding['peoriaRoundDetails']> = {}
      for (const r of ctx.rounds) {
        if (!r.complete || !r.peoriaHoles?.length) continue
        anyRoundComplete = true
        const secretSet = new Set(r.peoriaHoles)
        const cappedSum = p.scores
          .filter((s) => s.roundNumber === r.roundNumber && secretSet.has(s.holeNumber))
          .reduce((sum, s) => sum + cappedPeoriaScore(s.strokes, s.par), 0)
        const hc = computePeoriaHandicap(cappedSum, r.par)
        totalPeoriaHandicap += hc
        details[r.roundNumber] = { secretHoles: r.peoriaHoles, peoriaHandicap: hc }
      }
      peoriaRoundDetails = details
      if (anyRoundComplete) {
        netTotal = adjustedGross - totalPeoriaHandicap
        netVsPar = netTotal - playedPar
      }
      // else leave netTotal/netVsPar null → leaderboard's hasNet check hides the column
    } else {
      // WHS / STABLEFORD-as-handicap-system: WHS-style stroke allocation
      const strokeSet = allocateHandicapStrokes(p.handicap, getHoleHandicapPairs(ctx))
      const handicapStrokesApplied = p.scores.filter((s) => strokeSet.has(s.holeNumber)).length
      netTotal = adjustedGross - handicapStrokesApplied
      netVsPar = netTotal - playedPar
    }
  }

  return {
    kind: 'stroke',
    rank: 0,
    tournamentPlayerId: p.tournamentPlayerId,
    playerName: p.name,
    avatarUrl: p.avatarUrl,
    handicap: p.handicap,
    holesPlayed: p.scores.length,
    grossTotal,
    netTotal,
    grossVsPar: adjustedGross !== null ? adjustedGross - playedPar : null,
    netVsPar,
    todayTotal,
    points: null,
    roundTotals,
    holes: p.scores.map((s) => ({
      holeNumber: s.holeNumber,
      par: s.par,
      strokes: s.strokes,
      diff: s.strokes - s.par,
      roundNumber: s.roundNumber,
    })),
    peoriaRoundDetails,
  }
}

export const strokePlayStrategy: FormatStrategy = {
  id: 'STROKE_PLAY',
  computeStandings(ctx) {
    const standings = ctx.players.map((p) => playerStanding(ctx, p))
    standings.sort((a, b) => {
      const av = a.netVsPar ?? a.grossVsPar
      const bv = b.netVsPar ?? b.grossVsPar
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return av - bv
    })
    let rank = 1
    for (let i = 0; i < standings.length; i++) {
      const cur = standings[i].netVsPar ?? standings[i].grossVsPar
      const prev = i > 0 ? (standings[i - 1].netVsPar ?? standings[i - 1].grossVsPar) : null
      if (i > 0 && cur !== prev) rank = i + 1
      standings[i].rank = rank
    }
    return standings
  },
}

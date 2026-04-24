// Stroke Play strategy — gross + net total strokes; lower wins.
// CLIENT-SAFE — no prisma imports.

import { allocateHandicapStrokes, callawayDeduction, type PlayerStanding } from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

function holesArr(ctx: ScoringContext) {
  return ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
}

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
    } else {
      // WHS / PEORIA / STABLEFORD-as-handicap-system: WHS-style stroke allocation
      const strokeSet = allocateHandicapStrokes(p.handicap, holesArr(ctx))
      const handicapStrokesApplied = p.scores.filter((s) => strokeSet.has(s.holeNumber)).length
      netTotal = adjustedGross - handicapStrokesApplied
      netVsPar = netTotal - playedPar
    }
  }

  return {
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

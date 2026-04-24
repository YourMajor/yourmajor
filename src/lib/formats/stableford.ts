// Stableford / Modified Stableford strategy — points per hole; highest wins.

import {
  allocateHandicapStrokes,
  stablefordPoints,
  STABLEFORD_DEFAULT,
  MODIFIED_STABLEFORD_DEFAULT,
  type PlayerStanding,
  type StablefordPointsTable,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

function tableFor(ctx: ScoringContext): StablefordPointsTable {
  const cfg = ctx.formatConfig as { points?: StablefordPointsTable } | null
  if (cfg?.points) return cfg.points
  return ctx.format === 'MODIFIED_STABLEFORD' ? MODIFIED_STABLEFORD_DEFAULT : STABLEFORD_DEFAULT
}

function playerStanding(ctx: ScoringContext, p: ScoringPlayer): PlayerStanding {
  const table = tableFor(ctx)
  const holes = ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
  const strokeSet = ctx.handicapSystem === 'NONE'
    ? new Set<number>()
    : allocateHandicapStrokes(p.handicap, holes)

  let totalPoints = 0
  for (const s of p.scores) {
    const handicapStrokes = strokeSet.has(s.holeNumber) ? 1 : 0
    const diff = s.strokes - (s.par + handicapStrokes)
    totalPoints += stablefordPoints(diff, table)
  }

  const grossTotal = p.scores.length > 0
    ? p.scores.reduce((sum, s) => sum + s.strokes, 0)
    : null
  const playedPar = p.scores.reduce((sum, s) => sum + s.par, 0)

  const roundTotals: Record<number, number> = {}
  for (const score of p.scores) {
    roundTotals[score.roundNumber] = (roundTotals[score.roundNumber] ?? 0) + score.strokes
  }
  const todayRound = ctx.rounds.length > 0 ? ctx.rounds[ctx.rounds.length - 1].roundNumber : null
  const todayTotal = todayRound !== null ? roundTotals[todayRound] ?? null : null

  return {
    rank: 0,
    tournamentPlayerId: p.tournamentPlayerId,
    playerName: p.name,
    avatarUrl: p.avatarUrl,
    handicap: p.handicap,
    holesPlayed: p.scores.length,
    grossTotal,
    netTotal: null,
    grossVsPar: grossTotal !== null ? grossTotal - playedPar : null,
    netVsPar: null,
    todayTotal,
    points: totalPoints,
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

export const stablefordStrategy: FormatStrategy = {
  id: 'STABLEFORD',
  computeStandings(ctx) {
    const standings = ctx.players.map((p) => playerStanding(ctx, p))
    standings.sort((a, b) => {
      const av = a.points
      const bv = b.points
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av   // higher points first
    })
    let rank = 1
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].points !== standings[i - 1].points) rank = i + 1
      standings[i].rank = rank
    }
    return standings
  },
}

export const modifiedStablefordStrategy: FormatStrategy = {
  ...stablefordStrategy,
  id: 'MODIFIED_STABLEFORD',
}

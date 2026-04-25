// Quota Points strategy — earn quota points per hole, beat your handicap-derived target.

import {
  allocateHandicapStrokes,
  quotaPointsFor,
  quotaTarget,
  type PlayerStanding,
  type StablefordPointsTable,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

interface QuotaConfig {
  basePoints?: StablefordPointsTable
  quotaSource?: 'HANDICAP' | 'CUSTOM'
}

function playerStanding(ctx: ScoringContext, p: ScoringPlayer, cfg: QuotaConfig): PlayerStanding {
  const holes = ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
  const strokeSet = ctx.handicapSystem === 'NONE'
    ? new Set<number>()
    : allocateHandicapStrokes(p.handicap, holes)

  let earned = 0
  for (const s of p.scores) {
    const handicapStrokes = strokeSet.has(s.holeNumber) ? 1 : 0
    const diff = s.strokes - (s.par + handicapStrokes)
    earned += quotaPointsFor(diff, cfg.basePoints)
  }
  const target = quotaTarget(p.handicap)
  const overUnder = earned - target

  const grossTotal = p.scores.length > 0
    ? p.scores.reduce((sum, s) => sum + s.strokes, 0)
    : null
  const playedPar = p.scores.reduce((sum, s) => sum + s.par, 0)

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
    todayTotal: null,
    points: overUnder,    // standings rank by margin over quota
    roundTotals: {},
    holes: p.scores.map((s) => ({
      holeNumber: s.holeNumber,
      par: s.par,
      strokes: s.strokes,
      diff: s.strokes - s.par,
      roundNumber: s.roundNumber,
    })),
  }
}

export const quotaStrategy: FormatStrategy = {
  id: 'QUOTA',
  computeStandings(ctx) {
    const cfg = (ctx.formatConfig ?? {}) as QuotaConfig
    const standings = ctx.players.map((p) => playerStanding(ctx, p, cfg))
    standings.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    let rank = 1
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].points !== standings[i - 1].points) rank = i + 1
      standings[i].rank = rank
    }
    return standings
  },
}

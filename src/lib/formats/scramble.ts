// Scramble / Shamble / Chapman / Pinehurst — team formats with a SINGLE team score per hole.
// The team score is whatever any team member entered (we expect organisers to enter one
// score per team per hole; if multiple are entered, we take the lowest as the canonical team score).

import type { PlayerStanding } from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext } from './types'

function buildTeamStanding(
  ctx: ScoringContext,
  team: { id: string; name: string; memberIds: string[] },
): PlayerStanding | null {
  const members = ctx.players.filter((p) => team.memberIds.includes(p.tournamentPlayerId))
  if (members.length === 0) return null

  // Aggregate by (round, hole) — take the lowest member entry as the team score.
  const teamHoles = new Map<string, { strokes: number; par: number; roundNumber: number; holeNumber: number }>()
  for (const m of members) {
    for (const s of m.scores) {
      const k = `${s.roundNumber}:${s.holeNumber}`
      const existing = teamHoles.get(k)
      if (!existing || s.strokes < existing.strokes) {
        teamHoles.set(k, { strokes: s.strokes, par: s.par, roundNumber: s.roundNumber, holeNumber: s.holeNumber })
      }
    }
  }

  const holes = [...teamHoles.values()].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber
    return a.holeNumber - b.holeNumber
  })
  const teamTotal = holes.reduce((sum, h) => sum + h.strokes, 0)
  const playedPar = holes.reduce((sum, h) => sum + h.par, 0)

  // Team handicap allowances vary by exact format; we apply a conservative 0 here and
  // leave nuanced allowances (e.g., 35% × low + 15% × high for 2-person scramble) for a
  // follow-up `formatConfig.handicapAllowance` knob.

  return {
    rank: 0,
    tournamentPlayerId: team.id,
    playerName: team.name,
    avatarUrl: null,
    handicap: 0,
    holesPlayed: holes.length,
    grossTotal: holes.length > 0 ? teamTotal : null,
    netTotal: holes.length > 0 ? teamTotal : null,
    grossVsPar: holes.length > 0 ? teamTotal - playedPar : null,
    netVsPar: holes.length > 0 ? teamTotal - playedPar : null,
    todayTotal: null,
    points: null,
    roundTotals: {},
    holes: holes.map((h) => ({
      holeNumber: h.holeNumber,
      par: h.par,
      strokes: h.strokes,
      diff: h.strokes - h.par,
      roundNumber: h.roundNumber,
    })),
  }
}

function makeStrategy(id: 'SCRAMBLE' | 'SHAMBLE' | 'CHAPMAN' | 'PINEHURST'): FormatStrategy {
  return {
    id,
    computeStandings(ctx) {
      if (ctx.teams.length === 0) return []
      const standings = ctx.teams
        .map((t) => buildTeamStanding(ctx, t))
        .filter((s): s is PlayerStanding => s !== null)

      standings.sort((a, b) => {
        const av = a.grossVsPar
        const bv = b.grossVsPar
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        return av - bv
      })
      let rank = 1
      for (let i = 0; i < standings.length; i++) {
        if (i > 0 && standings[i].grossVsPar !== standings[i - 1].grossVsPar) rank = i + 1
        standings[i].rank = rank
      }
      return standings
    },
  }
}

export const scrambleStrategy = makeStrategy('SCRAMBLE')
export const shambleStrategy = makeStrategy('SHAMBLE')
export const chapmanStrategy = makeStrategy('CHAPMAN')
export const pinehurstStrategy = makeStrategy('PINEHURST')

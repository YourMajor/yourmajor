// Best Ball strategy — team format, per-hole take the lowest team-member score.
// Standings are emitted at TEAM level using the team captain (first member) as the row id;
// `playerName` becomes the team name. Individual member scores are still surfaced via `holes`.

import {
  allocateHandicapStrokes,
  bestBallSelect,
  type PlayerStanding,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

function netStrokesFor(ctx: ScoringContext, p: ScoringPlayer): Map<string, number> {
  // key = `${roundNumber}:${holeNumber}` → net strokes for this player
  const result = new Map<string, number>()
  if (ctx.handicapSystem === 'NONE') {
    for (const s of p.scores) result.set(`${s.roundNumber}:${s.holeNumber}`, s.strokes)
    return result
  }
  const holes = ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
  const strokeSet = allocateHandicapStrokes(p.handicap, holes)
  for (const s of p.scores) {
    const handicapStrokes = strokeSet.has(s.holeNumber) ? 1 : 0
    result.set(`${s.roundNumber}:${s.holeNumber}`, s.strokes - handicapStrokes)
  }
  return result
}

function buildTeamStanding(
  ctx: ScoringContext,
  team: { id: string; name: string; memberIds: string[] },
): PlayerStanding | null {
  const members = ctx.players.filter((p) => team.memberIds.includes(p.tournamentPlayerId))
  if (members.length === 0) return null

  const memberNets = members.map((p) => netStrokesFor(ctx, p))

  // Build hole-by-hole grid
  const holeKeys = new Set<string>()
  for (const m of memberNets) for (const k of m.keys()) holeKeys.add(k)
  const orderedKeys = [...holeKeys].sort((a, b) => {
    const [ar, ah] = a.split(':').map(Number)
    const [br, bh] = b.split(':').map(Number)
    if (ar !== br) return ar - br
    return ah - bh
  })

  const grid = orderedKeys.map((k) => memberNets.map((m) => (m.has(k) ? (m.get(k) ?? null) : null)))
  const teamHoles = bestBallSelect(grid)

  // Effective team total + par played
  let teamTotal = 0
  let playedPar = 0
  let played = 0
  for (let i = 0; i < orderedKeys.length; i++) {
    const v = teamHoles[i]
    if (v === null) continue
    teamTotal += v
    played += 1
    const [, holeNumber] = orderedKeys[i].split(':').map(Number)
    const hole = ctx.holes.find((h) => h.number === holeNumber)
    if (hole) playedPar += hole.par
  }

  return {
    rank: 0,
    tournamentPlayerId: team.id,
    playerName: team.name,
    avatarUrl: null,
    handicap: 0,
    holesPlayed: played,
    grossTotal: played > 0 ? teamTotal : null,
    netTotal: played > 0 ? teamTotal : null,
    grossVsPar: played > 0 ? teamTotal - playedPar : null,
    netVsPar: played > 0 ? teamTotal - playedPar : null,
    todayTotal: null,
    points: null,
    roundTotals: {},
    holes: orderedKeys.map((k, i) => {
      const [roundNumber, holeNumber] = k.split(':').map(Number)
      const hole = ctx.holes.find((h) => h.number === holeNumber)
      const strokes = teamHoles[i]
      return {
        holeNumber,
        par: hole?.par ?? 0,
        strokes,
        diff: strokes !== null && hole ? strokes - hole.par : null,
        roundNumber,
      }
    }),
  }
}

function makeStrategy(id: 'BEST_BALL' | 'BEST_BALL_2' | 'BEST_BALL_4'): FormatStrategy {
  return {
    id,
    computeStandings(ctx) {
      // If teams aren't configured yet, fall back to per-player stroke-play standings
      // so the leaderboard is never blank.
      if (ctx.teams.length === 0) {
        const fallback: PlayerStanding[] = ctx.players.map((p) => {
          const grossTotal = p.scores.length > 0 ? p.scores.reduce((s, x) => s + x.strokes, 0) : null
          const playedPar = p.scores.reduce((s, x) => s + x.par, 0)
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
            points: null,
            roundTotals: {},
            holes: [],
          }
        })
        return fallback
      }

      const standings = ctx.teams
        .map((t) => buildTeamStanding(ctx, t))
        .filter((s): s is PlayerStanding => s !== null)

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
}

export const bestBallStrategy = makeStrategy('BEST_BALL')
export const bestBall2Strategy = makeStrategy('BEST_BALL_2')
export const bestBall4Strategy = makeStrategy('BEST_BALL_4')

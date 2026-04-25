// Match Play / Ryder Cup — bracketed hole-by-hole competition.
// MVP scoring: pairwise standings based on holes won across all played rounds.
// (Bracket / pairing UI is a follow-up; for now we compute a simple "match score" per
// player: holes-won minus holes-lost summed against every other player.)
//
// CLIENT-SAFE — pure functions on ScoringContext.

import type { PlayerStanding } from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringPlayer } from './types'

function holeMap(p: ScoringPlayer): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of p.scores) m.set(`${s.roundNumber}:${s.holeNumber}`, s.strokes)
  return m
}

function pairwiseScore(a: ScoringPlayer, b: ScoringPlayer): { up: number; played: number } {
  const am = holeMap(a)
  const bm = holeMap(b)
  let up = 0
  let played = 0
  const allKeys = new Set<string>([...am.keys(), ...bm.keys()])
  for (const k of allKeys) {
    const av = am.get(k)
    const bv = bm.get(k)
    if (av === undefined || bv === undefined) continue
    played += 1
    if (av < bv) up += 1
    else if (av > bv) up -= 1
  }
  return { up, played }
}

function makeStrategy(id: 'MATCH_PLAY' | 'RYDER_CUP'): FormatStrategy {
  return {
    id,
    computeStandings(ctx) {
      const standings: PlayerStanding[] = ctx.players.map((p) => {
        let totalUp = 0
        let totalPlayed = 0
        for (const opp of ctx.players) {
          if (opp.tournamentPlayerId === p.tournamentPlayerId) continue
          const { up, played } = pairwiseScore(p, opp)
          totalUp += up
          totalPlayed += played
        }
        const grossTotal = p.scores.length > 0 ? p.scores.reduce((s, x) => s + x.strokes, 0) : null
        const playedPar = p.scores.reduce((s, x) => s + x.par, 0)
        return {
          rank: 0,
          tournamentPlayerId: p.tournamentPlayerId,
          playerName: p.name,
          avatarUrl: p.avatarUrl,
          handicap: p.handicap,
          holesPlayed: totalPlayed,
          grossTotal,
          netTotal: null,
          grossVsPar: grossTotal !== null ? grossTotal - playedPar : null,
          netVsPar: null,
          todayTotal: null,
          points: totalUp,
          roundTotals: {},
          holes: p.scores.map((s) => ({
            holeNumber: s.holeNumber,
            par: s.par,
            strokes: s.strokes,
            diff: s.strokes - s.par,
            roundNumber: s.roundNumber,
          })),
        }
      })

      standings.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      let rank = 1
      for (let i = 0; i < standings.length; i++) {
        if (i > 0 && standings[i].points !== standings[i - 1].points) rank = i + 1
        standings[i].rank = rank
      }
      return standings
    },
  }
}

export const matchPlayStrategy = makeStrategy('MATCH_PLAY')
export const ryderCupStrategy = makeStrategy('RYDER_CUP')

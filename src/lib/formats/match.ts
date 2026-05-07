// Match Play / Ryder Cup — head-to-head hole-by-hole.
//
// Phase 2a behaviour: pairings are auto-generated as all-pairs (each player
// vs every other player). Per-pair status (live/AS/dormie/closed/final) is
// derived from the actual hole-by-hole comparison via `matchPlayStatus`.
// Conceded holes (Score.conceded) flip to "opponent wins this hole regardless
// of strokes". Each row aggregates W-L-H across that player's matches.
//
// Phase 2b will replace the all-pairs derivation with explicit pairings read
// from a Match table. Strategy stays a pure function on ScoringContext.
//
// CLIENT-SAFE — pure functions on ScoringContext.

import {
  matchPlayStatus,
  type MatchRecord,
  type MatchStatus,
  type PlayerStanding,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringPlayer, ScoringContext } from './types'

interface HoleEntry { strokes: number; conceded: boolean }

function holeMap(p: ScoringPlayer): Map<string, HoleEntry> {
  const m = new Map<string, HoleEntry>()
  for (const s of p.scores) m.set(`${s.roundNumber}:${s.holeNumber}`, {
    strokes: s.strokes,
    conceded: s.conceded ?? false,
  })
  return m
}

interface PairwiseResult {
  record: MatchRecord
  holesUp: number
  through: number
  status: MatchStatus
}

function pairwise(
  a: ScoringPlayer,
  b: ScoringPlayer,
  totalHoles: number,
): PairwiseResult {
  const am = holeMap(a)
  const bm = holeMap(b)
  // Walk hole-by-hole in chronological order so dormie / closed status reflects
  // the *order* the holes were actually played.
  const allKeys = [...new Set<string>([...am.keys(), ...bm.keys()])].sort((x, y) => {
    const [xr, xh] = x.split(':').map(Number)
    const [yr, yh] = y.split(':').map(Number)
    if (xr !== yr) return xr - yr
    return xh - yh
  })

  const winners: number[] = []
  let won = 0
  let lost = 0
  let halved = 0
  for (const k of allKeys) {
    const av = am.get(k)
    const bv = bm.get(k)
    if (av === undefined || bv === undefined) continue   // both must have a row to score the hole
    let w: number
    if (av.conceded && bv.conceded) {
      // Both conceded — halved by convention.
      w = 0
      halved += 1
    } else if (av.conceded) {
      w = -1
      lost += 1
    } else if (bv.conceded) {
      w = 1
      won += 1
    } else if (av.strokes < bv.strokes) {
      w = 1
      won += 1
    } else if (av.strokes > bv.strokes) {
      w = -1
      lost += 1
    } else {
      w = 0
      halved += 1
    }
    winners.push(w)
  }
  const status = matchPlayStatus(winners, totalHoles)
  return {
    record: { won, lost, halved },
    holesUp: status.up,
    through: status.through,
    status: status.status,
  }
}

function makeStrategy(id: 'MATCH_PLAY' | 'RYDER_CUP'): FormatStrategy {
  return {
    id,
    computeStandings(ctx: ScoringContext) {
      // Total holes scheduled across all rounds. A heads-up match across two
      // rounds caps at 36; a single 18-hole match caps at 18.
      const totalHoles = (ctx.rounds.length || 1) * 18

      const standings: PlayerStanding[] = ctx.players.map((p) => {
        const opponents = ctx.players.filter((opp) => opp.tournamentPlayerId !== p.tournamentPlayerId)
        let aggUp = 0
        let aggThrough = 0
        let totalWon = 0
        let totalLost = 0
        let totalHalved = 0
        // Headline status: when a player has exactly one opponent, that match
        // *is* the headline. Otherwise pick the most decisive ongoing match
        // (largest |up|), preferring closed > dormie > live > AS > final.
        let headline: PairwiseResult | null = null
        let headlineOpponentId: string | undefined

        for (const opp of opponents) {
          const r = pairwise(p, opp, totalHoles)
          aggUp += r.holesUp
          aggThrough += r.through
          totalWon += r.record.won
          totalLost += r.record.lost
          totalHalved += r.record.halved
          if (!headline || rankStatus(r.status) > rankStatus(headline.status) ||
              (rankStatus(r.status) === rankStatus(headline.status) && Math.abs(r.holesUp) > Math.abs(headline.holesUp))) {
            headline = r
            headlineOpponentId = opp.tournamentPlayerId
          }
        }

        const grossTotal = p.scores.length > 0 ? p.scores.reduce((s, x) => s + x.strokes, 0) : null
        const playedPar = p.scores.reduce((s, x) => s + x.par, 0)
        const isHeadsUp = opponents.length === 1
        return {
          kind: 'match',
          rank: 0,
          tournamentPlayerId: p.tournamentPlayerId,
          playerName: p.name,
          avatarUrl: p.avatarUrl,
          handicap: p.handicap,
          holesPlayed: aggThrough,
          grossTotal,
          netTotal: null,
          grossVsPar: grossTotal !== null ? grossTotal - playedPar : null,
          netVsPar: null,
          todayTotal: null,
          points: aggUp,
          matchRecord: { won: totalWon, lost: totalLost, halved: totalHalved },
          holesUp: isHeadsUp && headline ? headline.holesUp : aggUp,
          through: isHeadsUp && headline ? headline.through : aggThrough,
          matchStatus: headline?.status,
          opponentId: isHeadsUp ? headlineOpponentId : undefined,
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

      // Sort: most-decisive lead first (matches the prior cross-field
      // surrogate's intent). Tiebreak by individual record.won.
      standings.sort((a, b) => {
        const ap = a.points ?? 0
        const bp = b.points ?? 0
        if (ap !== bp) return bp - ap
        return (b.matchRecord?.won ?? 0) - (a.matchRecord?.won ?? 0)
      })
      let rank = 1
      for (let i = 0; i < standings.length; i++) {
        if (i > 0 && standings[i].points !== standings[i - 1].points) rank = i + 1
        standings[i].rank = rank
      }
      return standings
    },
  }
}

// Headline-status preference when picking the "match of record" for >2-player events.
function rankStatus(s: MatchStatus): number {
  switch (s) {
    case 'closed': return 5
    case 'dormie': return 4
    case 'live':   return 3
    case 'AS':     return 2
    case 'final':  return 1
  }
}

export const matchPlayStrategy = makeStrategy('MATCH_PLAY')
export const ryderCupStrategy = makeStrategy('RYDER_CUP')

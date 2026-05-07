// Nassau — three sub-matches per pair: front 9, back 9, overall 18.
//
// Each sub-match is its own match-play scoreboard, computed independently
// from the same hole-by-hole stroke comparison. Closing the front 9 does
// NOT close the back 9 — the back is a separate bet.
//
// Phase 5 v1: pairings derived as all-pairs (matching match.ts behaviour).
// Presses are explicitly out of scope.
//
// CLIENT-SAFE — pure functions on ScoringContext.

import {
  matchPlayStatus,
  type PlayerStanding,
  type MatchStatus,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

interface HoleEntry { strokes: number; conceded: boolean }

function holeMap(p: ScoringPlayer): Map<string, HoleEntry> {
  const m = new Map<string, HoleEntry>()
  for (const s of p.scores) m.set(`${s.roundNumber}:${s.holeNumber}`, {
    strokes: s.strokes,
    conceded: s.conceded ?? false,
  })
  return m
}

interface SubMatch { holesUp: number; thru: number; status: MatchStatus }

/**
 * Walks the hole list in order and returns the per-hole winner +1/-1/0 from
 * A's perspective, treating concedes as a loss for the conceding side.
 */
function holeWinnersAvsB(am: Map<string, HoleEntry>, bm: Map<string, HoleEntry>, keys: string[]): number[] {
  const winners: number[] = []
  for (const k of keys) {
    const av = am.get(k)
    const bv = bm.get(k)
    if (av === undefined || bv === undefined) continue
    if (av.conceded && bv.conceded) winners.push(0)
    else if (av.conceded) winners.push(-1)
    else if (bv.conceded) winners.push(1)
    else if (av.strokes < bv.strokes) winners.push(1)
    else if (av.strokes > bv.strokes) winners.push(-1)
    else winners.push(0)
  }
  return winners
}

/** Sort hole keys by (round asc, hole asc). */
function orderedHoleKeys(am: Map<string, HoleEntry>, bm: Map<string, HoleEntry>): string[] {
  return [...new Set<string>([...am.keys(), ...bm.keys()])].sort((x, y) => {
    const [xr, xh] = x.split(':').map(Number)
    const [yr, yh] = y.split(':').map(Number)
    if (xr !== yr) return xr - yr
    return xh - yh
  })
}

function nassauMatchupVs(a: ScoringPlayer, b: ScoringPlayer): { front: SubMatch; back: SubMatch; overall: SubMatch } {
  const am = holeMap(a)
  const bm = holeMap(b)
  const allKeys = orderedHoleKeys(am, bm)

  // Slice keys into front-9 (holeNumber 1..9) and back-9 (10..18).
  // For multi-round Nassau, front/back repeat per round; we aggregate across all rounds.
  const frontKeys = allKeys.filter((k) => {
    const hole = Number(k.split(':')[1])
    return hole >= 1 && hole <= 9
  })
  const backKeys = allKeys.filter((k) => {
    const hole = Number(k.split(':')[1])
    return hole >= 10 && hole <= 18
  })

  // Sub-match totals scale with rounds: a 1-round Nassau has 9-hole front/back
  // and 18-hole overall; a 2-round Nassau has 18-hole front/back/overall × 2 etc.
  const roundsSeen = new Set<number>([...allKeys.map((k) => Number(k.split(':')[0]))])
  const rounds = Math.max(1, roundsSeen.size)

  const frontWinners = holeWinnersAvsB(am, bm, frontKeys)
  const backWinners = holeWinnersAvsB(am, bm, backKeys)
  const overallWinners = holeWinnersAvsB(am, bm, allKeys)

  const front = matchPlayStatus(frontWinners, 9 * rounds)
  const back = matchPlayStatus(backWinners, 9 * rounds)
  const overall = matchPlayStatus(overallWinners, 18 * rounds)

  return {
    front: { holesUp: front.up, thru: front.through, status: front.status },
    back: { holesUp: back.up, thru: back.through, status: back.status },
    overall: { holesUp: overall.up, thru: overall.through, status: overall.status },
  }
}

export const nassauStrategy: FormatStrategy = {
  id: 'NASSAU',
  computeStandings(ctx: ScoringContext) {
    const standings: PlayerStanding[] = ctx.players.map((p) => {
      const opponents = ctx.players.filter((opp) => opp.tournamentPlayerId !== p.tournamentPlayerId)

      // Aggregate: sum each sub-match's holesUp across opponents. For a 2-player
      // Nassau there's only one opponent, so each sub-match is exactly one bet.
      let frontUp = 0, frontThru = 0, backUp = 0, backThru = 0, overallUp = 0, overallThru = 0
      for (const opp of opponents) {
        const m = nassauMatchupVs(p, opp)
        frontUp += m.front.holesUp;     frontThru = Math.max(frontThru, m.front.thru)
        backUp += m.back.holesUp;       backThru = Math.max(backThru, m.back.thru)
        overallUp += m.overall.holesUp; overallThru = Math.max(overallThru, m.overall.thru)
      }

      const grossTotal = p.scores.length > 0 ? p.scores.reduce((s, x) => s + x.strokes, 0) : null
      const playedPar = p.scores.reduce((s, x) => s + x.par, 0)

      return {
        kind: 'nassau',
        rank: 0,
        tournamentPlayerId: p.tournamentPlayerId,
        playerName: p.name,
        avatarUrl: p.avatarUrl,
        handicap: p.handicap,
        holesPlayed: overallThru,
        grossTotal,
        netTotal: null,
        grossVsPar: grossTotal !== null ? grossTotal - playedPar : null,
        netVsPar: null,
        todayTotal: null,
        // points encodes overall holesUp for backward-compat sort.
        points: overallUp,
        front: { holesUp: frontUp, thru: frontThru },
        back: { holesUp: backUp, thru: backThru },
        overall: { holesUp: overallUp, thru: overallThru },
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

    // Rank: overall first, then back, then front (per the plan's tie-break order).
    standings.sort((a, b) => {
      const ao = a.overall?.holesUp ?? 0
      const bo = b.overall?.holesUp ?? 0
      if (ao !== bo) return bo - ao
      const ab = a.back?.holesUp ?? 0
      const bb = b.back?.holesUp ?? 0
      if (ab !== bb) return bb - ab
      return (b.front?.holesUp ?? 0) - (a.front?.holesUp ?? 0)
    })
    let rank = 1
    for (let i = 0; i < standings.length; i++) {
      if (i > 0) {
        const prev = standings[i - 1]
        const cur = standings[i]
        const same = (prev.overall?.holesUp ?? 0) === (cur.overall?.holesUp ?? 0)
          && (prev.back?.holesUp ?? 0) === (cur.back?.holesUp ?? 0)
          && (prev.front?.holesUp ?? 0) === (cur.front?.holesUp ?? 0)
        if (!same) rank = i + 1
      }
      standings[i].rank = rank
    }
    return standings
  },
}

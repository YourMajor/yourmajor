// Pure season-tiebreaker logic — CLIENT-SAFE, no prisma imports.

export interface EventResult {
  tournamentId: string
  tournamentSlug: string
  tournamentName: string
  date: string | null
  rank: number
  grossVsPar: number | null
  netVsPar: number | null
  points: number | null
  grossTotal: number | null
  netTotal: number | null
}

export interface SeasonPlayerSummary {
  userId: string
  playerName: string
  avatarUrl: string | null
  eventsPlayed: number
  totalEvents: number
  /** Primary sort value — meaning depends on scoring method */
  value: number
  eventResults: EventResult[]
  /** Rank change vs previous event: positive = moved up, negative = moved down, 0 = unchanged, null = new */
  trend: number | null
  rank: number
}

export type Tiebreaker = 'HEAD_TO_HEAD' | 'BEST_FINISH' | 'COUNTBACK' | 'LOW_STROKES'

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ['BEST_FINISH', 'COUNTBACK', 'LOW_STROKES']

export function parseTiebreakers(raw: unknown): Tiebreaker[] {
  if (!Array.isArray(raw)) return DEFAULT_TIEBREAKERS
  const valid: Tiebreaker[] = []
  for (const v of raw) {
    if (v === 'HEAD_TO_HEAD' || v === 'BEST_FINISH' || v === 'COUNTBACK' || v === 'LOW_STROKES') {
      valid.push(v)
    }
  }
  return valid.length > 0 ? valid : DEFAULT_TIEBREAKERS
}

export function compareTiebreaker(
  rule: Tiebreaker,
  a: SeasonPlayerSummary,
  b: SeasonPlayerSummary,
): number {
  switch (rule) {
    case 'BEST_FINISH': {
      const aBest = a.eventResults.length > 0 ? Math.min(...a.eventResults.map((r) => r.rank)) : Infinity
      const bBest = b.eventResults.length > 0 ? Math.min(...b.eventResults.map((r) => r.rank)) : Infinity
      return aBest - bBest // lower (better) finish ranks higher
    }
    case 'COUNTBACK': {
      // Walk most-recent → oldest, return as soon as one player beats the other.
      const aSorted = [...a.eventResults].sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''))
      const bSorted = [...b.eventResults].sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''))
      const len = Math.min(aSorted.length, bSorted.length)
      for (let i = 0; i < len; i++) {
        const av = aSorted[i].netVsPar ?? aSorted[i].grossVsPar ?? aSorted[i].rank
        const bv = bSorted[i].netVsPar ?? bSorted[i].grossVsPar ?? bSorted[i].rank
        if (av !== bv) return av - bv
      }
      return 0
    }
    case 'LOW_STROKES': {
      const aTotal = a.eventResults.reduce((sum, r) => sum + (r.grossTotal ?? 0), 0)
      const bTotal = b.eventResults.reduce((sum, r) => sum + (r.grossTotal ?? 0), 0)
      return aTotal - bTotal
    }
    case 'HEAD_TO_HEAD': {
      const aResults = new Map(a.eventResults.map((r) => [r.tournamentId, r.rank]))
      const bResults = new Map(b.eventResults.map((r) => [r.tournamentId, r.rank]))
      let aWins = 0
      let bWins = 0
      for (const [tournamentId, aRank] of aResults) {
        const bRank = bResults.get(tournamentId)
        if (bRank === undefined) continue
        if (aRank < bRank) aWins += 1
        else if (bRank < aRank) bWins += 1
      }
      return bWins - aWins // more wins → ranks higher
    }
  }
}

export function compareWithTiebreakers(
  a: SeasonPlayerSummary,
  b: SeasonPlayerSummary,
  primary: number,
  tiebreakers: Tiebreaker[],
): number {
  if (primary !== 0) return primary
  for (const rule of tiebreakers) {
    const cmp = compareTiebreaker(rule, a, b)
    if (cmp !== 0) return cmp
  }
  return 0
}

/**
 * Drop the lowest-N entries from a list, preserving the original ordering of the kept entries.
 * Used for season `dropLowest` semantics where the entries themselves are points/scores.
 */
export function dropLowestN(values: number[], n: number, higherIsBetter: boolean): number[] {
  if (n <= 0 || values.length <= n) return values.length <= n ? [] : values
  // Pair with original index so we can preserve order after removing the lowest-N.
  const indexed = values.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => (higherIsBetter ? a.v - b.v : b.v - a.v))
  const drop = new Set(indexed.slice(0, n).map((e) => e.i))
  return values.filter((_, i) => !drop.has(i))
}

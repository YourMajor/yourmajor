// Low Gross / Low Net combined — emit a single ranking that surfaces both gross
// and net. Each row carries `grossRank` and `netRank` so the leaderboard can
// crown two winners (the gross champion AND the net champion).
//
// Phase 6: replaces the prior delegating-stub implementation that showed only
// stroke-play standings.

import { strokePlayStrategy } from './strokePlay'
import type { FormatStrategy, ScoringContext } from './types'
import type { PlayerStanding } from '@/lib/scoring-utils'

function rankOn(
  standings: PlayerStanding[],
  key: 'grossVsPar' | 'netVsPar',
): Map<string, number> {
  const ranked = [...standings].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return av - bv
  })
  const result = new Map<string, number>()
  let rank = 1
  for (let i = 0; i < ranked.length; i++) {
    const cur = ranked[i][key]
    const prev = i > 0 ? ranked[i - 1][key] : null
    if (i > 0 && cur !== prev) rank = i + 1
    result.set(ranked[i].tournamentPlayerId, rank)
  }
  return result
}

export const lowGrossLowNetStrategy: FormatStrategy = {
  id: 'LOW_GROSS_LOW_NET',
  computeStandings(ctx: ScoringContext) {
    // Reuse stroke-play computation for grossTotal / netTotal / grossVsPar /
    // netVsPar / etc. Then layer dual gross+net ranks on top and re-tag kind.
    const base = strokePlayStrategy.computeStandings(ctx)
    const grossRanks = rankOn(base, 'grossVsPar')
    const netRanks = rankOn(base, 'netVsPar')

    const standings: PlayerStanding[] = base.map((s) => ({
      ...s,
      kind: 'low-gross-net',
      grossRank: grossRanks.get(s.tournamentPlayerId) ?? 0,
      netRank: netRanks.get(s.tournamentPlayerId) ?? 0,
    }))

    // Sort by NET (the leader of a combined event by convention is the
    // net winner). Tiebreak by gross. The row component shows both columns.
    standings.sort((a, b) => {
      const an = a.netVsPar
      const bn = b.netVsPar
      if (an === null && bn === null) {
        // Fall through to gross.
      } else if (an === null) {
        return 1
      } else if (bn === null) {
        return -1
      } else if (an !== bn) {
        return an - bn
      }
      const ag = a.grossVsPar
      const bg = b.grossVsPar
      if (ag === null && bg === null) return 0
      if (ag === null) return 1
      if (bg === null) return -1
      return ag - bg
    })

    let rank = 1
    for (let i = 0; i < standings.length; i++) {
      if (i > 0) {
        const prev = standings[i - 1]
        const cur = standings[i]
        if (prev.netVsPar !== cur.netVsPar || prev.grossVsPar !== cur.grossVsPar) rank = i + 1
      }
      standings[i].rank = rank
    }
    return standings
  },
}

// Skins strategy — gross or net; per-hole, lowest unique strokes wins; ties carry over.

import {
  allocateHandicapStrokes,
  skinsPerHole,
  type PlayerStanding,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'

interface SkinsConfig {
  carryOver?: boolean
  valuePerSkin?: number
}

function buildHoleScores(ctx: ScoringContext, useNet: boolean) {
  // Group scores by (roundNumber, holeNumber); each hole is one skin.
  const buckets = new Map<string, Array<{ tournamentPlayerId: string; strokes: number | null }>>()
  const playerStrokeSet = new Map<string, Set<number>>()
  if (useNet) {
    const holes = ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
    for (const p of ctx.players) {
      playerStrokeSet.set(p.tournamentPlayerId, allocateHandicapStrokes(p.handicap, holes))
    }
  }

  for (const p of ctx.players) {
    for (const s of p.scores) {
      const key = `${s.roundNumber}:${s.holeNumber}`
      let strokes: number = s.strokes
      if (useNet) {
        const hsSet = playerStrokeSet.get(p.tournamentPlayerId)
        if (hsSet?.has(s.holeNumber)) strokes -= 1
      }
      const bucket = buckets.get(key) ?? []
      bucket.push({ tournamentPlayerId: p.tournamentPlayerId, strokes })
      buckets.set(key, bucket)
    }
  }

  // Order buckets by roundNumber asc, then holeNumber asc, so carry-over flows correctly.
  const ordered = [...buckets.entries()]
    .sort((a, b) => {
      const [ar, ah] = a[0].split(':').map(Number)
      const [br, bh] = b[0].split(':').map(Number)
      if (ar !== br) return ar - br
      return ah - bh
    })
    .map(([, v]) => v)
  return ordered
}

function buildStandings(ctx: ScoringContext, wins: Record<string, number>, valuePerSkin: number) {
  const standings: PlayerStanding[] = ctx.players.map((p: ScoringPlayer) => {
    const grossTotal = p.scores.length > 0
      ? p.scores.reduce((sum, s) => sum + s.strokes, 0)
      : null
    const playedPar = p.scores.reduce((sum, s) => sum + s.par, 0)
    const skins = wins[p.tournamentPlayerId] ?? 0
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
      points: skins * valuePerSkin,
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
}

function makeStrategy(useNet: boolean, id: 'SKINS' | 'SKINS_GROSS' | 'SKINS_NET'): FormatStrategy {
  return {
    id,
    computeStandings(ctx) {
      const cfg = (ctx.formatConfig ?? {}) as SkinsConfig
      const carryOver = cfg.carryOver ?? true
      const valuePerSkin = cfg.valuePerSkin ?? 1
      const ordered = buildHoleScores(ctx, useNet)
      const wins = skinsPerHole(ordered, carryOver)
      return buildStandings(ctx, wins, valuePerSkin)
    },
  }
}

export const skinsGrossStrategy = makeStrategy(false, 'SKINS_GROSS')
export const skinsNetStrategy = makeStrategy(true, 'SKINS_NET')
// Legacy SKINS alias defaults to gross.
export const skinsStrategy = makeStrategy(false, 'SKINS')

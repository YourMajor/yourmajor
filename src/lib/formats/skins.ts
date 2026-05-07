// Skins strategy — gross or net; per-hole, lowest unique strokes wins; ties carry over.

import {
  allocateHandicapStrokes,
  skinsPerHole,
  type PlayerStanding,
  type SkinsHoleInput,
  type SkinsHoleAttribution,
  type SkinsHoleOutcome,
} from '@/lib/scoring-utils'
import type { FormatStrategy, ScoringContext, ScoringPlayer } from './types'
import { getHoleHandicapPairs } from './context-helpers'

interface SkinsConfig {
  carryOver?: boolean
  valuePerSkin?: number
}

function buildHoleInputs(ctx: ScoringContext, useNet: boolean): SkinsHoleInput[] {
  const buckets = new Map<string, SkinsHoleInput>()
  const playerStrokeSet = new Map<string, Set<number>>()
  if (useNet) {
    const holes = getHoleHandicapPairs(ctx)
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
      const bucket = buckets.get(key) ?? { round: s.roundNumber, hole: s.holeNumber, scores: [] }
      bucket.scores.push({ tournamentPlayerId: p.tournamentPlayerId, strokes })
      buckets.set(key, bucket)
    }
  }

  // Order by roundNumber asc, then holeNumber asc, so carry-over flows correctly.
  return [...buckets.values()].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round
    return a.hole - b.hole
  })
}

function attributionsForPlayer(
  outcomes: SkinsHoleOutcome[],
  playerId: string,
): SkinsHoleAttribution[] {
  return outcomes
    .filter((o) => o.winnerId === playerId)
    .map((o) => ({ round: o.round, hole: o.hole, carryover: o.skinsAwarded }))
}

// Skins waiting on the next hole. After the last outcome, if the winner was
// null (tie) the trailing carry equals carryEntering + 1 (the +1 from this
// tied hole that didn't claim). After a winning hole, carry is 0.
function trailingCarryoverOf(outcomes: SkinsHoleOutcome[]): number {
  if (outcomes.length === 0) return 0
  const last = outcomes[outcomes.length - 1]
  return last.winnerId === null ? last.carryEntering + 1 : 0
}

function buildStandings(
  ctx: ScoringContext,
  wins: Record<string, number>,
  outcomes: SkinsHoleOutcome[],
  valuePerSkin: number,
) {
  const trailing = trailingCarryoverOf(outcomes)
  const standings: PlayerStanding[] = ctx.players.map((p: ScoringPlayer) => {
    const grossTotal = p.scores.length > 0
      ? p.scores.reduce((sum, s) => sum + s.strokes, 0)
      : null
    const playedPar = p.scores.reduce((sum, s) => sum + s.par, 0)
    const skins = wins[p.tournamentPlayerId] ?? 0
    return {
      kind: 'skins',
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
      skinsWon: skins,
      skinsValue: valuePerSkin,
      skinsHoles: attributionsForPlayer(outcomes, p.tournamentPlayerId),
      skinsTrailingCarryover: trailing,
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
      const ordered = buildHoleInputs(ctx, useNet)
      const { wins, outcomes } = skinsPerHole(ordered, carryOver)
      return buildStandings(ctx, wins, outcomes, valuePerSkin)
    },
  }
}

export const skinsGrossStrategy = makeStrategy(false, 'SKINS_GROSS')
export const skinsNetStrategy = makeStrategy(true, 'SKINS_NET')
// Legacy SKINS alias defaults to gross.
export const skinsStrategy = makeStrategy(false, 'SKINS')

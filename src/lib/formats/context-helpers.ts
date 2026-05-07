// Per-context derived views, memoized for the lifetime of a ScoringContext.
// CLIENT-SAFE — no prisma/pg imports.
//
// Format strategies all need the same two views over `ctx.holes`:
//   1. A Map<number, ScoringHole> for O(1) lookup by hole number (replaces .find).
//   2. An Array<{number, handicap}> for `allocateHandicapStrokes`, which is
//      called once per player.
//
// Building these inside each strategy (or once per player) was O(N×18); doing
// it once per leaderboard is O(18). The WeakMap keys on the ctx instance, so
// repeated calls within one render reuse the same derived objects.

import type { ScoringContext, ScoringHole } from './types'

const holeMapCache = new WeakMap<ScoringContext, Map<number, ScoringHole>>()
const holeHandicapPairsCache = new WeakMap<
  ScoringContext,
  Array<{ number: number; handicap: number | null }>
>()

export function getHoleMap(ctx: ScoringContext): Map<number, ScoringHole> {
  let m = holeMapCache.get(ctx)
  if (!m) {
    m = new Map(ctx.holes.map((h) => [h.number, h]))
    holeMapCache.set(ctx, m)
  }
  return m
}

export function getHoleHandicapPairs(
  ctx: ScoringContext,
): Array<{ number: number; handicap: number | null }> {
  let arr = holeHandicapPairsCache.get(ctx)
  if (!arr) {
    arr = ctx.holes.map((h) => ({ number: h.number, handicap: h.handicap }))
    holeHandicapPairsCache.set(ctx, arr)
  }
  return arr
}

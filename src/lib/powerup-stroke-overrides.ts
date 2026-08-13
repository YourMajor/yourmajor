/**
 * Powerup stroke overrides — three cards replace a player's recorded strokes
 * on a specific hole rather than modifying the net score:
 *
 *   • can-i-get-your-number → strokes become metadata.numberValue, which must
 *     be a legal hole score (see isValidStrokeOverrideValue).
 *   • concede               → if GIR on the activation hole, strokes become par - 1.
 *   • parent-trap           → activator's and target's strokes on the hole are swapped.
 *
 * No schema changes needed; everything is derived from existing PlayerPowerup
 * fields plus the live Score data.
 */

import { prisma } from '@/lib/prisma'

/** The one override slug whose replacement stroke count comes from the body. */
export const NUMBER_OVERRIDE_SLUG = 'can-i-get-your-number'

const OVERRIDE_SLUGS = [NUMBER_OVERRIDE_SLUG, 'concede', 'parent-trap'] as const

/**
 * A stroke count this engine is willing to write over a recorded score. Same
 * bound the scores API enforces for a hand-entered hole score
 * (src/app/api/scores/route.ts: integer 1–20), because that is exactly what
 * this value becomes on the leaderboard.
 */
export const MIN_OVERRIDE_STROKES = 1
export const MAX_OVERRIDE_STROKES = 20

export function isValidStrokeOverrideValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_OVERRIDE_STROKES &&
    value <= MAX_OVERRIDE_STROKES
  )
}

export interface ScoreInput {
  tournamentPlayerId: string
  holeNumber: number
  par: number
  strokes: number
  gir: boolean | null
}

/**
 * Build a map keyed by `${tournamentPlayerId}:${holeNumber}` → effective stroke
 * count for any (player, hole) pair whose score is replaced by a powerup.
 *
 * Pass in the union of scores needed by the consumer (leaderboard: every
 * player's scores; per-player view: that player + any swap counterparties).
 * Missing counterparty data degrades gracefully — Parent Trap only swaps when
 * both sides' scores are present.
 */
export async function buildStrokeOverrideMap(
  tournamentId: string,
  scores: ScoreInput[],
  roundId?: string | null,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()

  const overrides = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayer: { tournamentId },
      status: 'USED',
      powerup: { slug: { in: [...OVERRIDE_SLUGS] } },
      ...(roundId ? { roundId } : {}),
      holeNumber: { not: null },
    },
    select: {
      tournamentPlayerId: true,
      targetPlayerId: true,
      holeNumber: true,
      metadata: true,
      powerup: { select: { slug: true } },
    },
  })

  if (overrides.length === 0) return map

  const scoreLookup = new Map<string, ScoreInput>()
  for (const s of scores) {
    scoreLookup.set(`${s.tournamentPlayerId}:${s.holeNumber}`, s)
  }

  for (const ov of overrides) {
    if (ov.holeNumber === null) continue
    const slug = ov.powerup.slug
    const aKey = `${ov.tournamentPlayerId}:${ov.holeNumber}`

    if (slug === NUMBER_OVERRIDE_SLUG) {
      const num = (ov.metadata as { numberValue?: unknown } | null)?.numberValue
      // Rows written before the activation route validated this could hold any
      // number at all. Ignore an out-of-range one — the player's recorded
      // strokes stand — rather than replacing their score with it.
      if (isValidStrokeOverrideValue(num)) {
        map.set(aKey, num)
      }
    } else if (slug === 'concede') {
      const score = scoreLookup.get(aKey)
      if (score?.gir === true) {
        map.set(aKey, score.par - 1)
      }
    } else if (slug === 'parent-trap') {
      if (!ov.targetPlayerId) continue
      const tKey = `${ov.targetPlayerId}:${ov.holeNumber}`
      const a = scoreLookup.get(aKey)
      const t = scoreLookup.get(tKey)
      if (a && t) {
        map.set(aKey, t.strokes)
        map.set(tKey, a.strokes)
      }
    }
  }

  return map
}

/** Convenience accessor — returns effective strokes for a (tpId, holeNumber). */
export function effectiveStrokes(
  map: Map<string, number>,
  tournamentPlayerId: string,
  holeNumber: number,
  fallback: number,
): number {
  return map.get(`${tournamentPlayerId}:${holeNumber}`) ?? fallback
}

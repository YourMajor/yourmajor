/**
 * Powerup stroke overrides — three cards replace a player's recorded strokes
 * on a specific hole rather than modifying the net score:
 *
 *   • can-i-get-your-number → strokes become metadata.numberValue (1–10).
 *   • concede               → if GIR on the activation hole, strokes become par - 1.
 *   • parent-trap           → activator's and target's strokes on the hole are swapped.
 *
 * No schema changes needed; everything is derived from existing PlayerPowerup
 * fields plus the live Score data.
 */

import { prisma } from '@/lib/prisma'

const OVERRIDE_SLUGS = ['can-i-get-your-number', 'concede', 'parent-trap'] as const

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

    if (slug === 'can-i-get-your-number') {
      const num = (ov.metadata as { numberValue?: number } | null)?.numberValue
      if (typeof num === 'number' && Number.isFinite(num)) {
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

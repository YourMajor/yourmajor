/**
 * Powerup stroke overrides — three cards replace a player's recorded strokes
 * on a specific hole rather than modifying the net score:
 *
 *   • can-i-get-your-number → strokes become metadata.numberValue, which must
 *     be a legal hole score (see isValidStrokeOverrideValue).
 *   • concede               → if GIR on the activation hole, strokes become par - 1.
 *   • parent-trap           → activator's and target's strokes on the activation
 *     hole are swapped — but only once BOTH players have scored every hole of
 *     that round. Until then the leaderboard shows real scores; the swap lands
 *     at the end of the round. The target can be anyone, whether or not they've
 *     already played that hole.
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
      roundId: true,
      holeNumber: true,
      metadata: true,
      powerup: { select: { slug: true } },
    },
  })

  if (overrides.length === 0) return map

  const roundFinished = await loadRoundCompletion(overrides)

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
      // Legacy rows without a roundId keep the old swap-when-both-scored rule.
      if (
        ov.roundId &&
        !(roundFinished(ov.tournamentPlayerId, ov.roundId) && roundFinished(ov.targetPlayerId, ov.roundId))
      ) {
        continue
      }
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

/**
 * For Parent Trap rows, work out which (player, round) pairs have a score on
 * every hole of that round's course. Read straight from the DB rather than
 * the caller's `scores`, which may be scoped to a single player or round.
 */
async function loadRoundCompletion(
  overrides: Array<{ tournamentPlayerId: string; targetPlayerId: string | null; roundId: string | null; powerup: { slug: string } }>,
): Promise<(tournamentPlayerId: string, roundId: string) => boolean> {
  const swaps = overrides.filter((o) => o.powerup.slug === 'parent-trap' && o.roundId && o.targetPlayerId)
  if (swaps.length === 0) return () => false

  const roundIds = [...new Set(swaps.map((o) => o.roundId as string))]
  const playerIds = [...new Set(swaps.flatMap((o) => [o.tournamentPlayerId, o.targetPlayerId as string]))]

  const [rounds, counts] = await Promise.all([
    prisma.tournamentRound.findMany({
      where: { id: { in: roundIds } },
      select: { id: true, course: { select: { _count: { select: { holes: true } } } } },
    }),
    prisma.score.groupBy({
      by: ['tournamentPlayerId', 'roundId'],
      where: { roundId: { in: roundIds }, tournamentPlayerId: { in: playerIds } },
      _count: { _all: true },
    }),
  ])

  const holesInRound = new Map(rounds.map((r) => [r.id, r.course._count.holes]))
  const scored = new Map(counts.map((c) => [`${c.tournamentPlayerId}:${c.roundId}`, c._count._all]))

  return (tournamentPlayerId, roundId) => {
    const holes = holesInRound.get(roundId) ?? 0
    return holes > 0 && (scored.get(`${tournamentPlayerId}:${roundId}`) ?? 0) >= holes
  }
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

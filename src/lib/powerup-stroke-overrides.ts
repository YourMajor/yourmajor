/**
 * Powerup stroke adjustments — the single channel through which every powerup
 * reaches the leaderboard, in every format.
 *
 * Two kinds of adjustment land on a (player, round, hole):
 *
 * ── `absolute` — three cards REPLACE the recorded strokes:
 *   • can-i-get-your-number → strokes become metadata.numberValue, which must
 *     be a legal hole score (see isValidStrokeOverrideValue).
 *   • concede               → if GIR on the activation hole, strokes become par - 1.
 *   • parent-trap           → activator's and target's strokes on the chosen hole
 *     (metadata.swapHoleNumber, falling back to the activation hole) are swapped — but only once BOTH players have scored every hole of
 *     that round. Until then the leaderboard shows real scores; the swap lands
 *     at the end of the round. The target can be anyone, whether or not they've
 *     already played that hole.
 *
 * ── `delta` — every other powerup's `PlayerPowerup.scoreModifier`, attributed
 *   to the hole it was earned on: a boost to the activator's `holeNumber`, an
 *   attack to the victim's `targetHoleNumber`.
 *
 * WHY per-hole and not a lump sum on the player's total: `effectiveStrokes` is
 * consumed by `ScoringScore.strokes` in src/lib/scoring.ts, which is what every
 * format strategy reads. Routing modifiers through here means a boost correctly
 * earns a Stableford point, wins a skin and wins a match hole. The previous
 * design put the sum on `ScoringPlayer.scoreModifier`, which only
 * strokePlay.ts ever read — so powerups silently did nothing in Stableford,
 * Skins, Match Play, Nassau and Quota.
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

/**
 * What a powerup does to one (player, round, hole). `absolute` replaces the
 * recorded strokes; `delta` shifts them. Both can be present — a Concede! on a
 * hole that also took an attack resolves as (par - 1) + attackDelta.
 */
export interface StrokeAdjustment {
  absolute?: number
  delta?: number
}

export type StrokeAdjustmentMap = Map<string, StrokeAdjustment>

export interface ScoreInput {
  tournamentPlayerId: string
  /** The round the score belongs to. Needed in multi-round tournaments so an
   *  override from one round never lands on the same hole number in another. */
  roundId?: string | null
  holeNumber: number
  par: number
  strokes: number
  gir: boolean | null
  /** Conceded holes (match play) take no adjustment — see effectiveStrokes. */
  conceded?: boolean
}

/**
 * Map key for an adjusted (player, hole). Adjustments tied to a round are
 * keyed by that round; legacy rows with no roundId keep the old round-less key,
 * which effectiveStrokes treats as applying to every round.
 */
export function overrideKey(tournamentPlayerId: string, holeNumber: number, roundId?: string | null): string {
  return roundId ? `${tournamentPlayerId}:${roundId}:${holeNumber}` : `${tournamentPlayerId}:${holeNumber}`
}

/**
 * Does this card's effect declare `scoring.mirror`? Read defensively off the
 * raw Json rather than through the zod schema: a malformed effect must not
 * throw while building a leaderboard, and "not mirrored" is the safe default.
 */
function isMirrored(rawEffect: unknown): boolean {
  if (typeof rawEffect !== 'object' || rawEffect === null) return false
  const scoring = (rawEffect as { scoring?: unknown }).scoring
  if (typeof scoring !== 'object' || scoring === null) return false
  return (scoring as { mirror?: unknown }).mirror === true
}

function addDelta(map: StrokeAdjustmentMap, key: string, delta: number): void {
  if (delta === 0) return
  const existing = map.get(key)
  if (existing) {
    existing.delta = (existing.delta ?? 0) + delta
  } else {
    map.set(key, { delta })
  }
}

function setAbsolute(map: StrokeAdjustmentMap, key: string, absolute: number): void {
  const existing = map.get(key)
  if (existing) {
    existing.absolute = absolute
  } else {
    map.set(key, { absolute })
  }
}

/**
 * Build a map keyed by `${tournamentPlayerId}:${roundId}:${holeNumber}` → the
 * stroke adjustment for any (player, hole) pair a powerup touches.
 *
 * Pass in the union of scores needed by the consumer (leaderboard: every
 * player's scores; per-player view: that player + any swap counterparties).
 * Missing counterparty data degrades gracefully — Parent Trap only swaps when
 * both sides' scores are present.
 */
export async function buildStrokeAdjustmentMap(
  tournamentId: string,
  scores: ScoreInput[],
  roundId?: string | null,
): Promise<StrokeAdjustmentMap> {
  const map: StrokeAdjustmentMap = new Map()

  // `tournamentPlayer: { tournamentId }` scopes by the ACTIVATOR's tournament.
  // Attacks are validated at activation to target someone in the same
  // tournament (powerups/activate/route.ts), so this covers inbound attacks
  // too — and it closes a gap in the old leaderboard query, which filtered
  // inbound attacks on `targetPlayerId IN (participants)` with no tournament
  // scope at all.
  const rows = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayer: { tournamentId },
      status: 'USED',
      ...(roundId ? { roundId } : {}),
      OR: [
        { powerup: { slug: { in: [...OVERRIDE_SLUGS] } }, holeNumber: { not: null } },
        { scoreModifier: { not: null } },
      ],
    },
    select: {
      tournamentPlayerId: true,
      targetPlayerId: true,
      roundId: true,
      holeNumber: true,
      targetHoleNumber: true,
      scoreModifier: true,
      metadata: true,
      powerup: { select: { slug: true, type: true, effect: true } },
    },
  })

  if (rows.length === 0) return map

  const overrides = rows.filter((r) => (OVERRIDE_SLUGS as readonly string[]).includes(r.powerup.slug))
  const roundFinished = await loadRoundCompletion(overrides)

  // Scores are looked up by (player, round, hole). Callers that don't pass a
  // roundId (single-round views) land under an empty round, which any
  // adjustment's lookup falls back to.
  const scoreLookup = new Map<string, ScoreInput>()
  for (const s of scores) {
    scoreLookup.set(`${s.tournamentPlayerId}:${s.roundId ?? ''}:${s.holeNumber}`, s)
  }
  const findScore = (tp: string, round: string | null, hole: number): ScoreInput | undefined =>
    (round ? scoreLookup.get(`${tp}:${round}:${hole}`) : undefined) ?? scoreLookup.get(`${tp}::${hole}`)

  // Highest scored hole per (player, round), for modifiers that have no hole to
  // attach to — see the attribution fallback below.
  const lastHole = new Map<string, number>()
  for (const s of scores) {
    const k = `${s.tournamentPlayerId}:${s.roundId ?? ''}`
    const prev = lastHole.get(k)
    if (prev === undefined || s.holeNumber > prev) lastHole.set(k, s.holeNumber)
  }

  // ── Pass 1: absolute overrides. Run before deltas so a hole carrying both
  // resolves as (override + delta) regardless of row order.
  for (const ov of overrides) {
    if (ov.holeNumber === null) continue
    const slug = ov.powerup.slug
    const aKey = overrideKey(ov.tournamentPlayerId, ov.holeNumber, ov.roundId)

    if (slug === NUMBER_OVERRIDE_SLUG) {
      const num = (ov.metadata as { numberValue?: unknown } | null)?.numberValue
      // Rows written before the activation route validated this could hold any
      // number at all. Ignore an out-of-range one — the player's recorded
      // strokes stand — rather than replacing their score with it.
      if (isValidStrokeOverrideValue(num)) {
        setAbsolute(map, aKey, num)
      }
    } else if (slug === 'concede') {
      const score = findScore(ov.tournamentPlayerId, ov.roundId, ov.holeNumber)
      if (score?.gir === true) {
        setAbsolute(map, aKey, score.par - 1)
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
      // Rows from before the hole picker have no swapHoleNumber and swap on
      // the activation hole, as they always did.
      const picked = (ov.metadata as { swapHoleNumber?: unknown } | null)?.swapHoleNumber
      const swapHole = typeof picked === 'number' && Number.isInteger(picked) ? picked : ov.holeNumber
      const sKey = overrideKey(ov.tournamentPlayerId, swapHole, ov.roundId)
      const tKey = overrideKey(ov.targetPlayerId, swapHole, ov.roundId)
      const a = findScore(ov.tournamentPlayerId, ov.roundId, swapHole)
      const t = findScore(ov.targetPlayerId, ov.roundId, swapHole)
      if (a && t) {
        setAbsolute(map, sKey, t.strokes)
        setAbsolute(map, tKey, a.strokes)
      }
    }
  }

  // ── Pass 2: score modifiers, attributed to the hole they were earned on.
  for (const row of rows) {
    // Guard the type, not just null: this is a Json/DB boundary and a row
    // missing the column entirely must not fall through as NaN.
    const modifier = row.scoreModifier
    if (typeof modifier !== 'number' || !Number.isFinite(modifier) || modifier === 0) continue
    // The three absolute cards carry no modifier by design
    // (computeActivationModifier returns null for them); skip defensively so a
    // legacy row can't both replace and shift the same score.
    if ((OVERRIDE_SLUGS as readonly string[]).includes(row.powerup.slug)) continue

    // An attack lands on its victim's card; everything else on the activator's.
    const isAttack = row.powerup.type === 'ATTACK' && row.targetPlayerId !== null
    const subject = isAttack ? (row.targetPlayerId as string) : row.tournamentPlayerId
    const hole = isAttack ? (row.targetHoleNumber ?? row.holeNumber) : row.holeNumber

    // ponytail: a modifier with no hole on it (legacy rows predate holeNumber
    // being required at activation) attaches to the subject's last scored hole
    // rather than being dropped — losing it would silently change historic
    // leaderboards. Windowed cards land their whole payout on the hole they
    // resolved on, which is identical in stroke play and a known simplification
    // in Skins/Match.
    const target = hole ?? lastHole.get(`${subject}:${row.roundId ?? ''}`) ?? lastHole.get(`${subject}:`)
    if (target === undefined) continue

    addDelta(map, overrideKey(subject, target, row.roundId), modifier)

    // Mirrored attacks are parasitic: what the victim loses, the attacker
    // gains. The flipped delta lands on the attacker's own activation hole.
    //
    // Suppressed when the subject IS the activator, which happens when a
    // Deflector bounces a mirrored attack back at its caster. Applying both
    // halves to one player would net exactly zero and the card would silently
    // do nothing — so the deflected penalty stands alone.
    const selfInflicted = subject === row.tournamentPlayerId
    if (isAttack && !selfInflicted && isMirrored(row.powerup.effect) && row.holeNumber !== null) {
      addDelta(map, overrideKey(row.tournamentPlayerId, row.holeNumber, row.roundId), -modifier)
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

/**
 * Effective strokes for a (player, hole) in a given round: that round's
 * adjustment if there is one, else a legacy round-less adjustment, else the
 * recorded strokes.
 *
 * `absolute` replaces the recorded score, `delta` then shifts it, and the
 * result is clamped to the same 1–20 a hand-entered score must satisfy. A
 * conceded hole (strokes 0, match play only) is returned untouched — you
 * cannot boost a hole you gave away, and clamping would turn its 0 into a 1.
 */
export function effectiveStrokes(
  map: StrokeAdjustmentMap,
  tournamentPlayerId: string,
  holeNumber: number,
  fallback: number,
  roundId?: string | null,
  conceded?: boolean,
): number {
  if (conceded) return fallback

  const adj =
    (roundId ? map.get(overrideKey(tournamentPlayerId, holeNumber, roundId)) : undefined) ??
    map.get(overrideKey(tournamentPlayerId, holeNumber))
  if (!adj) return fallback

  const adjusted = (adj.absolute ?? fallback) + (adj.delta ?? 0)
  return Math.min(Math.max(adjusted, MIN_OVERRIDE_STROKES), MAX_OVERRIDE_STROKES)
}

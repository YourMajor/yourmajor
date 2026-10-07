/**
 * Powerup engine — validation, score computation, and input requirements.
 */

import { z } from 'zod'

export const powerupEffectSchema = z.object({
  scoring: z.object({
    // 'windowed' is the data-driven multi-hole mode: `duration` holes, a
    // per-hole predicate named by `conditionalKey`, and `bank` deciding how
    // per-hole results accumulate. See HOLE_PREDICATES in
    // src/lib/variable-powerup-evaluator.ts. 'variable' is the older
    // slug-dispatched path kept for the player-declared challenge cards.
    // 'reactive' cards are played to lie in wait: they go ARMED and do nothing
    // until another player acts. See src/lib/powerup-reactions.ts.
    mode: z.enum(['auto', 'manual', 'behavioral', 'variable', 'windowed', 'reactive']),
    modifier: z.number().nullable(),
    conditionalKey: z.string().nullable(),
    // Optional magnitude cap for count-based manual powerups (e.g. Beer Bonus
    // tops out at -3 even if the player drank more). Same sign as modifier.
    cap: z.number().nullable().optional(),
    /**
     * How a windowed card folds its per-hole results:
     *   'sum'    — add every hole's contribution and keep whatever was banked,
     *              even if the round ends mid-window (Birdie Hunter, Vampire).
     *   'streak' — all or nothing: pays only if the FULL window completes
     *              without a failing hole (Stayin' Alive).
     *   'wipe'   — bank as you go, but a failing hole discards the lot. An
     *              unfinished window still pays what was banked (Par Train).
     *   'none'   — no modifier at all; the card is a rule change the players
     *              apply themselves (COVID Birdie).
     */
    bank: z.enum(['sum', 'streak', 'wipe', 'none']).nullable().optional(),
    /**
     * Attacks only. When true the resolved modifier also lands on the
     * ACTIVATOR with the sign flipped — the parasitic cards, where what the
     * victim loses the attacker gains. Applied by the stroke adjustment map.
     */
    mirror: z.boolean().nullable().optional(),
    /**
     * Which reaction a `reactive` card performs. Names an entry in REACTIONS
     * (src/lib/powerup-reactions.ts), which also decides what triggers it:
     * being targeted by an attack, or the card's own target playing one.
     */
    reaction: z.enum(['deflect', 'absorb', 'tripwire']).nullable().optional(),
  }),
  duration: z.number(),
  requiresTarget: z.boolean(),
  input: z
    .object({
      type: z.enum([
        'none',
        'player_select',
        'club_select',
        'number_input',
        'hole_select',
        // Pick one option from `options` — the menu-driven cards (The Gauntlet
        // picks a restriction to impose, The Tally picks a "sin" to count).
        'restriction_select',
      ]),
      label: z.string().nullable(),
      count: z.number().nullable(),
      options: z.array(z.string()).nullable().optional(),
    })
    .nullable(),
  restrictions: z.object({
    excludePar3: z.boolean(),
    /** Activatable only on a par 5 (Albatross Aim and friends). */
    par5Only: z.boolean().optional(),
    /** Activatable only from hole 10 onward. */
    backNineOnly: z.boolean().optional(),
    /**
     * Activatable only when the player is at least this many strokes over par
     * for the round — the comeback cards (Second Wind).
     */
    minStrokesOverPar: z.number().nullable().optional(),
  }),
  flavorText: z.string(),
})

export type PowerupEffect = z.infer<typeof powerupEffectSchema>

/**
 * Parse a raw Prisma Json value into a PowerupEffect. Throws on shape
 * mismatch so callers get a clear error instead of a silent undefined read.
 */
export function parsePowerupEffect(raw: unknown): PowerupEffect {
  return powerupEffectSchema.parse(raw)
}

/**
 * Check if this powerup uses the variable tracking system (auto-evaluated over multiple holes).
 */
export function isVariablePowerup(effect: PowerupEffect): boolean {
  return effect.duration === -1 && effect.scoring.mode === 'variable'
}

/**
 * Windowed cards run for a fixed number of holes declared by `duration`, with
 * their per-hole rule named by `conditionalKey`. Unlike `variable` cards they
 * need no slug-specific code: the generic evaluator reads the card.
 */
export function isWindowedPowerup(effect: PowerupEffect): boolean {
  // duration 1 is allowed: a "declare it, then play the hole" card (Sandbagger's
  // Bluff) is a one-hole window that has to resolve AFTER the score lands,
  // which is exactly what the windowed path does.
  return effect.scoring.mode === 'windowed' && effect.duration >= 1
}

/**
 * Both multi-hole kinds park on the card as status ACTIVE with tracking
 * metadata and resolve later, so most call sites want this rather than either
 * one alone.
 */
export function isTrackedPowerup(effect: PowerupEffect): boolean {
  return isVariablePowerup(effect) || isWindowedPowerup(effect)
}

/**
 * A reactive card is played to lie in wait. It goes ARMED and does nothing
 * until another player acts, then fires on its own. Arming is never announced.
 */
export function isReactivePowerup(effect: PowerupEffect): boolean {
  return effect.scoring.mode === 'reactive' && !!effect.scoring.reaction
}

/** Tracking state for a windowed card. One shape for every such card. */
export interface WindowMetadata {
  activationHoleNumber: number
  /** Holes left in the window, decremented as the player scores. */
  holesRemaining: number
  /** Qualifying holes so far — what the player sees as progress. */
  tally: number
  /** Modifier accumulated so far; becomes scoreModifier on resolution. */
  banked: number
  /** Player-declared target, for cards that ask for a number up front. */
  declaredCount?: number
  /** Multi-target cards (and attacks that track an opponent's card). */
  targetPlayerIds?: string[]
  /** Chosen option for a restriction_select card, carried for display. */
  selectedOption?: string
  status: 'in_progress' | 'success' | 'failed'
}

/**
 * Initial tracking metadata for a windowed card. Replaces what used to be a
 * per-slug if/else chain in the activation route: the window length comes from
 * the card's own `duration`, so a new windowed card is a seed row.
 */
export function buildWindowMetadata(
  effect: PowerupEffect,
  holeNumber: number,
  input?: {
    numberValue?: unknown
    selectedPlayerIds?: string[] | null
    targetPlayerId?: string | null
    selectedOption?: unknown
  } | null,
): WindowMetadata {
  const declared = input?.numberValue
  const targets = input?.selectedPlayerIds?.length
    ? input.selectedPlayerIds
    : input?.targetPlayerId
      ? [input.targetPlayerId]
      : undefined

  return {
    activationHoleNumber: holeNumber,
    holesRemaining: effect.duration,
    tally: 0,
    banked: 0,
    ...(typeof declared === 'number' && Number.isFinite(declared)
      ? { declaredCount: Math.min(Math.max(Math.trunc(declared), 1), 18) }
      : {}),
    ...(targets ? { targetPlayerIds: targets } : {}),
    ...(typeof input?.selectedOption === 'string' ? { selectedOption: input.selectedOption } : {}),
    status: 'in_progress',
  }
}

interface HoleInfo {
  par: number
  number: number
}

/** Round-level facts the comeback restrictions need. Optional at call sites
 *  that don't have them, in which case those restrictions don't apply. */
export interface RoundProgress {
  /** Player's strokes-over-par for the round so far. */
  strokesOverPar?: number
}

/**
 * Check if a powerup can be activated on this hole.
 */
export function canActivate(
  effect: PowerupEffect,
  hole: HoleInfo,
  progress?: RoundProgress,
): { allowed: boolean; reason?: string } {
  const r = effect.restrictions

  if (r.excludePar3 && hole.par === 3) {
    return { allowed: false, reason: 'This powerup cannot be used on par 3 holes.' }
  }
  if (r.par5Only && hole.par !== 5) {
    return { allowed: false, reason: 'This powerup can only be used on par 5 holes.' }
  }
  if (r.backNineOnly && hole.number < 10) {
    return { allowed: false, reason: 'This powerup can only be used on the back nine.' }
  }
  if (typeof r.minStrokesOverPar === 'number' && r.minStrokesOverPar > 0) {
    // A comeback card. With no round progress to check we let it through
    // rather than blocking a legitimate activation on missing data.
    const over = progress?.strokesOverPar
    if (typeof over === 'number' && over < r.minStrokesOverPar) {
      return {
        allowed: false,
        reason: `This powerup unlocks once you are ${r.minStrokesOverPar} or more over par for the round (you are ${over}).`,
      }
    }
  }
  return { allowed: true }
}

/**
 * For auto-mode powerups, compute the score modifier.
 */
export function computeAutoModifier(
  effect: PowerupEffect,
): number | null {
  if (effect.scoring.mode === 'auto' && effect.scoring.modifier !== null) {
    return effect.scoring.modifier
  }
  return null
}

/**
 * Apply a magnitude cap that has the same sign as the raw value's expected
 * direction. For BOOST count cards (negative modifier), cap is more negative
 * and we floor; for ATTACK count cards (positive), cap is more positive and
 * we ceiling. Caller is responsible for ensuring sign consistency in seed.
 */
function applyMagnitudeCap(raw: number, cap: number): number {
  return cap < 0 ? Math.max(cap, raw) : Math.min(cap, raw)
}

/**
 * Slugs whose number_input replaces the player's strokes on a hole rather
 * than producing a net-score modifier. These are handled by the stroke
 * override engine (src/lib/powerup-stroke-overrides.ts), so we must NOT
 * also store numberValue as scoreModifier or it'd double-count.
 */
const STROKE_OVERRIDE_SLUGS = ['can-i-get-your-number'] as const

/**
 * Hard bound on a client-supplied metadata.numberValue. Most number_input
 * effects declare no `cap`, so without this an activation could post any count
 * and persist an arbitrary scoreModifier straight onto the leaderboard.
 * 20 mirrors COUNT_INPUT_MAX in variable-powerup-evaluator.ts, which bounds the
 * same class of value on the resolve endpoint (z.number().int().min(-20).max(20)).
 * The activation UI's own input is min 1 / max 18, so no legitimate entry moves.
 */
const NUMBER_INPUT_MAX = 20

/**
 * Compute the score modifier to record at activation time.
 *
 * Handles three cases:
 *   - auto mode → static modifier from the seed.
 *   - manual + number_input + modifier null → user enters the modifier
 *     directly (e.g. "Enter -3 if yes, 0 if no"); store numberValue as-is.
 *   - manual + number_input + modifier set → user enters a count; multiply
 *     by per-unit modifier and apply optional cap.
 *
 * Returns null when the powerup defers computation (variable, behavioral,
 * non-numeric input types, or stroke-override cards) — those flows set
 * scoreModifier later via the variable evaluator, follow-up resolve call,
 * or stroke override engine.
 */
export function computeActivationModifier(
  effect: PowerupEffect,
  metadata?: { numberValue?: unknown } | null,
  slug?: string,
): number | null {
  if (slug && (STROKE_OVERRIDE_SLUGS as readonly string[]).includes(slug)) {
    return null
  }
  if (effect.scoring.mode === 'auto') {
    return effect.scoring.modifier
  }
  if (effect.scoring.mode === 'manual' && effect.input?.type === 'number_input') {
    const n = metadata?.numberValue
    if (typeof n !== 'number' || !Number.isFinite(n)) return null

    if (effect.scoring.modifier === null) {
      // The entered value IS the modifier — bound its magnitude both ways.
      return Math.min(Math.max(n, -NUMBER_INPUT_MAX), NUMBER_INPUT_MAX)
    }

    // Bound the count before multiplying: `cap` is optional in the seed, so it
    // cannot be the only ceiling. Negative counts would invert the card's
    // direction, so the floor is 0.
    const raw = Math.min(Math.max(n, 0), NUMBER_INPUT_MAX) * effect.scoring.modifier
    const capped = typeof effect.scoring.cap === 'number' ? applyMagnitudeCap(raw, effect.scoring.cap) : raw
    // Normalize -0 → 0 so downstream === 0 / Object.is checks behave.
    return capped === 0 ? 0 : capped
  }
  return null
}

/**
 * Determine what inputs are needed to activate a powerup.
 */
export function getInputRequirements(effect: PowerupEffect): {
  needsTarget: boolean
  inputType: string | null
  inputLabel: string | null
  inputCount: number | null
} {
  return {
    needsTarget: effect.requiresTarget,
    inputType: effect.input?.type ?? null,
    inputLabel: effect.input?.label ?? null,
    inputCount: effect.input?.count ?? null,
  }
}

/**
 * Compute the hole on the attack recipient's scorecard where the attack should
 * land. The default is "the unscored hole AFTER the one they're currently
 * working on" — i.e. the second unscored hole in course order — so a player
 * mid-swing on hole 3 doesn't get hit on the hole they're already playing.
 * If only one hole remains unscored (they're on the last hole), we fall back
 * to that hole so the attack still has a valid target.
 *
 * Returns null when the recipient has scored every hole.
 */
export function computeAttackTargetHole(
  holeNumbers: readonly number[],
  scoredHoleNumbers: ReadonlySet<number>,
): number | null {
  const sorted = [...holeNumbers].sort((a, b) => a - b)
  const unscored = sorted.filter((n) => !scoredHoleNumbers.has(n))
  if (unscored.length === 0) return null
  // Prefer the *next* unscored hole after the one they're on; fall back to the
  // first unscored when there's only one left (last hole of the round).
  return unscored[1] ?? unscored[0]
}

/** Standard golf club names for Club Roulette */
export const GOLF_CLUBS = [
  'Driver',
  '3 Wood',
  '5 Wood',
  '3 Hybrid',
  '4 Hybrid',
  '4 Iron',
  '5 Iron',
  '6 Iron',
  '7 Iron',
  '8 Iron',
  '9 Iron',
  'Pitching Wedge',
  'Gap Wedge',
  'Sand Wedge',
  'Lob Wedge',
  'Putter',
]

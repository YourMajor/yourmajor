/**
 * Powerup engine — validation, score computation, and input requirements.
 */

import { z } from 'zod'

export const powerupEffectSchema = z.object({
  scoring: z.object({
    mode: z.enum(['auto', 'manual', 'behavioral', 'variable']),
    modifier: z.number().nullable(),
    conditionalKey: z.string().nullable(),
    // Optional magnitude cap for count-based manual powerups (e.g. Beer Bonus
    // tops out at -3 even if the player drank more). Same sign as modifier.
    cap: z.number().nullable().optional(),
  }),
  duration: z.number(),
  requiresTarget: z.boolean(),
  input: z
    .object({
      type: z.enum(['none', 'player_select', 'club_select', 'number_input', 'hole_select']),
      label: z.string().nullable(),
      count: z.number().nullable(),
    })
    .nullable(),
  restrictions: z.object({
    excludePar3: z.boolean(),
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
 * Whether the powerup spans more than the activation hole — either an explicit
 * fixed multi-hole duration (e.g. duration: 9) or the variable-mode sentinel (-1).
 * Multi-hole powerups must be initialised with metadata so the evaluator can
 * track them across hole submissions.
 */
export function isMultiHolePowerup(effect: PowerupEffect): boolean {
  return effect.duration > 1 || effect.duration === -1
}

interface HoleInfo {
  par: number
  number: number
}

/**
 * Check if a powerup can be activated on this hole.
 */
export function canActivate(
  effect: PowerupEffect,
  hole: HoleInfo,
): { allowed: boolean; reason?: string } {
  if (effect.restrictions.excludePar3 && hole.par === 3) {
    return { allowed: false, reason: 'This powerup cannot be used on par 3 holes.' }
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
      return n
    }

    const raw = n * effect.scoring.modifier
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

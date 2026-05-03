/**
 * Powerup engine — validation, score computation, and input requirements.
 */

import { z } from 'zod'

export const powerupEffectSchema = z.object({
  scoring: z.object({
    mode: z.enum(['auto', 'manual', 'behavioral', 'variable']),
    modifier: z.number().nullable(),
    conditionalKey: z.string().nullable(),
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

/**
 * Powerup engine — validation, score computation, and input requirements.
 */

export interface PowerupEffect {
  scoring: {
    mode: 'auto' | 'manual' | 'behavioral' | 'variable'
    modifier: number | null
    conditionalKey: string | null
  }
  duration: number
  requiresTarget: boolean
  input: {
    type: 'none' | 'player_select' | 'club_select' | 'number_input' | 'hole_select'
    label: string | null
    count: number | null
  } | null
  restrictions: {
    excludePar3: boolean
  }
  flavorText: string
}

/**
 * Check if this powerup uses the variable tracking system (auto-evaluated over multiple holes).
 */
export function isVariablePowerup(effect: PowerupEffect): boolean {
  return effect.duration === -1 && effect.scoring.mode === 'variable'
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

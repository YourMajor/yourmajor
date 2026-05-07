import { describe, it, expect } from 'vitest'
import {
  isVariablePowerup,
  canActivate,
  computeActivationModifier,
  computeAttackTargetHole,
  computeAutoModifier,
  getInputRequirements,
  GOLF_CLUBS,
  type PowerupEffect,
} from '@/lib/powerup-engine'

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeEffect(overrides: Partial<PowerupEffect> = {}): PowerupEffect {
  return {
    scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
    duration: 1,
    requiresTarget: false,
    input: null,
    restrictions: { excludePar3: false },
    flavorText: 'test',
    ...overrides,
  }
}

// ─── isVariablePowerup ──────────────────────────────────────────────────────

describe('isVariablePowerup', () => {
  it('returns true for duration=-1 AND mode=variable', () => {
    const effect = makeEffect({
      duration: -1,
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'fairway-finder' },
    })
    expect(isVariablePowerup(effect)).toBe(true)
  })

  it('returns false for duration=-1 but non-variable mode', () => {
    const effect = makeEffect({
      duration: -1,
      scoring: { mode: 'auto', modifier: -2, conditionalKey: null },
    })
    expect(isVariablePowerup(effect)).toBe(false)
  })

  it('returns false for variable mode but duration != -1', () => {
    const effect = makeEffect({
      duration: 3,
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'test' },
    })
    expect(isVariablePowerup(effect)).toBe(false)
  })

  it('returns false for standard auto powerup', () => {
    const effect = makeEffect()
    expect(isVariablePowerup(effect)).toBe(false)
  })
})

// ─── canActivate ────────────────────────────────────────────────────────────

describe('canActivate', () => {
  it('blocks par 3 when excludePar3 is true', () => {
    const effect = makeEffect({ restrictions: { excludePar3: true } })
    const result = canActivate(effect, { par: 3, number: 7 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('par 3')
  })

  it('allows par 4 when excludePar3 is true', () => {
    const effect = makeEffect({ restrictions: { excludePar3: true } })
    expect(canActivate(effect, { par: 4, number: 1 })).toEqual({ allowed: true })
  })

  it('allows par 5 when excludePar3 is true', () => {
    const effect = makeEffect({ restrictions: { excludePar3: true } })
    expect(canActivate(effect, { par: 5, number: 10 })).toEqual({ allowed: true })
  })

  it('allows par 3 when excludePar3 is false', () => {
    const effect = makeEffect({ restrictions: { excludePar3: false } })
    expect(canActivate(effect, { par: 3, number: 4 })).toEqual({ allowed: true })
  })
})

// ─── computeAutoModifier ────────────────────────────────────────────────────

describe('computeAutoModifier', () => {
  it('returns modifier for auto mode', () => {
    const effect = makeEffect({
      scoring: { mode: 'auto', modifier: -2, conditionalKey: null },
    })
    expect(computeAutoModifier(effect)).toBe(-2)
  })

  it('returns null for auto mode with null modifier', () => {
    const effect = makeEffect({
      scoring: { mode: 'auto', modifier: null, conditionalKey: null },
    })
    expect(computeAutoModifier(effect)).toBeNull()
  })

  it('returns null for non-auto mode even with modifier set', () => {
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: -1, conditionalKey: null },
    })
    expect(computeAutoModifier(effect)).toBeNull()
  })

  it('returns null for variable mode', () => {
    const effect = makeEffect({
      scoring: { mode: 'variable', modifier: -3, conditionalKey: 'test' },
    })
    expect(computeAutoModifier(effect)).toBeNull()
  })

  it('returns null for behavioral mode', () => {
    const effect = makeEffect({
      scoring: { mode: 'behavioral', modifier: 1, conditionalKey: null },
    })
    expect(computeAutoModifier(effect)).toBeNull()
  })
})

// ─── computeActivationModifier ──────────────────────────────────────────────

describe('computeActivationModifier', () => {
  it('returns static modifier for auto mode', () => {
    const effect = makeEffect({
      scoring: { mode: 'auto', modifier: -2, conditionalKey: null },
    })
    expect(computeActivationModifier(effect, null)).toBe(-2)
  })

  it('returns null for behavioral mode (rule changes only)', () => {
    const effect = makeEffect({
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      input: null,
    })
    expect(computeActivationModifier(effect, { numberValue: 3 })).toBeNull()
  })

  it('returns null for manual + non-numeric input (e.g. player_select)', () => {
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: 2, conditionalKey: 'three_putt' },
      requiresTarget: true,
      input: { type: 'player_select', label: 'Pick target', count: 1 },
    })
    expect(computeActivationModifier(effect, { numberValue: 5 })).toBeNull()
  })

  it('returns numberValue verbatim for direct-modifier card (modifier null)', () => {
    // Pattern A: "Enter -3 if yes, 0 if no"
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'sand_save' },
      input: { type: 'number_input', label: 'Sand save? -3 if yes', count: null },
    })
    expect(computeActivationModifier(effect, { numberValue: -3 })).toBe(-3)
    expect(computeActivationModifier(effect, { numberValue: 0 })).toBe(0)
  })

  it('multiplies count by per-unit modifier for count card (modifier set)', () => {
    // Pattern B: "How many bunkers? -1 each"
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'bunkers_entered' },
      input: { type: 'number_input', label: 'How many bunkers?', count: null },
    })
    expect(computeActivationModifier(effect, { numberValue: 2 })).toBe(-2)
    expect(computeActivationModifier(effect, { numberValue: 0 })).toBe(0)
  })

  it('applies negative cap for BOOST count card', () => {
    // Beer Bonus: -1 per beer, capped at -3
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'beers_finished', cap: -3 },
      input: { type: 'number_input', label: 'Beers?', count: null },
    })
    expect(computeActivationModifier(effect, { numberValue: 2 })).toBe(-2) // under cap
    expect(computeActivationModifier(effect, { numberValue: 5 })).toBe(-3) // capped
  })

  it('applies positive cap for ATTACK count card', () => {
    // The Flop: +1 per rough shot, capped at +3
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'rough_shots', cap: 3 },
      input: { type: 'number_input', label: 'Rough shots?', count: null },
    })
    expect(computeActivationModifier(effect, { numberValue: 2 })).toBe(2)
    expect(computeActivationModifier(effect, { numberValue: 7 })).toBe(3)
  })

  it('returns null when number_input card has no numberValue in metadata', () => {
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'pin_proximity' },
      input: { type: 'number_input', label: 'Pin?', count: null },
    })
    expect(computeActivationModifier(effect, null)).toBeNull()
    expect(computeActivationModifier(effect, {})).toBeNull()
    expect(computeActivationModifier(effect, { numberValue: 'bad' as unknown as number })).toBeNull()
  })

  it('returns null for variable mode (deferred to evaluator)', () => {
    const effect = makeEffect({
      duration: -1,
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'fairway-finder' },
    })
    expect(computeActivationModifier(effect, { numberValue: 3 })).toBeNull()
  })

  it('returns null for stroke-override slugs even with number_input (handled by override engine)', () => {
    // Can I Get Your Number — numberValue replaces strokes via the override
    // engine; must NOT also be recorded as a net-score modifier.
    const effect = makeEffect({
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'random_number' },
      input: { type: 'number_input', label: 'Pick 1–10', count: null },
    })
    expect(computeActivationModifier(effect, { numberValue: 5 }, 'can-i-get-your-number')).toBeNull()
  })
})

// ─── getInputRequirements ───────────────────────────────────────────────────

describe('getInputRequirements', () => {
  it('returns needsTarget from effect', () => {
    const effect = makeEffect({ requiresTarget: true })
    expect(getInputRequirements(effect).needsTarget).toBe(true)
  })

  it('returns input type/label/count when present', () => {
    const effect = makeEffect({
      input: { type: 'player_select', label: 'Choose target', count: 1 },
    })
    const result = getInputRequirements(effect)
    expect(result.inputType).toBe('player_select')
    expect(result.inputLabel).toBe('Choose target')
    expect(result.inputCount).toBe(1)
  })

  it('returns nulls when input is null', () => {
    const effect = makeEffect({ input: null })
    const result = getInputRequirements(effect)
    expect(result.inputType).toBeNull()
    expect(result.inputLabel).toBeNull()
    expect(result.inputCount).toBeNull()
  })

  it('handles input with null label and count', () => {
    const effect = makeEffect({
      input: { type: 'none', label: null, count: null },
    })
    const result = getInputRequirements(effect)
    expect(result.inputType).toBe('none')
    expect(result.inputLabel).toBeNull()
    expect(result.inputCount).toBeNull()
  })
})

// ─── computeAttackTargetHole ────────────────────────────────────────────────

describe('computeAttackTargetHole', () => {
  const HOLES_18 = Array.from({ length: 18 }, (_, i) => i + 1)

  it('returns first unscored + 1 when nothing scored', () => {
    // Recipient hasn't started: first unscored = 1, attack lands on 2 so they
    // can finish their current hole before being hit.
    expect(computeAttackTargetHole(HOLES_18, new Set())).toBe(2)
  })

  it('returns firstUnscored + 1 when target is mid-round', () => {
    // Scored 1 and 2; mid-swing on 3 (unscored). Default target = 4.
    expect(computeAttackTargetHole(HOLES_18, new Set([1, 2]))).toBe(4)
  })

  it('skips already-scored holes (out-of-order play)', () => {
    // Holes 1, 2, 4 scored (player jumped ahead); unscored list = [3, 5, …].
    // Default target = next-after-current-unscored = 5.
    expect(computeAttackTargetHole(HOLES_18, new Set([1, 2, 4]))).toBe(5)
  })

  it('clamps to last hole when firstUnscored is the final hole', () => {
    // Recipient on hole 18 (last); +1 would be 19 which doesn't exist.
    const scored = new Set(Array.from({ length: 17 }, (_, i) => i + 1))
    expect(computeAttackTargetHole(HOLES_18, scored)).toBe(18)
  })

  it('returns null when target has scored every hole', () => {
    expect(computeAttackTargetHole(HOLES_18, new Set(HOLES_18))).toBeNull()
  })

  it('returns null on empty hole list', () => {
    expect(computeAttackTargetHole([], new Set())).toBeNull()
  })

  it('handles unsorted hole numbers (sorts first)', () => {
    expect(computeAttackTargetHole([3, 1, 2, 4], new Set([1]))).toBe(3)
  })

  it('handles non-1-indexed courses (e.g. back-9 only)', () => {
    const back9 = [10, 11, 12, 13, 14, 15, 16, 17, 18]
    expect(computeAttackTargetHole(back9, new Set([10, 11]))).toBe(13)
  })
})

// ─── GOLF_CLUBS ─────────────────────────────────────────────────────────────

describe('GOLF_CLUBS', () => {
  it('contains standard golf clubs', () => {
    expect(GOLF_CLUBS).toContain('Driver')
    expect(GOLF_CLUBS).toContain('Putter')
    expect(GOLF_CLUBS).toContain('7 Iron')
    expect(GOLF_CLUBS).toContain('Sand Wedge')
  })

  it('has 16 clubs', () => {
    expect(GOLF_CLUBS).toHaveLength(16)
  })

  it('has no duplicates', () => {
    expect(new Set(GOLF_CLUBS).size).toBe(GOLF_CLUBS.length)
  })
})

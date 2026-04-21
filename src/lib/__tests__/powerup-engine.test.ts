import { describe, it, expect } from 'vitest'
import {
  isVariablePowerup,
  canActivate,
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

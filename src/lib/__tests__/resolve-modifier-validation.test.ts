import { describe, it, expect } from 'vitest'
import { validateResolutionModifier } from '@/lib/variable-powerup-evaluator'

// Guards the /api/tournaments/[id]/powerups/resolve endpoint against any
// participant POSTing an arbitrary scoreModifier to cheat the leaderboard.

describe('validateResolutionModifier', () => {
  describe('numeric guards', () => {
    it('rejects NaN', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, NaN)
      expect(r.ok).toBe(false)
    })
    it('rejects Infinity', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, Infinity)
      expect(r.ok).toBe(false)
    })
    it('rejects fractions', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, -1.5)
      expect(r.ok).toBe(false)
    })
  })

  describe('zero is universally valid', () => {
    it('accepts 0 for a yes/no boost (No answer)', () => {
      expect(validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, 0).ok).toBe(true)
    })
    it('accepts 0 for a count attack (zero occurrences)', () => {
      expect(validateResolutionModifier('out-of-bounds', { scoring: { modifier: 1, cap: 5 } }, 0).ok).toBe(true)
    })
    it('accepts 0 even for an unknown slug (defensive — defer/no path is harmless)', () => {
      expect(validateResolutionModifier('not-a-real-slug', { scoring: { modifier: -2 } }, 0).ok).toBe(true)
    })
  })

  describe('unknown slugs', () => {
    it('rejects a non-zero modifier for a slug not in any confirmation list', () => {
      const r = validateResolutionModifier('flex', { scoring: { modifier: -2 } }, -2)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/not user-resolvable/i)
    })
  })

  describe('yes/no boost cards', () => {
    it('accepts the exact full modifier (Yes)', () => {
      expect(validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, -2).ok).toBe(true)
    })
    it('rejects double the modifier', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, -4)
      expect(r.ok).toBe(false)
    })
    it('rejects flipped sign', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, 2)
      expect(r.ok).toBe(false)
    })
    it('rejects an extreme value (the original H-1 exploit)', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: -2 } }, -50)
      expect(r.ok).toBe(false)
    })
    it('rejects when effect modifier is missing', () => {
      const r = validateResolutionModifier('big-brother', { scoring: { modifier: null } }, -2)
      expect(r.ok).toBe(false)
    })
  })

  describe('yes/no attack cards', () => {
    it('accepts the exact full modifier', () => {
      expect(validateResolutionModifier('drink-up', { scoring: { modifier: 3 } }, 3).ok).toBe(true)
    })
    it('rejects flipped sign', () => {
      expect(validateResolutionModifier('drink-up', { scoring: { modifier: 3 } }, -3).ok).toBe(false)
    })
  })

  describe('count attack cards (per-occurrence × cap)', () => {
    const effect = { scoring: { modifier: 1, cap: 3 } }

    it('accepts a multiple of the per-occurrence modifier within cap', () => {
      expect(validateResolutionModifier('out-of-bounds', effect, 1).ok).toBe(true)
      expect(validateResolutionModifier('out-of-bounds', effect, 2).ok).toBe(true)
      expect(validateResolutionModifier('out-of-bounds', effect, 3).ok).toBe(true)
    })
    it('rejects a value that exceeds the cap', () => {
      const r = validateResolutionModifier('out-of-bounds', effect, 4)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/cap/i)
    })
    it('rejects a value with the wrong sign', () => {
      expect(validateResolutionModifier('out-of-bounds', effect, -1).ok).toBe(false)
    })
    it('rejects non-multiples (e.g. modifier=2 with scoreModifier=3)', () => {
      const r = validateResolutionModifier(
        'out-of-bounds',
        { scoring: { modifier: 2, cap: 6 } },
        3,
      )
      expect(r.ok).toBe(false)
    })
    it('rejects counts > 20 even when cap is null', () => {
      const r = validateResolutionModifier(
        'proximity-mine',
        { scoring: { modifier: 1, cap: null } },
        21,
      )
      expect(r.ok).toBe(false)
    })
    it('accepts up to 20 when cap is null', () => {
      expect(
        validateResolutionModifier(
          'proximity-mine',
          { scoring: { modifier: 1, cap: null } },
          20,
        ).ok,
      ).toBe(true)
    })
  })

  describe('defensive — degenerate effects', () => {
    it('rejects modifier when effect is null', () => {
      expect(validateResolutionModifier('big-brother', null, -2).ok).toBe(false)
    })
    it('rejects modifier when effect has no scoring', () => {
      expect(validateResolutionModifier('big-brother', {}, -2).ok).toBe(false)
    })
    it('rejects modifier when scoring.modifier is 0', () => {
      expect(validateResolutionModifier('big-brother', { scoring: { modifier: 0 } }, -2).ok).toBe(false)
    })
  })
})

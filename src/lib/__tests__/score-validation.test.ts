import { describe, it, expect } from 'vitest'
import {
  maxPutts,
  isValidPutts,
  computeGir,
  canToggleGirOn,
  clampPutts,
  hasFairway,
} from '@/components/scorecard/live/score-validation'

// ─── maxPutts ──────��────────────────────────────────────────────────────────

describe('maxPutts', () => {
  it('returns 0 for null strokes', () => {
    expect(maxPutts(null)).toBe(0)
  })

  it('returns 0 for strokes < 1', () => {
    expect(maxPutts(0)).toBe(0)
    expect(maxPutts(-1)).toBe(0)
  })

  it('returns strokes - 1 for valid strokes', () => {
    expect(maxPutts(1)).toBe(0) // hole-in-one: 0 putts
    expect(maxPutts(2)).toBe(1)
    expect(maxPutts(4)).toBe(3)
    expect(maxPutts(10)).toBe(9)
    expect(maxPutts(20)).toBe(19) // max strokes boundary
  })
})

// ─── isValidPutts ���────────────────��───────────────────────────────────���─────

describe('isValidPutts', () => {
  it('allows putts = 0 (chipped in)', () => {
    expect(isValidPutts(0, 4)).toBe(true)
  })

  it('allows putts = strokes - 1 (boundary)', () => {
    expect(isValidPutts(3, 4)).toBe(true)
    expect(isValidPutts(0, 1)).toBe(true) // hole-in-one
  })

  it('rejects putts = strokes', () => {
    expect(isValidPutts(4, 4)).toBe(false)
    expect(isValidPutts(1, 1)).toBe(false)
  })

  it('rejects putts > strokes', () => {
    expect(isValidPutts(5, 4)).toBe(false)
  })

  it('rejects negative putts', () => {
    expect(isValidPutts(-1, 4)).toBe(false)
  })

  it('allows any non-negative putts when strokes is null', () => {
    expect(isValidPutts(0, null)).toBe(true)
    expect(isValidPutts(5, null)).toBe(true)
  })

  it('rejects negative putts even when strokes is null', () => {
    expect(isValidPutts(-1, null)).toBe(false)
  })
})

// ─── computeGir ���────────────────────────────────────────────────────────────

describe('computeGir', () => {
  it('returns null when strokes is null', () => {
    expect(computeGir(null, 2, 4)).toBeNull()
  })

  it('returns null when putts is null', () => {
    expect(computeGir(4, null, 4)).toBeNull()
  })

  it('returns null when both are null', () => {
    expect(computeGir(null, null, 4)).toBeNull()
  })

  // GIR = (strokes - putts) <= (par - 2)
  // Par 3: approach shots <= 1
  it('calculates GIR for par 3 — 1 approach shot', () => {
    expect(computeGir(3, 2, 3)).toBe(true)  // 3-2=1 <= 3-2=1 ✓
  })

  it('calculates GIR miss for par 3 — 2 approach shots', () => {
    expect(computeGir(4, 2, 3)).toBe(false) // 4-2=2 > 1 ✗
  })

  // Par 4: approach shots <= 2
  it('calculates GIR for par 4 — regulation', () => {
    expect(computeGir(4, 2, 4)).toBe(true)  // 4-2=2 <= 4-2=2 ✓
  })

  it('calculates GIR for par 4 — birdie with 1 putt', () => {
    expect(computeGir(3, 1, 4)).toBe(true)  // 3-1=2 <= 2 ✓
  })

  it('calculates GIR miss for par 4 — 3 approach shots', () => {
    expect(computeGir(5, 2, 4)).toBe(false) // 5-2=3 > 2 ✗
  })

  // Par 5: approach shots <= 3
  it('calculates GIR for par 5 — regulation', () => {
    expect(computeGir(5, 2, 5)).toBe(true)  // 5-2=3 <= 5-2=3 ���
  })

  it('calculates GIR for par 5 — eagle putt', () => {
    expect(computeGir(3, 1, 5)).toBe(true)  // 3-1=2 <= 3 ✓
  })

  // Edge: chipped in (0 putts)
  it('handles chip-in (0 putts)', () => {
    expect(computeGir(2, 0, 4)).toBe(true)  // 2-0=2 <= 2 ✓
    expect(computeGir(4, 0, 4)).toBe(false) // 4-0=4 > 2 ✗
  })
})

// ─── canToggleGirOn ──────────���──────────────────────────────────────────────

describe('canToggleGirOn', () => {
  it('returns false when strokes is null', () => {
    expect(canToggleGirOn(null, 2, 4)).toBe(false)
  })

  it('returns false when putts is null', () => {
    expect(canToggleGirOn(4, null, 4)).toBe(false)
  })

  it('mirrors computeGir for valid inputs', () => {
    expect(canToggleGirOn(4, 2, 4)).toBe(true)
    expect(canToggleGirOn(5, 2, 4)).toBe(false)
  })
})

// ─── clampPutts ─────────────────────────────────────────────────────────────

describe('clampPutts', () => {
  it('returns null when currentPutts is null', () => {
    expect(clampPutts(null, 4)).toBeNull()
  })

  it('returns currentPutts when newStrokes is null', () => {
    expect(clampPutts(3, null)).toBe(3)
  })

  it('leaves valid putts unchanged', () => {
    expect(clampPutts(2, 4)).toBe(2) // 2 <= 3 (maxPutts(4))
  })

  it('clamps putts down when strokes decrease', () => {
    expect(clampPutts(3, 3)).toBe(2) // 3 > maxPutts(3)=2 → clamped to 2
    expect(clampPutts(5, 4)).toBe(3) // 5 > maxPutts(4)=3 → clamped to 3
  })

  it('handles strokes = 1 (hole-in-one: max putts = 0)', () => {
    expect(clampPutts(2, 1)).toBe(0) // maxPutts(1) = 0
  })

  it('handles both null', () => {
    expect(clampPutts(null, null)).toBeNull()
  })
})

// ──�� hasFairway ─────────────────────────────────────────────────────────────

describe('hasFairway', () => {
  it('returns false for par 3 (no fairway on par 3s)', () => {
    expect(hasFairway(3)).toBe(false)
  })

  it('returns true for par 4', () => {
    expect(hasFairway(4)).toBe(true)
  })

  it('returns true for par 5', () => {
    expect(hasFairway(5)).toBe(true)
  })

  it('returns true for par 6 (rare long holes)', () => {
    expect(hasFairway(6)).toBe(true)
  })
})

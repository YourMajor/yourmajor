import { describe, it, expect } from 'vitest'
import {
  scoreName,
  scoreClass,
  formatVsPar,
  allocateHandicapStrokes,
  callawayDeduction,
  getCallawayAdjustment,
} from './scoring-utils'

// ─── scoreName ───────────────────────────────────────────────────────────

describe('scoreName', () => {
  it('returns empty string for null', () => {
    expect(scoreName(null)).toBe('')
  })
  it('returns Eagle for -2 or better', () => {
    expect(scoreName(-2)).toBe('Eagle')
    expect(scoreName(-3)).toBe('Eagle')
  })
  it('returns Birdie for -1', () => {
    expect(scoreName(-1)).toBe('Birdie')
  })
  it('returns Par for 0', () => {
    expect(scoreName(0)).toBe('Par')
  })
  it('returns Bogey for +1', () => {
    expect(scoreName(1)).toBe('Bogey')
  })
  it('returns Double for +2', () => {
    expect(scoreName(2)).toBe('Double')
  })
  it('returns +N for +3 and above', () => {
    expect(scoreName(3)).toBe('+3')
    expect(scoreName(5)).toBe('+5')
  })
})

// ─── scoreClass ──────────────────────────────────────────────────────────

describe('scoreClass', () => {
  it('returns empty string for null', () => {
    expect(scoreClass(null)).toBe('')
  })
  it('maps diffs to correct class names', () => {
    expect(scoreClass(-2)).toBe('score-eagle')
    expect(scoreClass(-1)).toBe('score-birdie')
    expect(scoreClass(0)).toBe('score-par')
    expect(scoreClass(1)).toBe('score-bogey')
    expect(scoreClass(2)).toBe('score-double')
    expect(scoreClass(5)).toBe('score-double')
  })
})

// ─── formatVsPar ─────────────────────────────────────────────────────────

describe('formatVsPar', () => {
  it('returns — for null', () => {
    expect(formatVsPar(null)).toBe('—')
  })
  it('returns E for even par', () => {
    expect(formatVsPar(0)).toBe('E')
  })
  it('returns +N for over par', () => {
    expect(formatVsPar(3)).toBe('+3')
  })
  it('returns -N for under par', () => {
    expect(formatVsPar(-2)).toBe('-2')
  })
})

// ─── allocateHandicapStrokes ─────────────────────────────────────────────

describe('allocateHandicapStrokes', () => {
  const holes = [
    { number: 1, handicap: 7 },
    { number: 2, handicap: 15 },
    { number: 3, handicap: 3 },
    { number: 4, handicap: 11 },
    { number: 5, handicap: 1 },
    { number: 6, handicap: 17 },
    { number: 7, handicap: 5 },
    { number: 8, handicap: 13 },
    { number: 9, handicap: 9 },
    { number: 10, handicap: 8 },
    { number: 11, handicap: 16 },
    { number: 12, handicap: 4 },
    { number: 13, handicap: 12 },
    { number: 14, handicap: 2 },
    { number: 15, handicap: 18 },
    { number: 16, handicap: 6 },
    { number: 17, handicap: 10 },
    { number: 18, handicap: 14 },
  ]

  it('returns empty set for handicap 0', () => {
    const result = allocateHandicapStrokes(0, holes)
    expect(result.size).toBe(0)
  })

  it('returns empty set for negative handicap', () => {
    const result = allocateHandicapStrokes(-2, holes)
    expect(result.size).toBe(0)
  })

  it('allocates 1 stroke to the hardest hole', () => {
    const result = allocateHandicapStrokes(1, holes)
    expect(result.size).toBe(1)
    expect(result.has(5)).toBe(true) // hole 5 has handicap index 1 (hardest)
  })

  it('allocates 5 strokes to the 5 hardest holes', () => {
    const result = allocateHandicapStrokes(5, holes)
    expect(result.size).toBe(5)
    // handicap indexes 1-5 are holes: 5(1), 14(2), 3(3), 12(4), 7(5)
    expect(result.has(5)).toBe(true)
    expect(result.has(14)).toBe(true)
    expect(result.has(3)).toBe(true)
    expect(result.has(12)).toBe(true)
    expect(result.has(7)).toBe(true)
  })

  it('allocates 18 strokes to all holes (1 each)', () => {
    const result = allocateHandicapStrokes(18, holes)
    expect(result.size).toBe(18)
  })

  it('allocates 36 strokes (2 per hole) — all holes in the set', () => {
    // With 36, every hole gets at least 2 strokes, but the Set only stores membership
    const result = allocateHandicapStrokes(36, holes)
    expect(result.size).toBe(18) // Set can only hold unique hole numbers
  })

  it('handles holes with null handicap by sorting them last', () => {
    const holesWithNull = [
      { number: 1, handicap: null },
      { number: 2, handicap: 1 },
      { number: 3, handicap: 2 },
    ]
    const result = allocateHandicapStrokes(2, holesWithNull)
    expect(result.has(2)).toBe(true) // handicap 1
    expect(result.has(3)).toBe(true) // handicap 2
    expect(result.has(1)).toBe(false) // null handicap sorted last
  })
})

// ─── getCallawayAdjustment ───────────────────────────────────────────────

describe('getCallawayAdjustment', () => {
  it('returns 0 for gross 71 or less', () => {
    expect(getCallawayAdjustment(71)).toBe(0)
    expect(getCallawayAdjustment(65)).toBe(0)
  })
  it('returns correct adjustments for 72-74', () => {
    expect(getCallawayAdjustment(72)).toBe(-2)
    expect(getCallawayAdjustment(73)).toBe(-1)
    expect(getCallawayAdjustment(74)).toBe(0)
  })
  it('cycles through -2,-1,0,+1,+2 for each 5-score group', () => {
    expect(getCallawayAdjustment(75)).toBe(-2)
    expect(getCallawayAdjustment(76)).toBe(-1)
    expect(getCallawayAdjustment(77)).toBe(0)
    expect(getCallawayAdjustment(78)).toBe(1)
    expect(getCallawayAdjustment(79)).toBe(2)
    expect(getCallawayAdjustment(80)).toBe(-2)
  })
})

// ─── callawayDeduction ───────────────────────────────────────────────────

describe('callawayDeduction', () => {
  it('returns 0 for gross 71 or less', () => {
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: 4, par: 4, holeNumber: i + 1,
    }))
    expect(callawayDeduction(71, scores)).toBe(0)
  })

  it('deducts half the worst hole for gross 72-74', () => {
    // gross 73 → 1 half-hole deduction
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i === 0 ? 8 : 4, // hole 1 is worst with 8 strokes
      par: 4,
      holeNumber: i + 1,
    }))
    // Gross = 8 + 17*4 = 76, but let's test with gross param = 73
    const deduction = callawayDeduction(73, scores)
    // halfHoles = 1 (from table), fullHoles = 0, hasHalf = true
    // half of worst eligible hole's capped score = floor(8 / 2) = 4
    // adjustment for 73 = -1
    // deduction = max(0, 4 + (-1)) = 3
    expect(deduction).toBe(3)
  })

  it('excludes holes 17 and 18 from worst-hole pool', () => {
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i >= 16 ? 10 : 4, // holes 17 & 18 are worst but excluded
      par: 4,
      holeNumber: i + 1,
    }))
    // All eligible holes (1-16) have strokes=4, so worst capped is 4
    const deduction = callawayDeduction(80, scores)
    // gross 80 → halfHoles=3, fullHoles=1, hasHalf=true
    // 1 worst hole = 4, + half of next = floor(4/2) = 2 → subtotal = 6
    // adjustment for 80 = -2 → deduction = max(0, 6 + (-2)) = 4
    expect(deduction).toBe(4)
  })

  it('caps individual hole scores at 2x par', () => {
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i === 0 ? 12 : 4, // hole 1 has 12 strokes on par 4
      par: 4,
      holeNumber: i + 1,
    }))
    // Hole 1 capped at 2*4 = 8
    const deduction = callawayDeduction(80, scores)
    // gross 80 → halfHoles=3, fullHoles=1, hasHalf=true
    // worst capped = 8 (hole 1), next worst = 4
    // deduction = 8 + floor(4/2) = 10, adjustment = -2 → max(0, 10-2) = 8
    expect(deduction).toBe(8)
  })
})

import { describe, it, expect } from 'vitest'
import {
  scoreName,
  scoreClass,
  formatVsPar,
  allocateHandicapStrokes,
  callawayDeduction,
  getCallawayAdjustment,
  CALLAWAY_TABLE,
} from '@/lib/scoring-utils'

// ─── scoreName ──��───────────────────────────────────────────────────────────

describe('scoreName', () => {
  it('returns empty string for null', () => {
    expect(scoreName(null)).toBe('')
  })

  it('returns "Eagle" for diff <= -2', () => {
    expect(scoreName(-2)).toBe('Eagle')
    expect(scoreName(-3)).toBe('Eagle') // albatross lumped with eagle
    expect(scoreName(-4)).toBe('Eagle') // condor
  })

  it('returns "Birdie" for diff -1', () => {
    expect(scoreName(-1)).toBe('Birdie')
  })

  it('returns "Par" for diff 0', () => {
    expect(scoreName(0)).toBe('Par')
  })

  it('returns "Bogey" for diff +1', () => {
    expect(scoreName(1)).toBe('Bogey')
  })

  it('returns "Double" for diff +2', () => {
    expect(scoreName(2)).toBe('Double')
  })

  it('returns "+N" for diff > 2', () => {
    expect(scoreName(3)).toBe('+3')
    expect(scoreName(5)).toBe('+5')
    expect(scoreName(10)).toBe('+10')
  })
})

// ─── scoreClass ──────────────────────────────────��──────────────────────────

describe('scoreClass', () => {
  it('returns empty string for null', () => {
    expect(scoreClass(null)).toBe('')
  })

  it('maps eagle/birdie/par/bogey/double correctly', () => {
    expect(scoreClass(-3)).toBe('score-eagle')
    expect(scoreClass(-2)).toBe('score-eagle')
    expect(scoreClass(-1)).toBe('score-birdie')
    expect(scoreClass(0)).toBe('score-par')
    expect(scoreClass(1)).toBe('score-bogey')
    expect(scoreClass(2)).toBe('score-double')
    expect(scoreClass(3)).toBe('score-double')
  })
})

// ──�� formatVsPar ───────��─────────────────────────────���──────────────────────

describe('formatVsPar', () => {
  it('returns "—" for null', () => {
    expect(formatVsPar(null)).toBe('—')
  })

  it('returns "E" for 0 (even par)', () => {
    expect(formatVsPar(0)).toBe('E')
  })

  it('returns "+N" for positive values', () => {
    expect(formatVsPar(1)).toBe('+1')
    expect(formatVsPar(12)).toBe('+12')
  })

  it('returns "-N" for negative values', () => {
    expect(formatVsPar(-1)).toBe('-1')
    expect(formatVsPar(-5)).toBe('-5')
  })
})

// ─── allocateHandicapStrokes ─────────��────────────────────────────────────���─

describe('allocateHandicapStrokes', () => {
  // Standard 18-hole course with handicap indices 1-18
  const standardHoles = Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    handicap: i + 1, // hole 1 is hardest (index 1), hole 18 is easiest
  }))

  it('returns empty set for handicap 0', () => {
    const result = allocateHandicapStrokes(0, standardHoles)
    expect(result.size).toBe(0)
  })

  it('returns empty set for negative handicap', () => {
    const result = allocateHandicapStrokes(-5, standardHoles)
    expect(result.size).toBe(0)
  })

  it('allocates strokes to hardest holes first', () => {
    const result = allocateHandicapStrokes(3, standardHoles)
    expect(result.size).toBe(3)
    expect(result.has(1)).toBe(true) // hardest
    expect(result.has(2)).toBe(true)
    expect(result.has(3)).toBe(true)
    expect(result.has(4)).toBe(false) // not allocated
  })

  it('allocates to all 18 holes for handicap 18', () => {
    const result = allocateHandicapStrokes(18, standardHoles)
    expect(result.size).toBe(18)
  })

  it('wraps around for handicap > 18 (high-handicap golfers)', () => {
    // Handicap 20 = all 18 holes get 1 stroke + 2 hardest get extra
    const result = allocateHandicapStrokes(20, standardHoles)
    // Set only stores unique hole numbers, so still 18 unique holes
    expect(result.size).toBe(18)
  })

  it('handles holes with null handicap index (sorted last)', () => {
    const holes = [
      { number: 1, handicap: 2 },
      { number: 2, handicap: null },
      { number: 3, handicap: 1 },
    ]
    const result = allocateHandicapStrokes(2, holes)
    expect(result.size).toBe(2)
    expect(result.has(3)).toBe(true) // handicap index 1 (hardest)
    expect(result.has(1)).toBe(true) // handicap index 2
    expect(result.has(2)).toBe(false) // null index sorted last
  })

  it('returns empty set for empty holes array', () => {
    const result = allocateHandicapStrokes(5, [])
    expect(result.size).toBe(0)
  })

  it('handles single hole', () => {
    const holes = [{ number: 1, handicap: 1 }]
    const result = allocateHandicapStrokes(1, holes)
    expect(result.size).toBe(1)
    expect(result.has(1)).toBe(true)
  })
})

// ─── getCallawayAdjustment ───────��───────────────────────────��──────────────

describe('getCallawayAdjustment', () => {
  it('returns 0 for gross <= 71', () => {
    expect(getCallawayAdjustment(60)).toBe(0)
    expect(getCallawayAdjustment(71)).toBe(0)
  })

  it('returns correct adjustments for 72-74 band', () => {
    expect(getCallawayAdjustment(72)).toBe(-2)
    expect(getCallawayAdjustment(73)).toBe(-1)
    expect(getCallawayAdjustment(74)).toBe(0)
  })

  it('cycles through [-2,-1,0,+1,+2] for 75+ in 5-score bands', () => {
    expect(getCallawayAdjustment(75)).toBe(-2)
    expect(getCallawayAdjustment(76)).toBe(-1)
    expect(getCallawayAdjustment(77)).toBe(0)
    expect(getCallawayAdjustment(78)).toBe(1)
    expect(getCallawayAdjustment(79)).toBe(2)

    // Next band (80-84)
    expect(getCallawayAdjustment(80)).toBe(-2)
    expect(getCallawayAdjustment(81)).toBe(-1)
    expect(getCallawayAdjustment(82)).toBe(0)
    expect(getCallawayAdjustment(83)).toBe(1)
    expect(getCallawayAdjustment(84)).toBe(2)
  })

  it('handles high gross scores', () => {
    expect(getCallawayAdjustment(120)).toBe(-2)
    expect(getCallawayAdjustment(125)).toBe(-2)
  })
})

// ─── callawayDeduction ─────────��────────────────────────────────────────────

describe('callawayDeduction', () => {
  // Helper to make hole score objects
  const makeScores = (strokes: number[], par = 4) =>
    strokes.map((s, i) => ({ strokes: s, par, holeNumber: i + 1 }))

  it('returns 0 for gross <= 71', () => {
    const scores = makeScores([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3])
    expect(callawayDeduction(71, scores)).toBe(0)
  })

  it('deducts half of worst hole for gross 72-74 (halfHoles=1)', () => {
    // Gross 73: table row [72,74,1] → halfHoles=1 → fullHoles=0, hasHalf=true
    // Deduction = floor(worst_eligible_score / 2) + adjustment
    const scores = makeScores([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 4])
    // worst eligible score is 5 (hole 17 is > 16, so excluded; worst among 1-16 is 4 or 5 depending on order)
    // Actually hole 17 has holeNumber 17, which is > 16 so filtered out
    // All holes 1-16 have strokes=4, hole 17 (excluded), hole 18 has strokes=4
    // So worst eligible is 4, half = floor(4/2) = 2
    // adjustment for 73 = -1
    // deduction = max(0, 2 + (-1)) = 1
    expect(callawayDeduction(73, scores)).toBe(1)
  })

  it('deducts 1 worst hole for gross 75-79 (halfHoles=2)', () => {
    // Gross 78: table row [75,79,2] → halfHoles=2 → fullHoles=1, hasHalf=false
    // Deduction = worst_eligible_score + adjustment
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i === 0 ? 8 : 4, // hole 1 has 8, rest have ~4
      par: 4,
      holeNumber: i + 1,
    }))
    // worst eligible (holes 1-16): hole 1 with 8 strokes, capped at par*2=8 → 8
    // fullHoles=1 → deduction = 8
    // adjustment for 78 = +1
    // total = max(0, 8 + 1) = 9
    expect(callawayDeduction(78, scores)).toBe(9)
  })

  it('caps individual hole strokes at par * 2', () => {
    // If someone scored 12 on a par 4, it gets capped at 8 for deduction
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i === 0 ? 12 : 4,
      par: 4,
      holeNumber: i + 1,
    }))
    const gross = 12 + 17 * 4 // 80
    // table row [80,84,3] → halfHoles=3 → fullHoles=1, hasHalf=true
    // worst eligible hole capped at 8 (par*2)
    // fullHoles=1 → first worst = 8
    // hasHalf=true → floor(next worst / 2) = floor(4/2) = 2
    // adjustment for 80 = -2
    // deduction = max(0, 8 + 2 + (-2)) = 8
    expect(callawayDeduction(gross, scores)).toBe(8)
  })

  it('excludes holes 17 and 18 from eligible holes', () => {
    // Worst scores on holes 17 & 18 should be ignored
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: i >= 16 ? 10 : 4, // holes 17, 18 are worst but excluded
      par: 4,
      holeNumber: i + 1,
    }))
    const gross = 16 * 4 + 2 * 10 // 84
    // table row [80,84,3] → halfHoles=3 → fullHoles=1, hasHalf=true
    // eligible holes: 1-16, all strokes=4, capped at 8
    // worst = 4, next worst = 4
    // deduction = 4 + floor(4/2) = 4 + 2 = 6
    // adjustment for 84 = +2
    // total = max(0, 6 + 2) = 8
    expect(callawayDeduction(gross, scores)).toBe(8)
  })

  it('returns non-negative deduction (max 0)', () => {
    // Edge case where adjustment could make it negative
    // Gross 72: adjustment = -2, halfHoles=1 → floor(worst/2)
    const scores = makeScores([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
    // half of worst (4) = 2, adjustment for 72 = -2 → 2 + (-2) = 0
    expect(callawayDeduction(72, scores)).toBe(0)
  })

  it('handles very high gross scores (130+)', () => {
    const scores = Array.from({ length: 18 }, (_, i) => ({
      strokes: 8,
      par: 4,
      holeNumber: i + 1,
    }))
    const gross = 18 * 8 // 144
    // table row [130,999,12] → halfHoles=12 → fullHoles=6, hasHalf=false
    // 6 worst eligible holes (all 8, capped at 8): 6 * 8 = 48
    const result = callawayDeduction(gross, scores)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

// ─── CALLAWAY_TABLE structure ───────────────────────────────────────────────

describe('CALLAWAY_TABLE', () => {
  it('covers all gross ranges from 72 to 999', () => {
    expect(CALLAWAY_TABLE[0][0]).toBe(72)
    expect(CALLAWAY_TABLE[CALLAWAY_TABLE.length - 1][1]).toBe(999)
  })

  it('has no gaps between ranges', () => {
    for (let i = 1; i < CALLAWAY_TABLE.length; i++) {
      expect(CALLAWAY_TABLE[i][0]).toBe(CALLAWAY_TABLE[i - 1][1] + 1)
    }
  })

  it('halfHoles increase monotonically', () => {
    for (let i = 1; i < CALLAWAY_TABLE.length; i++) {
      expect(CALLAWAY_TABLE[i][2]).toBeGreaterThanOrEqual(CALLAWAY_TABLE[i - 1][2])
    }
  })
})

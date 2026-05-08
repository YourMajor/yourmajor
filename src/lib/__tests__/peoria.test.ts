import { describe, it, expect } from 'vitest'
import {
  selectPeoriaHoles,
  computePeoriaHandicap,
  cappedPeoriaScore,
  isPeoriaRoundComplete,
} from '@/lib/peoria'

// Standard par-72 layout: par 4-4-3-5-4-4-4-3-5 / 4-4-3-5-4-4-4-3-5 = 72.
// Two par-3 (3, 8 / 12, 17), four par-5 (4, 9 / 13, 18 — actually two), …
// Build a balanced course with 2 par-3, 5 par-4, 2 par-5 per nine for clean
// selection-rule testing.
const balancedCourse = [
  // Front nine
  { number: 1, par: 4 }, { number: 2, par: 4 }, { number: 3, par: 3 },
  { number: 4, par: 5 }, { number: 5, par: 4 }, { number: 6, par: 4 },
  { number: 7, par: 4 }, { number: 8, par: 3 }, { number: 9, par: 5 },
  // Back nine
  { number: 10, par: 4 }, { number: 11, par: 4 }, { number: 12, par: 3 },
  { number: 13, par: 5 }, { number: 14, par: 4 }, { number: 15, par: 4 },
  { number: 16, par: 4 }, { number: 17, par: 3 }, { number: 18, par: 5 },
]

const COURSE_PAR = 72

describe('selectPeoriaHoles', () => {
  it('picks 6 holes — 2 par-3, 2 par-4, 2 par-5', () => {
    const holes = selectPeoriaHoles(balancedCourse)
    expect(holes).toHaveLength(6)
    const pars = holes.map((n) => balancedCourse.find((h) => h.number === n)!.par).sort()
    expect(pars).toEqual([3, 3, 4, 4, 5, 5])
  })

  it('picks one par-3 from each nine when both nines have par-3s', () => {
    const holes = selectPeoriaHoles(balancedCourse)
    const par3s = holes.filter((n) => balancedCourse.find((h) => h.number === n)!.par === 3)
    expect(par3s).toHaveLength(2)
    expect(par3s.some((n) => n <= 9)).toBe(true)
    expect(par3s.some((n) => n >= 10)).toBe(true)
  })

  it('picks one par-5 from each nine when both nines have par-5s', () => {
    const holes = selectPeoriaHoles(balancedCourse)
    const par5s = holes.filter((n) => balancedCourse.find((h) => h.number === n)!.par === 5)
    expect(par5s).toHaveLength(2)
    expect(par5s.some((n) => n <= 9)).toBe(true)
    expect(par5s.some((n) => n >= 10)).toBe(true)
  })

  it('returns ascending-sorted hole numbers', () => {
    const holes = selectPeoriaHoles(balancedCourse)
    for (let i = 1; i < holes.length; i++) {
      expect(holes[i]).toBeGreaterThan(holes[i - 1])
    }
  })

  it('is deterministic with a seeded RNG', () => {
    let seed = 0
    const rng = () => {
      // Simple deterministic LCG.
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const a = selectPeoriaHoles(balancedCourse, rng)
    seed = 0
    const b = selectPeoriaHoles(balancedCourse, rng)
    expect(a).toEqual(b)
  })

  it('falls back to whole-course pick when one nine has no par-3', () => {
    const lopsided = balancedCourse.map((h) =>
      h.number === 12 || h.number === 17 ? { ...h, par: 4 } : h,
    )
    // Now back-nine has zero par-3s; front-nine has two (holes 3, 8). Selection
    // should still produce 6 holes, 2 of each par class.
    const holes = selectPeoriaHoles(lopsided)
    const pars = holes.map((n) => lopsided.find((h) => h.number === n)!.par).sort()
    expect(pars).toEqual([3, 3, 4, 4, 5, 5])
  })

  it('throws when course has fewer than two holes of a par class', () => {
    const noPar5s = balancedCourse.map((h) => (h.par === 5 ? { ...h, par: 4 } : h))
    expect(() => selectPeoriaHoles(noPar5s)).toThrow(/par-5/)
  })
})

describe('cappedPeoriaScore', () => {
  it('caps at 2× par on a blow-up hole', () => {
    expect(cappedPeoriaScore(9, 4)).toBe(8)
    expect(cappedPeoriaScore(11, 5)).toBe(10)
  })
  it('passes through a normal score unchanged', () => {
    expect(cappedPeoriaScore(4, 4)).toBe(4)
    expect(cappedPeoriaScore(3, 3)).toBe(3)
    expect(cappedPeoriaScore(2, 4)).toBe(2)  // birdie/eagle preserved
  })
})

describe('computePeoriaHandicap', () => {
  it('worked example: 6 pars on a par-72 course → handicap 0', () => {
    // Pars on the 6 secret holes (2 par-3, 2 par-4, 2 par-5) sum to 24.
    // Projected gross = 24 * 3 = 72 = course par → raw 0 → handicap 0.
    expect(computePeoriaHandicap(24, COURSE_PAR)).toBe(0)
  })

  it('worked example: cappedSum 36 on par-72 → 80% of 36 = ~29', () => {
    // sum 36 → projected 108 → raw 36 → 36 * 0.8 = 28.8 → round to 29
    expect(computePeoriaHandicap(36, COURSE_PAR)).toBe(29)
  })

  it('clamps to 36 on extreme blow-ups', () => {
    // sum 50 → projected 150 → raw 78 → 0.8 = 62.4 → round 62 → clamp 36
    expect(computePeoriaHandicap(50, COURSE_PAR)).toBe(36)
  })

  it('clamps at 0 when projected gross is below par', () => {
    // sum 22 → projected 66 → raw -6 → -4.8 → round -5 → clamp 0
    expect(computePeoriaHandicap(22, COURSE_PAR)).toBe(0)
  })
})

describe('isPeoriaRoundComplete', () => {
  it('returns true when every participant has 18 distinct holes', () => {
    const all18 = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
    const map = new Map<string, Set<number>>([['p1', all18], ['p2', new Set(all18)]])
    expect(isPeoriaRoundComplete(map, ['p1', 'p2'])).toBe(true)
  })

  it('returns false when any participant has fewer than 18', () => {
    const all18 = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
    const partial = new Set([1, 2, 3])
    const map = new Map<string, Set<number>>([['p1', all18], ['p2', partial]])
    expect(isPeoriaRoundComplete(map, ['p1', 'p2'])).toBe(false)
  })

  it('returns false when a participant has no scores at all', () => {
    const all18 = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
    const map = new Map<string, Set<number>>([['p1', all18]])
    expect(isPeoriaRoundComplete(map, ['p1', 'p2'])).toBe(false)
  })

  it('returns false on empty participant list', () => {
    expect(isPeoriaRoundComplete(new Map(), [])).toBe(false)
  })
})

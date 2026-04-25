import { describe, it, expect } from 'vitest'
import {
  stablefordPoints,
  STABLEFORD_DEFAULT,
  MODIFIED_STABLEFORD_DEFAULT,
  quotaTarget,
  quotaPointsFor,
  skinsPerHole,
  bestBallSelect,
  matchPlayStatus,
} from '@/lib/scoring-utils'

describe('stablefordPoints (default table)', () => {
  it('eagle = 4, birdie = 3, par = 2, bogey = 1, double+ = 0', () => {
    expect(stablefordPoints(-2, STABLEFORD_DEFAULT)).toBe(4)
    expect(stablefordPoints(-1, STABLEFORD_DEFAULT)).toBe(3)
    expect(stablefordPoints(0, STABLEFORD_DEFAULT)).toBe(2)
    expect(stablefordPoints(1, STABLEFORD_DEFAULT)).toBe(1)
    expect(stablefordPoints(2, STABLEFORD_DEFAULT)).toBe(0)
    expect(stablefordPoints(3, STABLEFORD_DEFAULT)).toBe(0)
  })

  it('treats -3 (albatross) as eagle bucket', () => {
    expect(stablefordPoints(-3, STABLEFORD_DEFAULT)).toBe(4)
  })
})

describe('stablefordPoints (modified table)', () => {
  it('eagle = 5, birdie = 2, par = 0, bogey = -1, double+ = -3', () => {
    expect(stablefordPoints(-2, MODIFIED_STABLEFORD_DEFAULT)).toBe(5)
    expect(stablefordPoints(-1, MODIFIED_STABLEFORD_DEFAULT)).toBe(2)
    expect(stablefordPoints(0, MODIFIED_STABLEFORD_DEFAULT)).toBe(0)
    expect(stablefordPoints(1, MODIFIED_STABLEFORD_DEFAULT)).toBe(-1)
    expect(stablefordPoints(2, MODIFIED_STABLEFORD_DEFAULT)).toBe(-3)
  })
})

describe('quotaTarget', () => {
  it('scratch player → quota 36', () => {
    expect(quotaTarget(0)).toBe(36)
  })
  it('handicap 18 → quota 18', () => {
    expect(quotaTarget(18)).toBe(18)
  })
  it('handicap 36 → quota 0', () => {
    expect(quotaTarget(36)).toBe(0)
  })
  it('caps at 0 for very high handicaps', () => {
    expect(quotaTarget(40)).toBe(0)
  })
})

describe('quotaPointsFor (default)', () => {
  it('eagle 8, birdie 4, par 2, bogey 1, double 0', () => {
    expect(quotaPointsFor(-2)).toBe(8)
    expect(quotaPointsFor(-1)).toBe(4)
    expect(quotaPointsFor(0)).toBe(2)
    expect(quotaPointsFor(1)).toBe(1)
    expect(quotaPointsFor(2)).toBe(0)
  })
})

describe('skinsPerHole', () => {
  it('awards a skin to the unique low score', () => {
    const wins = skinsPerHole([
      [
        { tournamentPlayerId: 'a', strokes: 4 },
        { tournamentPlayerId: 'b', strokes: 5 },
        { tournamentPlayerId: 'c', strokes: 6 },
      ],
    ])
    expect(wins).toEqual({ a: 1 })
  })

  it('carries over on tied low scores', () => {
    const wins = skinsPerHole([
      [
        { tournamentPlayerId: 'a', strokes: 4 },
        { tournamentPlayerId: 'b', strokes: 4 },
      ],
      [
        { tournamentPlayerId: 'a', strokes: 5 },
        { tournamentPlayerId: 'b', strokes: 4 },
      ],
    ])
    // hole 1 ties → 1 carry; hole 2 b wins outright → 1 + 1 carry = 2
    expect(wins).toEqual({ b: 2 })
  })

  it('does not carry when carryOver=false', () => {
    const wins = skinsPerHole(
      [
        [
          { tournamentPlayerId: 'a', strokes: 4 },
          { tournamentPlayerId: 'b', strokes: 4 },
        ],
        [
          { tournamentPlayerId: 'a', strokes: 5 },
          { tournamentPlayerId: 'b', strokes: 4 },
        ],
      ],
      false,
    )
    expect(wins).toEqual({ b: 1 })
  })

  it('skips holes where all scores are null', () => {
    const wins = skinsPerHole([
      [
        { tournamentPlayerId: 'a', strokes: null },
        { tournamentPlayerId: 'b', strokes: null },
      ],
    ])
    expect(wins).toEqual({})
  })
})

describe('bestBallSelect', () => {
  it('picks the lowest non-null per hole', () => {
    const team = [
      [4, 5, null],
      [3, null, 6],
      [null, null, null],
    ]
    expect(bestBallSelect(team)).toEqual([4, 3, null])
  })
})

describe('matchPlayStatus', () => {
  it('reports "AS" when leads cancel', () => {
    expect(matchPlayStatus([1, -1, 1, -1])).toEqual({ up: 0, through: 4, closed: false })
  })

  it('returns closed when lead exceeds remaining holes', () => {
    // 5 up through 13 → 5 holes left; lead = 5 > 5 ? no — but lead = 6 > 5 closes
    const winners = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // 12 wins = 12 up after 12
    // remaining = 6, |12|>6 → closed
    expect(matchPlayStatus(winners).closed).toBe(true)
  })

  it('counts halved holes correctly', () => {
    expect(matchPlayStatus([0, 0, 0])).toEqual({ up: 0, through: 3, closed: false })
  })
})

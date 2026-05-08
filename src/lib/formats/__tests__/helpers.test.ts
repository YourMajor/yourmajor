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
import { isSingleTeamScoreFormat } from '@/lib/formats'

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
    const { wins, outcomes } = skinsPerHole([
      {
        round: 1, hole: 1, scores: [
          { tournamentPlayerId: 'a', strokes: 4 },
          { tournamentPlayerId: 'b', strokes: 5 },
          { tournamentPlayerId: 'c', strokes: 6 },
        ],
      },
    ])
    expect(wins).toEqual({ a: 1 })
    expect(outcomes).toEqual([
      { round: 1, hole: 1, winnerId: 'a', carryEntering: 0, skinsAwarded: 1 },
    ])
  })

  it('carries over on tied low scores', () => {
    const { wins, outcomes } = skinsPerHole([
      {
        round: 1, hole: 1, scores: [
          { tournamentPlayerId: 'a', strokes: 4 },
          { tournamentPlayerId: 'b', strokes: 4 },
        ],
      },
      {
        round: 1, hole: 2, scores: [
          { tournamentPlayerId: 'a', strokes: 5 },
          { tournamentPlayerId: 'b', strokes: 4 },
        ],
      },
    ])
    // hole 1 ties → 1 carry; hole 2 b wins outright → 1 + 1 carry = 2
    expect(wins).toEqual({ b: 2 })
    expect(outcomes[0]).toEqual({ round: 1, hole: 1, winnerId: null, carryEntering: 0, skinsAwarded: 0 })
    expect(outcomes[1]).toEqual({ round: 1, hole: 2, winnerId: 'b', carryEntering: 1, skinsAwarded: 2 })
  })

  it('does not carry when carryOver=false', () => {
    const { wins } = skinsPerHole(
      [
        {
          round: 1, hole: 1, scores: [
            { tournamentPlayerId: 'a', strokes: 4 },
            { tournamentPlayerId: 'b', strokes: 4 },
          ],
        },
        {
          round: 1, hole: 2, scores: [
            { tournamentPlayerId: 'a', strokes: 5 },
            { tournamentPlayerId: 'b', strokes: 4 },
          ],
        },
      ],
      false,
    )
    expect(wins).toEqual({ b: 1 })
  })

  it('skips holes where all scores are null', () => {
    const { wins, outcomes } = skinsPerHole([
      {
        round: 1, hole: 1, scores: [
          { tournamentPlayerId: 'a', strokes: null },
          { tournamentPlayerId: 'b', strokes: null },
        ],
      },
    ])
    expect(wins).toEqual({})
    expect(outcomes).toEqual([])
  })

  it('carryover propagates across rounds', () => {
    const { wins, outcomes } = skinsPerHole([
      // Round 1, hole 18 — tied, carry of 1.
      { round: 1, hole: 18, scores: [{ tournamentPlayerId: 'a', strokes: 4 }, { tournamentPlayerId: 'b', strokes: 4 }] },
      // Round 2, hole 1 — a wins outright; should claim 1 + carryEntering=1 = 2 skins.
      { round: 2, hole: 1, scores: [{ tournamentPlayerId: 'a', strokes: 3 }, { tournamentPlayerId: 'b', strokes: 4 }] },
    ])
    expect(wins).toEqual({ a: 2 })
    expect(outcomes[1]).toEqual({ round: 2, hole: 1, winnerId: 'a', carryEntering: 1, skinsAwarded: 2 })
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
    expect(matchPlayStatus([1, -1, 1, -1])).toMatchObject({ up: 0, through: 4, closed: false, status: 'AS' })
  })

  it('returns closed when lead exceeds remaining holes', () => {
    const winners = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // 12 wins = 12 up after 12
    // remaining = 6, |12|>6 → closed
    expect(matchPlayStatus(winners)).toMatchObject({ closed: true, status: 'closed' })
  })

  it('counts halved holes correctly', () => {
    expect(matchPlayStatus([0, 0, 0])).toMatchObject({ up: 0, through: 3, status: 'AS' })
  })

  it('reports dormie when lead equals remaining holes', () => {
    // 4 up through 14 → 4 remaining; |4|==4 → dormie
    const winners = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(matchPlayStatus(winners)).toMatchObject({ up: 4, through: 14, closed: false, status: 'dormie' })
  })

  it('reports final when every hole has been played and match remains tied', () => {
    const winners = Array.from({ length: 18 }, () => 0)
    expect(matchPlayStatus(winners)).toMatchObject({ up: 0, through: 18, status: 'final' })
  })

  it('reports live when lead is positive but less than remaining', () => {
    expect(matchPlayStatus([1, 0, 0])).toMatchObject({ up: 1, through: 3, status: 'live' })
  })

  it('5&4-style closing: 5 up through 14, no remaining', () => {
    const winners = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]   // +5 after 14
    // remaining = 4, |5|>4 → closed at hole 14
    expect(matchPlayStatus(winners)).toMatchObject({ up: 5, through: 14, closed: true, status: 'closed' })
  })
})

describe('isSingleTeamScoreFormat', () => {
  it('matches scramble-family formats', () => {
    expect(isSingleTeamScoreFormat('SCRAMBLE')).toBe(true)
    expect(isSingleTeamScoreFormat('SHAMBLE')).toBe(true)
    expect(isSingleTeamScoreFormat('CHAPMAN')).toBe(true)
    expect(isSingleTeamScoreFormat('PINEHURST')).toBe(true)
  })
  it('does NOT match best-ball formats (each member plays own ball)', () => {
    expect(isSingleTeamScoreFormat('BEST_BALL')).toBe(false)
    expect(isSingleTeamScoreFormat('BEST_BALL_2')).toBe(false)
    expect(isSingleTeamScoreFormat('BEST_BALL_4')).toBe(false)
  })
  it('does NOT match individual / match formats', () => {
    expect(isSingleTeamScoreFormat('STROKE_PLAY')).toBe(false)
    expect(isSingleTeamScoreFormat('STABLEFORD')).toBe(false)
    expect(isSingleTeamScoreFormat('MATCH_PLAY')).toBe(false)
    expect(isSingleTeamScoreFormat('NASSAU')).toBe(false)
  })
  it('handles null/undefined safely', () => {
    expect(isSingleTeamScoreFormat(null)).toBe(false)
    expect(isSingleTeamScoreFormat(undefined)).toBe(false)
    expect(isSingleTeamScoreFormat('')).toBe(false)
  })
})

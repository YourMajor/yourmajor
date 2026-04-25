import { describe, it, expect } from 'vitest'
import { strokePlayStrategy } from '@/lib/formats/strokePlay'
import { stablefordStrategy, modifiedStablefordStrategy } from '@/lib/formats/stableford'
import { skinsGrossStrategy } from '@/lib/formats/skins'
import { bestBall2Strategy } from '@/lib/formats/bestBall'
import { scrambleStrategy } from '@/lib/formats/scramble'
import { matchPlayStrategy } from '@/lib/formats/match'
import { quotaStrategy } from '@/lib/formats/quota'
import type { ScoringContext, ScoringPlayer } from '@/lib/formats/types'

const PAR_72_HOLES = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: i % 3 === 2 ? 5 : i % 3 === 1 ? 4 : 3,   // 6 par-3, 6 par-4, 6 par-5 alternating; total = 72
  handicap: ((i + 7) % 18) + 1,
}))

const SUM_PAR = PAR_72_HOLES.reduce((s, h) => s + h.par, 0)

function makePlayer(
  id: string,
  name: string,
  handicap: number,
  scoreFn: (h: { number: number; par: number }) => number,
  roundNumber = 1,
): ScoringPlayer {
  return {
    tournamentPlayerId: id,
    userId: `u-${id}`,
    name,
    avatarUrl: null,
    handicap,
    scoreModifier: 0,
    teamId: null,
    scores: PAR_72_HOLES.map((h) => ({
      holeNumber: h.number,
      par: h.par,
      strokes: scoreFn(h),
      handicap: h.handicap,
      roundNumber,
    })),
  }
}

function makeCtx(overrides: Partial<ScoringContext>): ScoringContext {
  return {
    tournamentId: 't1',
    format: 'STROKE_PLAY',
    formatConfig: null,
    handicapSystem: 'NONE',
    holes: PAR_72_HOLES,
    rounds: [{ roundNumber: 1, par: SUM_PAR }],
    players: [],
    teams: [],
    ...overrides,
  }
}

describe('strokePlayStrategy (no handicap)', () => {
  it('ranks by lowest gross', () => {
    const ctx = makeCtx({
      players: [
        makePlayer('alice', 'Alice', 0, () => 4),     // 72 (par)
        makePlayer('bob', 'Bob', 0, (h) => h.par + 1), // 90
        makePlayer('carol', 'Carol', 0, (h) => h.par - 1), // 54
      ],
    })
    const standings = strokePlayStrategy.computeStandings(ctx)
    expect(standings.map((s) => s.playerName)).toEqual(['Carol', 'Alice', 'Bob'])
    expect(standings[0].rank).toBe(1)
  })
})

describe('stablefordStrategy', () => {
  it('ranks by highest points (default table)', () => {
    const ctx = makeCtx({
      format: 'STABLEFORD',
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par),     // all pars → 36 points
        makePlayer('bob', 'Bob', 0, (h) => h.par - 1),     // all birdies → 54 points
      ],
    })
    const standings = stablefordStrategy.computeStandings(ctx)
    expect(standings[0].playerName).toBe('Bob')
    expect(standings[0].points).toBe(54)
    expect(standings[1].points).toBe(36)
  })
})

describe('modifiedStablefordStrategy', () => {
  it('uses modified table by default', () => {
    const ctx = makeCtx({
      format: 'MODIFIED_STABLEFORD',
      players: [makePlayer('alice', 'Alice', 0, (h) => h.par - 1)], // all birdies = 18 × 2 = 36
    })
    const standings = modifiedStablefordStrategy.computeStandings(ctx)
    expect(standings[0].points).toBe(36)
  })
})

describe('skinsGrossStrategy', () => {
  it('awards skins to a player with all unique-low scores', () => {
    const ctx = makeCtx({
      format: 'SKINS_GROSS',
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par - 1),
        makePlayer('bob', 'Bob', 0, (h) => h.par),
        makePlayer('carol', 'Carol', 0, (h) => h.par + 1),
      ],
    })
    const standings = skinsGrossStrategy.computeStandings(ctx)
    expect(standings[0].playerName).toBe('Alice')
    expect(standings[0].points).toBe(18)   // wins all 18 outright
  })
})

describe('bestBall2Strategy', () => {
  it('picks lower team-member score per hole', () => {
    const ctx = makeCtx({
      format: 'BEST_BALL_2',
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par + 2),
        makePlayer('bob', 'Bob', 0, (h) => h.par - 1),
      ],
      teams: [{ id: 'team1', name: 'Team Alpha', color: null, memberIds: ['alice', 'bob'] }],
    })
    const standings = bestBall2Strategy.computeStandings(ctx)
    expect(standings).toHaveLength(1)
    expect(standings[0].playerName).toBe('Team Alpha')
    // Best ball selects bob's all-birdies → 54
    expect(standings[0].grossTotal).toBe(SUM_PAR - 18)
  })
})

describe('scrambleStrategy', () => {
  it('uses lowest entered score per team-hole', () => {
    const ctx = makeCtx({
      format: 'SCRAMBLE',
      players: [
        makePlayer('a', 'A', 0, (h) => h.par + 3),
        makePlayer('b', 'B', 0, (h) => h.par),
      ],
      teams: [{ id: 'team1', name: 'Aces', color: null, memberIds: ['a', 'b'] }],
    })
    const standings = scrambleStrategy.computeStandings(ctx)
    expect(standings[0].grossTotal).toBe(SUM_PAR)   // takes B's pars
  })
})

describe('matchPlayStrategy', () => {
  it('ranks by hole wins minus losses', () => {
    const ctx = makeCtx({
      format: 'MATCH_PLAY',
      players: [
        makePlayer('alice', 'Alice', 0, () => 3),    // wins every hole
        makePlayer('bob', 'Bob', 0, () => 5),
      ],
    })
    const standings = matchPlayStrategy.computeStandings(ctx)
    expect(standings[0].playerName).toBe('Alice')
    expect(standings[0].points).toBe(18)
    expect(standings[1].points).toBe(-18)
  })
})

describe('quotaStrategy', () => {
  it('positive overUnder for a low-handicap player making pars', () => {
    const ctx = makeCtx({
      format: 'QUOTA',
      handicapSystem: 'NONE',
      players: [makePlayer('alice', 'Alice', 0, (h) => h.par)], // 18 × 2 = 36 points; quota 36 → 0
    })
    const standings = quotaStrategy.computeStandings(ctx)
    expect(standings[0].points).toBe(0)
  })
})

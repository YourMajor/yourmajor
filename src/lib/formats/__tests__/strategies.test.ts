import { describe, it, expect } from 'vitest'
import { strokePlayStrategy } from '@/lib/formats/strokePlay'
import { stablefordStrategy, modifiedStablefordStrategy } from '@/lib/formats/stableford'
import { skinsGrossStrategy } from '@/lib/formats/skins'
import { bestBall2Strategy } from '@/lib/formats/bestBall'
import { scrambleStrategy } from '@/lib/formats/scramble'
import { matchPlayStrategy } from '@/lib/formats/match'
import { quotaStrategy } from '@/lib/formats/quota'
import { nassauStrategy } from '@/lib/formats/nassau'
import { lowGrossLowNetStrategy } from '@/lib/formats/combined'
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
    expect(standings[0].skinsWon).toBe(18)
    expect(standings[0].skinsValue).toBe(1)
    expect(standings[0].skinsHoles).toHaveLength(18)
    expect(standings[0].skinsTrailingCarryover).toBe(0)
  })

  it('records per-hole attribution including carryover claim', () => {
    // Alice and Bob tie hole 1 (both par); Alice wins holes 2-18 outright with
    // birdies. Hole 2 should pay 2 skins (1 + carry of 1).
    const aliceScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.number === 1 ? h.par : h.par - 1,
      handicap: h.handicap, roundNumber: 1,
    }))
    const bobScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.par,
      handicap: h.handicap, roundNumber: 1,
    }))
    const ctx = makeCtx({
      format: 'SKINS_GROSS',
      players: [
        { tournamentPlayerId: 'alice', userId: 'u-alice', name: 'Alice', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: aliceScores },
        { tournamentPlayerId: 'bob', userId: 'u-bob', name: 'Bob', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: bobScores },
      ],
    })
    const standings = skinsGrossStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.skinsWon).toBe(18)   // 17 birdies + 1 carryover claim on hole 2
    const hole2 = alice.skinsHoles?.find((h) => h.hole === 2)
    expect(hole2).toEqual({ round: 1, hole: 2, carryover: 2 })
  })

  it('reports trailingCarryover when the latest hole tied', () => {
    // Both players tie hole 1 — carry of 1 with no claim yet.
    const ctx = makeCtx({
      format: 'SKINS_GROSS',
      players: [
        { tournamentPlayerId: 'alice', userId: 'u-alice', name: 'Alice', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null,
          scores: [{ holeNumber: 1, par: 4, strokes: 4, handicap: 1, roundNumber: 1 }] },
        { tournamentPlayerId: 'bob', userId: 'u-bob', name: 'Bob', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null,
          scores: [{ holeNumber: 1, par: 4, strokes: 4, handicap: 1, roundNumber: 1 }] },
      ],
    })
    const standings = skinsGrossStrategy.computeStandings(ctx)
    expect(standings[0].skinsTrailingCarryover).toBe(1)
    expect(standings.every((s) => (s.skinsWon ?? 0) === 0)).toBe(true)
  })

  it('honours configured valuePerSkin', () => {
    const ctx = makeCtx({
      format: 'SKINS_GROSS',
      formatConfig: { valuePerSkin: 5 },
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par - 1),
        makePlayer('bob', 'Bob', 0, (h) => h.par),
      ],
    })
    const standings = skinsGrossStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.skinsWon).toBe(18)
    expect(alice.skinsValue).toBe(5)
    expect(alice.points).toBe(90)   // 18 × 5
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
  it('ranks by match-status holesUp (closing semantics)', () => {
    // Alice wins every hole. After hole 10 she's 10 up with 8 to play → match
    // closes at hole 10. holesUp/points reflect the closed state, not the
    // cumulative 18-vs-0.
    const ctx = makeCtx({
      format: 'MATCH_PLAY',
      players: [
        makePlayer('alice', 'Alice', 0, () => 3),
        makePlayer('bob', 'Bob', 0, () => 5),
      ],
    })
    const standings = matchPlayStrategy.computeStandings(ctx)
    expect(standings[0].playerName).toBe('Alice')
    expect(standings[0].points).toBe(10)    // closed at hole 10, 10 up
    expect(standings[1].points).toBe(-10)
  })

  it('emits W-L-H record and closed status for heads-up matches', () => {
    const ctx = makeCtx({
      format: 'MATCH_PLAY',
      players: [
        makePlayer('alice', 'Alice', 0, () => 3),
        makePlayer('bob', 'Bob', 0, () => 5),
      ],
    })
    const standings = matchPlayStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.kind).toBe('match')
    // record is cumulative across every entered hole (18 wins).
    expect(alice.matchRecord).toEqual({ won: 18, lost: 0, halved: 0 })
    // holesUp/through reflect the match-status snapshot at closing.
    expect(alice.holesUp).toBe(10)
    expect(alice.through).toBe(10)
    expect(alice.matchStatus).toBe('closed')
    expect(alice.opponentId).toBeDefined()
  })

  it('counts halved holes', () => {
    // Alice and Bob both score par on every hole → all halved.
    const ctx = makeCtx({
      format: 'MATCH_PLAY',
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par),
        makePlayer('bob', 'Bob', 0, (h) => h.par),
      ],
    })
    const standings = matchPlayStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.matchRecord).toEqual({ won: 0, lost: 0, halved: 18 })
    expect(alice.holesUp).toBe(0)
    expect(alice.matchStatus).toBe('final')
  })

  it('treats conceded holes as a loss for the conceding player', () => {
    // Alice scores par on every hole. Bob concedes hole 1, plays par on the rest.
    const aliceScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.par, handicap: h.handicap, roundNumber: 1,
    }))
    const bobScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.par, handicap: h.handicap, roundNumber: 1,
      conceded: h.number === 1,
    }))
    const players: ScoringPlayer[] = [
      { tournamentPlayerId: 'alice', userId: 'u-alice', name: 'Alice', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: aliceScores },
      { tournamentPlayerId: 'bob', userId: 'u-bob', name: 'Bob', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: bobScores },
    ]
    const ctx = makeCtx({ format: 'MATCH_PLAY', players })
    const standings = matchPlayStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    const bob = standings.find((s) => s.playerName === 'Bob')!
    // Alice gets 1 win (the conceded hole) + 17 halves; Bob gets 1 loss + 17 halves.
    expect(alice.matchRecord).toEqual({ won: 1, lost: 0, halved: 17 })
    expect(bob.matchRecord).toEqual({ won: 0, lost: 1, halved: 17 })
    expect(alice.holesUp).toBe(1)
    expect(bob.holesUp).toBe(-1)
  })
})

describe('nassauStrategy', () => {
  it('computes front, back, and overall independently for a heads-up match', () => {
    // Alice wins all 9 front holes, halves all 9 back holes (par each).
    // Front: Alice 9 up thru 9, closed.
    // Back: 0-0, AS thru 9 (final).
    // Overall: 9-0-9, Alice closes overall too (9 up after 9, |9|>9? remaining=9, |9|=9 → dormie).
    const aliceScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par,
      strokes: h.number <= 9 ? h.par - 1 : h.par,
      handicap: h.handicap, roundNumber: 1,
    }))
    const bobScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.par,
      handicap: h.handicap, roundNumber: 1,
    }))
    const players: ScoringPlayer[] = [
      { tournamentPlayerId: 'alice', userId: 'u-alice', name: 'Alice', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: aliceScores },
      { tournamentPlayerId: 'bob', userId: 'u-bob', name: 'Bob', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: bobScores },
    ]
    const ctx = makeCtx({ format: 'NASSAU', players })
    const standings = nassauStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.kind).toBe('nassau')
    // Front-9: Alice closed-out (matchPlayStatus closes when |up|>remaining).
    // Through 9 birdies, after hole 5 she's 5 up with 4 to play → closed.
    expect(alice.front?.holesUp).toBeGreaterThan(0)
    expect(alice.front?.thru).toBeGreaterThan(0)
    // Back-9: completed all 9 with halves → 0 up, thru 9.
    expect(alice.back).toEqual({ holesUp: 0, thru: 9 })
    // Overall: front-9 contribution + halved back-9 — strictly positive lead.
    expect(alice.overall?.holesUp).toBeGreaterThan(0)
  })

  it('closed front-9 does NOT end the back-9 match', () => {
    // Alice destroys Bob on the front (5&4-style closing), then halves the back.
    // Back should remain a separate live/AS match with thru count > 0.
    const aliceScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par,
      strokes: h.number <= 5 ? h.par - 1 : h.par,
      handicap: h.handicap, roundNumber: 1,
    }))
    const bobScores = PAR_72_HOLES.map((h) => ({
      holeNumber: h.number, par: h.par, strokes: h.par,
      handicap: h.handicap, roundNumber: 1,
    }))
    const players: ScoringPlayer[] = [
      { tournamentPlayerId: 'alice', userId: 'u-alice', name: 'Alice', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: aliceScores },
      { tournamentPlayerId: 'bob', userId: 'u-bob', name: 'Bob', avatarUrl: null, handicap: 0, scoreModifier: 0, teamId: null, scores: bobScores },
    ]
    const ctx = makeCtx({ format: 'NASSAU', players })
    const standings = nassauStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    // Front: closed at hole 5 (5 up with 4 to play). thru = 5.
    expect(alice.front?.thru).toBe(5)
    expect(alice.front?.holesUp).toBe(5)
    // Back: all 9 holes halved → 0 up, thru 9. Independent from front.
    expect(alice.back).toEqual({ holesUp: 0, thru: 9 })
  })

  it('ranks by overall first, then back, then front', () => {
    // 3 players: A leads overall 2 up, B leads back 1 up, C trails everything.
    // The order should be A, B, C.
    function strokesForOverallLead(h: { number: number; par: number }) {
      return h.par - (h.number === 1 || h.number === 18 ? 1 : 0)   // 2 wins overall
    }
    function strokesForBackLead(h: { number: number; par: number }) {
      return h.par - (h.number === 10 ? 1 : 0)   // 1 win on back, none on front
    }
    function strokesEven(h: { number: number; par: number }) { return h.par }

    const players: ScoringPlayer[] = [
      makePlayer('a', 'Alpha', 0, strokesForOverallLead),
      makePlayer('b', 'Beta', 0, strokesForBackLead),
      makePlayer('c', 'Gamma', 0, strokesEven),
    ]
    const ctx = makeCtx({ format: 'NASSAU', players })
    const standings = nassauStrategy.computeStandings(ctx)
    expect(standings.map((s) => s.playerName)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})

describe('lowGrossLowNetStrategy', () => {
  it('emits kind low-gross-net with grossRank and netRank populated', () => {
    // 3 players, all handicap 0 → gross == net for everyone.
    const ctx = makeCtx({
      format: 'LOW_GROSS_LOW_NET',
      players: [
        makePlayer('alice', 'Alice', 0, () => 3),       // 54
        makePlayer('bob', 'Bob', 0, (h) => h.par),      // 72
        makePlayer('carol', 'Carol', 0, (h) => h.par + 1), // 90
      ],
    })
    const standings = lowGrossLowNetStrategy.computeStandings(ctx)
    for (const s of standings) {
      expect(s.kind).toBe('low-gross-net')
      expect(typeof s.grossRank).toBe('number')
      expect(typeof s.netRank).toBe('number')
    }
    const alice = standings.find((s) => s.playerName === 'Alice')!
    expect(alice.grossRank).toBe(1)
    expect(alice.netRank).toBe(1)
  })

  it('crowns separate gross and net winners when handicaps differ', () => {
    // Alice has handicap 0 and shoots even par → gross 72.
    // Bob has handicap 18 and shoots +18 → gross 90, net 72.
    // Carol has handicap 9 and shoots +5 → gross 77, net 68.
    // Expected: Carol nets best (rank 1), Alice ties Bob on net (both 72).
    // Gross order: Alice (72) < Carol (77) < Bob (90).
    const ctx = makeCtx({
      format: 'LOW_GROSS_LOW_NET',
      handicapSystem: 'WHS',
      players: [
        makePlayer('alice', 'Alice', 0, (h) => h.par),
        makePlayer('bob', 'Bob', 18, (h) => h.par + 1),
        makePlayer('carol', 'Carol', 9, (h) => h.par + (h.number <= 5 ? 1 : 0)),
      ],
    })
    const standings = lowGrossLowNetStrategy.computeStandings(ctx)
    const alice = standings.find((s) => s.playerName === 'Alice')!
    const carol = standings.find((s) => s.playerName === 'Carol')!
    // Carol is the net leader (lowest netVsPar).
    expect(carol.netRank).toBe(1)
    // Alice is the gross leader (lowest grossVsPar).
    expect(alice.grossRank).toBe(1)
    // The two ranks are independent — gross winner and net winner are different.
    expect(carol.grossRank).not.toBe(1)
    expect(alice.netRank).not.toBe(1)
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
    expect(standings[0].quotaTarget).toBe(36)
    expect(standings[0].quotaEarned).toBe(36)
    expect(standings[0].quotaOverUnder).toBe(0)
  })
})

describe('PlayerStanding.kind discriminator (Phase 1)', () => {
  const baseCtxPlayers = [
    makePlayer('alice', 'Alice', 0, (h) => h.par),
    makePlayer('bob', 'Bob', 0, (h) => h.par + 1),
  ]
  const teamCtxPlayers = [
    makePlayer('a', 'A', 0, (h) => h.par),
    makePlayer('b', 'B', 0, (h) => h.par + 1),
  ]
  const team = { id: 'team1', name: 'Team Alpha', color: '#ff0000', memberIds: ['a', 'b'] }

  it('strokePlay → "stroke"', () => {
    const ctx = makeCtx({ format: 'STROKE_PLAY', players: baseCtxPlayers })
    expect(strokePlayStrategy.computeStandings(ctx)[0].kind).toBe('stroke')
  })

  it('stableford → "stableford" with stablefordPoints', () => {
    const ctx = makeCtx({ format: 'STABLEFORD', players: baseCtxPlayers })
    const s = stablefordStrategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('stableford')
    expect(s.stablefordPoints).toBe(s.points)
  })

  it('modifiedStableford → "stableford"', () => {
    const ctx = makeCtx({ format: 'MODIFIED_STABLEFORD', players: baseCtxPlayers })
    expect(modifiedStablefordStrategy.computeStandings(ctx)[0].kind).toBe('stableford')
  })

  it('skins → "skins" with skinsWon and skinsValue', () => {
    const ctx = makeCtx({ format: 'SKINS_GROSS', players: baseCtxPlayers })
    const s = skinsGrossStrategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('skins')
    expect(s.skinsWon).toBeDefined()
    expect(s.skinsValue).toBe(1)
  })

  it('quota → "quota" with target/earned/overUnder', () => {
    const ctx = makeCtx({ format: 'QUOTA', players: baseCtxPlayers })
    const s = quotaStrategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('quota')
    expect(s.quotaTarget).toBeDefined()
    expect(s.quotaEarned).toBeDefined()
    expect(s.quotaOverUnder).toBeDefined()
  })

  it('match → "match" with matchRecord, holesUp, through', () => {
    const ctx = makeCtx({ format: 'MATCH_PLAY', players: baseCtxPlayers })
    const s = matchPlayStrategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('match')
    expect(s.matchRecord).toBeDefined()
    expect(s.holesUp).toBe(s.points)
    expect(typeof s.through).toBe('number')
  })

  it('bestBall (with team) → "team-best-ball" with team fields', () => {
    const ctx = makeCtx({ format: 'BEST_BALL_2', players: teamCtxPlayers, teams: [team] })
    const s = bestBall2Strategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('team-best-ball')
    expect(s.teamId).toBe('team1')
    expect(s.teamName).toBe('Team Alpha')
    expect(s.teamColor).toBe('#ff0000')
    expect(s.memberIds).toEqual(['a', 'b'])
  })

  it('bestBall propagates captainId from ScoringTeam onto the team row', () => {
    const teamWithCaptain = { ...team, captainId: 'a' }
    const ctx = makeCtx({ format: 'BEST_BALL_2', players: teamCtxPlayers, teams: [teamWithCaptain] })
    const s = bestBall2Strategy.computeStandings(ctx)[0]
    expect(s.captainId).toBe('a')
    expect(s.teamMembers).toEqual([
      { tournamentPlayerId: 'a', name: 'A', avatarUrl: null },
      { tournamentPlayerId: 'b', name: 'B', avatarUrl: null },
    ])
  })

  it('bestBall populates roundTotals per round', () => {
    const ctx = makeCtx({ format: 'BEST_BALL_2', players: teamCtxPlayers, teams: [team] })
    const s = bestBall2Strategy.computeStandings(ctx)[0]
    expect(s.roundTotals[1]).toBeGreaterThan(0)
  })

  it('bestBall (no teams configured) → falls back to "stroke"', () => {
    const ctx = makeCtx({ format: 'BEST_BALL_2', players: teamCtxPlayers, teams: [] })
    const s = bestBall2Strategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('stroke')
  })

  it('scramble → "team-stroke" with team fields', () => {
    const ctx = makeCtx({ format: 'SCRAMBLE', players: teamCtxPlayers, teams: [team] })
    const s = scrambleStrategy.computeStandings(ctx)[0]
    expect(s.kind).toBe('team-stroke')
    expect(s.teamId).toBe('team1')
    expect(s.teamColor).toBe('#ff0000')
    expect(s.memberIds).toEqual(['a', 'b'])
  })

  it('scramble propagates captainId and teamMembers', () => {
    const teamWithCaptain = { ...team, captainId: 'b' }
    const ctx = makeCtx({ format: 'SCRAMBLE', players: teamCtxPlayers, teams: [teamWithCaptain] })
    const s = scrambleStrategy.computeStandings(ctx)[0]
    expect(s.captainId).toBe('b')
    expect(s.teamMembers).toEqual([
      { tournamentPlayerId: 'a', name: 'A', avatarUrl: null },
      { tournamentPlayerId: 'b', name: 'B', avatarUrl: null },
    ])
  })
})

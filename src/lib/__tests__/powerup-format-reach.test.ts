/**
 * Powerups must reach EVERY format, not just stroke play.
 *
 * This is the regression guard for a real defect: the player's powerup total
 * used to live on `ScoringPlayer.scoreModifier`, which was read in exactly one
 * line of the whole codebase (strokePlay.ts). Stableford, Skins, Match Play,
 * Nassau and Quota never looked at it, so every powerup ever played was
 * silently a no-op in those formats — and Stableford is the format a casual
 * group actually picks.
 *
 * The fix routes modifiers through the stroke adjustment map, so they arrive
 * inside `ScoringScore.strokes` and every strategy sees them for free. These
 * tests assert the OUTCOME in each format, which is the only thing that would
 * have caught the original bug: a test that asserted the modifier was stored
 * passed fine the whole time it was being ignored.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { stablefordStrategy } from '@/lib/formats/stableford'
import { skinsGrossStrategy } from '@/lib/formats/skins'
import { matchPlayStrategy } from '@/lib/formats/match'
import { strokePlayStrategy } from '@/lib/formats/strokePlay'
import type { ScoringContext, ScoringPlayer, ScoringScore } from '@/lib/formats/types'

let powerupRows: unknown[] = []

const prismaMock = {
  playerPowerup: { findMany: vi.fn(async () => powerupRows) },
  tournamentRound: {
    findMany: vi.fn(async () => [{ id: 'round_1', course: { _count: { holes: 18 } } }]),
  },
  score: { groupBy: vi.fn(async () => []) },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { buildStrokeAdjustmentMap, effectiveStrokes } = await import('@/lib/powerup-stroke-overrides')

const HOLES = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: 4,
  handicap: i + 1,
}))

/** A used BOOST on the activator's own card. */
const boost = (tp: string, holeNumber: number, scoreModifier: number) => ({
  tournamentPlayerId: tp,
  targetPlayerId: null,
  roundId: 'round_1',
  holeNumber,
  targetHoleNumber: null,
  scoreModifier,
  metadata: null,
  powerup: { slug: 'stinger', type: 'BOOST' },
})

/** A used ATTACK: activator is `tp`, the penalty lands on `target`'s card. */
const attack = (tp: string, target: string, targetHoleNumber: number, scoreModifier: number) => ({
  tournamentPlayerId: tp,
  targetPlayerId: target,
  roundId: 'round_1',
  holeNumber: 1,
  targetHoleNumber,
  scoreModifier,
  metadata: null,
  powerup: { slug: 'three-putt-fee', type: 'ATTACK' },
})

interface RawScore {
  tournamentPlayerId: string
  holeNumber: number
  par: number
  strokes: number
  gir?: boolean | null
  conceded?: boolean
}

/** Flat par-4 round of `holes` holes for one player. */
function flatRound(tp: string, strokes: number, holes = 18): RawScore[] {
  return Array.from({ length: holes }, (_, i) => ({
    tournamentPlayerId: tp,
    holeNumber: i + 1,
    par: 4,
    strokes,
    gir: false,
  }))
}

/**
 * Run the raw scores through the adjustment map exactly as scoring.ts does,
 * then hand the result to a format strategy.
 */
async function buildCtx(
  raw: RawScore[],
  meta: { format: ScoringContext['format']; playerNames: Record<string, string> },
): Promise<ScoringContext> {
  const map = await buildStrokeAdjustmentMap(
    'tourn_1',
    raw.map((s) => ({ ...s, roundId: 'round_1', gir: s.gir ?? false })),
    'round_1',
  )

  const byPlayer = new Map<string, ScoringScore[]>()
  for (const s of raw) {
    const list = byPlayer.get(s.tournamentPlayerId) ?? []
    list.push({
      holeNumber: s.holeNumber,
      par: s.par,
      strokes: effectiveStrokes(map, s.tournamentPlayerId, s.holeNumber, s.strokes, 'round_1', s.conceded),
      handicap: s.holeNumber,
      roundNumber: 1,
      conceded: s.conceded,
    })
    byPlayer.set(s.tournamentPlayerId, list)
  }

  const players: ScoringPlayer[] = [...byPlayer.entries()].map(([tp, scores]) => ({
    tournamentPlayerId: tp,
    userId: `u-${tp}`,
    name: meta.playerNames[tp] ?? tp,
    avatarUrl: null,
    handicap: 0,
    teamId: null,
    scores,
  }))

  return {
    tournamentId: 'tourn_1',
    format: meta.format,
    formatConfig: null,
    handicapSystem: 'NONE',
    holes: HOLES,
    rounds: [{ roundNumber: 1, par: 72, holeCount: 18 }],
    players,
    teams: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  powerupRows = []
})

describe('a boost reaches the leaderboard in every format', () => {
  const names = { alice: 'Alice', bob: 'Bob' }

  it('STABLEFORD: a -1 boost turns a bogey into a par, earning a point', async () => {
    // Both players bogey every hole: 18 x 5 on a par-4 course = 18 points
    // (1 point per bogey on the default table).
    const raw = [...flatRound('alice', 5), ...flatRound('bob', 5)]

    const before = await buildCtx(raw, { format: 'STABLEFORD', playerNames: names })
    const baseline = stablefordStrategy.computeStandings(before)
    expect(baseline.find((s) => s.playerName === 'Alice')!.points).toBe(18)

    // Alice plays a -1 boost on hole 7: that hole becomes a par → 2 points
    // instead of 1. This is the assertion that was impossible before the fix.
    powerupRows = [boost('alice', 7, -1)]
    const after = await buildCtx(raw, { format: 'STABLEFORD', playerNames: names })
    const standings = stablefordStrategy.computeStandings(after)

    expect(standings.find((s) => s.playerName === 'Alice')!.points).toBe(19)
    expect(standings.find((s) => s.playerName === 'Bob')!.points).toBe(18)
    expect(standings[0].playerName).toBe('Alice')   // and it changes the ranking
  })

  it('SKINS: a -1 boost wins a hole that would otherwise have tied', async () => {
    const raw = [...flatRound('alice', 4), ...flatRound('bob', 4)]

    const before = await buildCtx(raw, { format: 'SKINS_GROSS', playerNames: names })
    const baseline = skinsGrossStrategy.computeStandings(before)
    expect(baseline.find((s) => s.playerName === 'Alice')!.skinsWon).toBe(0)

    // Every hole is tied, so carryover accumulates and nobody claims a skin.
    // A -1 on hole 18 claims the lot.
    powerupRows = [boost('alice', 18, -1)]
    const after = await buildCtx(raw, { format: 'SKINS_GROSS', playerNames: names })
    const standings = skinsGrossStrategy.computeStandings(after)

    expect(standings.find((s) => s.playerName === 'Alice')!.skinsWon).toBeGreaterThan(0)
    expect(standings.find((s) => s.playerName === 'Bob')!.skinsWon).toBe(0)
  })

  it('MATCH PLAY: an attack loses the victim a hole they had halved', async () => {
    const raw = [...flatRound('alice', 4), ...flatRound('bob', 4)]

    const before = await buildCtx(raw, { format: 'MATCH_PLAY', playerNames: names })
    const baseline = matchPlayStrategy.computeStandings(before)
    expect(baseline.find((s) => s.playerName === 'Alice')!.holesUp).toBe(0)

    // Alice attacks Bob for +1 on hole 12 — Bob's 4 becomes a 5 and Alice
    // takes a hole that was halved.
    powerupRows = [attack('alice', 'bob', 12, 1)]
    const after = await buildCtx(raw, { format: 'MATCH_PLAY', playerNames: names })
    const standings = matchPlayStrategy.computeStandings(after)

    expect(standings.find((s) => s.playerName === 'Alice')!.holesUp).toBe(1)
    expect(standings.find((s) => s.playerName === 'Bob')!.holesUp).toBe(-1)
  })

  it('STROKE PLAY: gross and grossVsPar both move, and agree with each other', async () => {
    const raw = flatRound('alice', 4)
    powerupRows = [boost('alice', 3, -2)]

    const ctx = await buildCtx(raw, { format: 'STROKE_PLAY', playerNames: names })
    const alice = strokePlayStrategy.computeStandings(ctx)[0]

    // 72 - 2 = 70. Previously grossTotal reported 72 while grossVsPar reported
    // -2, because only the latter applied the modifier.
    expect(alice.grossTotal).toBe(70)
    expect(alice.grossVsPar).toBe(-2)
  })
})

describe('attribution rules', () => {
  it('a boost lands on the activator, an attack on its victim', async () => {
    const raw = [...flatRound('alice', 4, 3), ...flatRound('bob', 4, 3)]
    powerupRows = [boost('alice', 1, -1), attack('alice', 'bob', 2, 2)]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(3)   // boost on own card
    expect(effectiveStrokes(map, 'bob', 2, 4, 'round_1')).toBe(6)     // attack on victim's card
    expect(effectiveStrokes(map, 'alice', 2, 4, 'round_1')).toBe(4)   // attacker untouched
    expect(effectiveStrokes(map, 'bob', 1, 4, 'round_1')).toBe(4)     // victim's other holes untouched
  })

  it('stacks multiple modifiers on the same hole', async () => {
    const raw = flatRound('alice', 6, 2)
    powerupRows = [boost('alice', 1, -1), boost('alice', 1, -2)]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 1, 6, 'round_1')).toBe(3)
  })

  it('applies an absolute override first, then the delta on top', async () => {
    const raw = [{ tournamentPlayerId: 'alice', holeNumber: 1, par: 4, strokes: 9, gir: true }]
    powerupRows = [
      // Concede! on a GIR hole → strokes become par - 1 = 3 ...
      { ...boost('alice', 1, 0), powerup: { slug: 'concede', type: 'BOOST' }, scoreModifier: null },
      // ... and a separate -1 boost takes it to 2.
      boost('alice', 1, -1),
    ]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1' })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 1, 9, 'round_1')).toBe(2)
  })

  it('clamps an adjusted score into the legal 1-20 range', async () => {
    const raw = flatRound('alice', 2, 1)
    powerupRows = [boost('alice', 1, -9)]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    // 2 - 9 = -7, which is not a hole score. Floor at 1.
    expect(effectiveStrokes(map, 'alice', 1, 2, 'round_1')).toBe(1)
  })

  it('leaves a conceded hole alone', async () => {
    const raw = [{ tournamentPlayerId: 'alice', holeNumber: 1, par: 4, strokes: 0, gir: false, conceded: true }]
    powerupRows = [boost('alice', 1, -1)]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1' })),
      'round_1',
    )

    // You cannot boost a hole you gave away, and the clamp must not turn the
    // match-play sentinel 0 into a 1.
    expect(effectiveStrokes(map, 'alice', 1, 0, 'round_1', true)).toBe(0)
  })

  it('ignores a row whose modifier column is absent or non-numeric', async () => {
    const raw = flatRound('alice', 4, 1)
    powerupRows = [
      { ...boost('alice', 1, 0), scoreModifier: undefined },
      { ...boost('alice', 1, 0), scoreModifier: null },
      { ...boost('alice', 1, 0), scoreModifier: Number.NaN },
    ]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(4)
  })

  it('mirrors a parasitic attack onto the attacker with the sign flipped', async () => {
    // The Vampire: what the victim loses, the attacker gains.
    const raw = [...flatRound('alice', 4, 3), ...flatRound('bob', 4, 3)]
    powerupRows = [
      {
        ...attack('alice', 'bob', 2, 3),
        holeNumber: 1,
        powerup: {
          slug: 'the-vampire',
          type: 'ATTACK',
          effect: { scoring: { mirror: true } },
        },
      },
    ]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'bob', 2, 4, 'round_1')).toBe(7)    // victim +3
    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(1)  // attacker -3
  })

  it('does not mirror an attack that has not declared it', async () => {
    const raw = [...flatRound('alice', 4, 3), ...flatRound('bob', 4, 3)]
    powerupRows = [{ ...attack('alice', 'bob', 2, 3), holeNumber: 1 }]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'bob', 2, 4, 'round_1')).toBe(7)
    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(4)
  })

  it('treats a malformed effect as not mirrored rather than throwing', async () => {
    const raw = [...flatRound('alice', 4, 3), ...flatRound('bob', 4, 3)]
    for (const bad of [null, 'nonsense', 42, { scoring: null }, { scoring: { mirror: 'yes' } }]) {
      powerupRows = [
        {
          ...attack('alice', 'bob', 2, 1),
          holeNumber: 1,
          powerup: { slug: 'x', type: 'ATTACK', effect: bad },
        },
      ]
      const map = await buildStrokeAdjustmentMap(
        'tourn_1',
        raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
        'round_1',
      )
      expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(4)
    }
  })

  it('a deflected attack moves the ATTACKER\'s strokes, not the victim\'s', async () => {
    // A Deflector rewrites targetPlayerId to the attacker before the attack is
    // claimed, so by the time the adjustment map sees it the row already says
    // "lands on Alice". Nothing special is needed here — which is the point.
    const raw = [...flatRound('alice', 4, 3), ...flatRound('bob', 4, 3)]
    powerupRows = [
      {
        ...attack('alice', 'alice', 2, 3), // deflected: attacker is now the target
        holeNumber: 1,
      },
    ]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 2, 4, 'round_1')).toBe(7)  // attacker takes it
    expect(effectiveStrokes(map, 'bob', 2, 4, 'round_1')).toBe(4)    // victim untouched
  })

  it('a mirrored card bounced back onto its own caster does not cancel itself out', async () => {
    // The Vampire mirrors: victim +N, attacker -N. Deflected, the victim IS
    // the attacker — so applying both halves to one player would net zero and
    // the card would silently do nothing.
    const raw = flatRound('alice', 4, 3)
    powerupRows = [
      {
        ...attack('alice', 'alice', 2, 3),
        holeNumber: 1,
        powerup: {
          slug: 'the-vampire',
          type: 'ATTACK',
          effect: { scoring: { mirror: true } },
        },
      },
    ]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    // The penalty lands and the mirror is suppressed.
    expect(effectiveStrokes(map, 'alice', 2, 4, 'round_1')).toBe(7)
    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(4)
  })

  it('falls back to the last scored hole when a modifier has no hole on it', async () => {
    // Legacy rows predate holeNumber being required at activation. Dropping
    // them would silently change historic leaderboards.
    const raw = flatRound('alice', 4, 5)
    powerupRows = [{ ...boost('alice', 1, -3), holeNumber: null }]

    const map = await buildStrokeAdjustmentMap(
      'tourn_1',
      raw.map((s) => ({ ...s, roundId: 'round_1', gir: false })),
      'round_1',
    )

    expect(effectiveStrokes(map, 'alice', 5, 4, 'round_1')).toBe(1)
    expect(effectiveStrokes(map, 'alice', 1, 4, 'round_1')).toBe(4)
  })
})

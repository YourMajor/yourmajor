import { describe, it, expect, vi } from 'vitest'

// draft-round-progress imports the prisma client at module load; the pure
// helper under test never touches it.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  canOpenNextRoundDraft,
  canPickPowerup,
  computeCurrentTurn,
  picksForRound,
} from '@/lib/draft-utils'
import { countFinishedPlayers } from '@/lib/draft-round-progress'

// ─── picksForRound ──────────────────────────────────────────────────────────

describe('picksForRound', () => {
  const picks = [
    { id: 'a', tournamentRound: 1, powerupId: 'mulligan', tournamentPlayerId: 'p1' },
    { id: 'b', tournamentRound: 1, powerupId: 'sabotage', tournamentPlayerId: 'p2' },
    { id: 'c', tournamentRound: 2, powerupId: 'mulligan', tournamentPlayerId: 'p2' },
  ]

  it('keeps only the requested round', () => {
    expect(picksForRound(picks, 1).map((p) => p.id)).toEqual(['a', 'b'])
    expect(picksForRound(picks, 2).map((p) => p.id)).toEqual(['c'])
    expect(picksForRound(picks, 3)).toEqual([])
  })

  it('lets a card drafted in round 1 be drafted again in round 2', () => {
    const history = (round: number) =>
      picksForRound(picks, round).map((p) => ({
        tournamentPlayerId: p.tournamentPlayerId,
        powerupId: p.powerupId,
        powerupType: 'BOOST' as const,
      }))

    // Round 1: sabotage is gone.
    expect(canPickPowerup(history(1), 'p1', 'sabotage', 'BOOST', 1).allowed).toBe(false)
    // Round 2: sabotage is back in the pool, mulligan was just taken again.
    expect(canPickPowerup(history(2), 'p1', 'sabotage', 'BOOST', 1).allowed).toBe(true)
    expect(canPickPowerup(history(2), 'p1', 'mulligan', 'BOOST', 1).allowed).toBe(false)
  })

  it('resets the attack budget each round', () => {
    const attacks = [
      { tournamentRound: 1, tournamentPlayerId: 'p1', powerupId: 'x', powerupType: 'ATTACK' as const },
    ]
    expect(canPickPowerup(picksForRound(attacks, 1), 'p1', 'y', 'ATTACK', 1).allowed).toBe(false)
    expect(canPickPowerup(picksForRound(attacks, 2), 'p1', 'y', 'ATTACK', 1).allowed).toBe(true)
  })

  it('restarts turn order at pick 1 for a new round', () => {
    const order = ['p1', 'p2']
    // Round 1 finished (4 picks). Opening round 2 sets currentPick back to 0,
    // and round 2's picks are counted on their own.
    expect(computeCurrentTurn(order, 'SNAKE', 4, 2)).toBeNull()
    expect(computeCurrentTurn(order, 'SNAKE', picksForRound(picks, 3).length, 2)).toEqual({
      tournamentPlayerId: 'p1',
      roundNumber: 1,
      pickNumber: 1,
    })
  })
})

// ─── canOpenNextRoundDraft ──────────────────────────────────────────────────

describe('canOpenNextRoundDraft', () => {
  it('allows the next round once the current draft is complete', () => {
    expect(canOpenNextRoundDraft({ status: 'COMPLETED', currentRound: 1 }, [1, 2])).toEqual({
      allowed: true,
      nextRound: 2,
    })
  })

  it('refuses while the current draft is still running or not started', () => {
    for (const status of ['PENDING', 'ACTIVE'] as const) {
      const r = canOpenNextRoundDraft({ status, currentRound: 1 }, [1, 2])
      expect(r.allowed).toBe(false)
      expect(r.reason).toMatch(/Round 1 draft/)
    }
  })

  it('refuses after the last round', () => {
    const r = canOpenNextRoundDraft({ status: 'COMPLETED', currentRound: 2 }, [1, 2])
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/no Round 3/)
  })

  it('refuses for a single-round tournament', () => {
    expect(canOpenNextRoundDraft({ status: 'COMPLETED', currentRound: 1 }, [1]).allowed).toBe(false)
  })
})

// ─── countFinishedPlayers ───────────────────────────────────────────────────

describe('countFinishedPlayers', () => {
  const holes = (n: number) => new Set(Array.from({ length: n }, (_, i) => i))

  it('counts players with a full card', () => {
    const { finishedIds } = countFinishedPlayers({
      participantIds: ['p1', 'p2', 'p3'],
      holeCount: 18,
      scoredHolesByPlayer: new Map([['p1', holes(18)], ['p2', holes(14)]]),
      teamScored: false,
    })
    expect([...finishedIds]).toEqual(['p1'])
  })

  it('uses the course hole count, so 9-hole rounds finish at 9', () => {
    const { finishedIds } = countFinishedPlayers({
      participantIds: ['p1'],
      holeCount: 9,
      scoredHolesByPlayer: new Map([['p1', holes(9)]]),
      teamScored: false,
    })
    expect(finishedIds.has('p1')).toBe(true)
  })

  it('credits every teammate when the team anchor has the full card', () => {
    const { finishedIds } = countFinishedPlayers({
      participantIds: ['a1', 'a2', 'b1', 'b2'],
      holeCount: 18,
      scoredHolesByPlayer: new Map([['a1', holes(18)], ['b1', holes(10)]]),
      teamOf: new Map([['a1', 'A'], ['a2', 'A'], ['b1', 'B'], ['b2', 'B']]),
      teamScored: true,
    })
    expect([...finishedIds].sort()).toEqual(['a1', 'a2'])
  })

  it('does not share completion between teammates in individual formats', () => {
    const { finishedIds } = countFinishedPlayers({
      participantIds: ['a1', 'a2'],
      holeCount: 18,
      scoredHolesByPlayer: new Map([['a1', holes(18)]]),
      teamOf: new Map([['a1', 'A'], ['a2', 'A']]),
      teamScored: false,
    })
    expect([...finishedIds]).toEqual(['a1'])
  })
})

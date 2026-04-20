import { describe, it, expect } from 'vitest'
import {
  computeCurrentTurn,
  countPlayerAttacks,
  canPickPowerup,
} from '@/lib/draft-utils'

// ─── computeCurrentTurn ─────────────────────────────────────────────────────

describe('computeCurrentTurn', () => {
  const players = ['alice', 'bob', 'charlie', 'dave']

  describe('LINEAR format', () => {
    it('returns first player when no picks made', () => {
      const turn = computeCurrentTurn(players, 'LINEAR', 0, 2)
      expect(turn).toEqual({
        tournamentPlayerId: 'alice',
        roundNumber: 1,
        pickNumber: 1,
      })
    })

    it('cycles through players in order', () => {
      expect(computeCurrentTurn(players, 'LINEAR', 0, 2)?.tournamentPlayerId).toBe('alice')
      expect(computeCurrentTurn(players, 'LINEAR', 1, 2)?.tournamentPlayerId).toBe('bob')
      expect(computeCurrentTurn(players, 'LINEAR', 2, 2)?.tournamentPlayerId).toBe('charlie')
      expect(computeCurrentTurn(players, 'LINEAR', 3, 2)?.tournamentPlayerId).toBe('dave')
    })

    it('repeats same order in round 2', () => {
      expect(computeCurrentTurn(players, 'LINEAR', 4, 2)?.tournamentPlayerId).toBe('alice')
      expect(computeCurrentTurn(players, 'LINEAR', 5, 2)?.tournamentPlayerId).toBe('bob')
    })

    it('returns null when draft is complete', () => {
      // 4 players * 2 picks each = 8 total
      expect(computeCurrentTurn(players, 'LINEAR', 8, 2)).toBeNull()
      expect(computeCurrentTurn(players, 'LINEAR', 10, 2)).toBeNull()
    })

    it('tracks round number correctly', () => {
      expect(computeCurrentTurn(players, 'LINEAR', 0, 3)?.roundNumber).toBe(1)
      expect(computeCurrentTurn(players, 'LINEAR', 4, 3)?.roundNumber).toBe(2)
      expect(computeCurrentTurn(players, 'LINEAR', 8, 3)?.roundNumber).toBe(3)
    })

    it('tracks pick number correctly', () => {
      expect(computeCurrentTurn(players, 'LINEAR', 0, 2)?.pickNumber).toBe(1)
      expect(computeCurrentTurn(players, 'LINEAR', 5, 2)?.pickNumber).toBe(6)
    })
  })

  describe('SNAKE format', () => {
    it('goes forward in round 1 (even round index 0)', () => {
      expect(computeCurrentTurn(players, 'SNAKE', 0, 3)?.tournamentPlayerId).toBe('alice')
      expect(computeCurrentTurn(players, 'SNAKE', 1, 3)?.tournamentPlayerId).toBe('bob')
      expect(computeCurrentTurn(players, 'SNAKE', 2, 3)?.tournamentPlayerId).toBe('charlie')
      expect(computeCurrentTurn(players, 'SNAKE', 3, 3)?.tournamentPlayerId).toBe('dave')
    })

    it('reverses in round 2 (odd round index 1)', () => {
      expect(computeCurrentTurn(players, 'SNAKE', 4, 3)?.tournamentPlayerId).toBe('dave')
      expect(computeCurrentTurn(players, 'SNAKE', 5, 3)?.tournamentPlayerId).toBe('charlie')
      expect(computeCurrentTurn(players, 'SNAKE', 6, 3)?.tournamentPlayerId).toBe('bob')
      expect(computeCurrentTurn(players, 'SNAKE', 7, 3)?.tournamentPlayerId).toBe('alice')
    })

    it('goes forward again in round 3', () => {
      expect(computeCurrentTurn(players, 'SNAKE', 8, 3)?.tournamentPlayerId).toBe('alice')
      expect(computeCurrentTurn(players, 'SNAKE', 9, 3)?.tournamentPlayerId).toBe('bob')
    })

    it('returns null when complete', () => {
      expect(computeCurrentTurn(players, 'SNAKE', 12, 3)).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('returns null for empty draftOrder', () => {
      expect(computeCurrentTurn([], 'LINEAR', 0, 2)).toBeNull()
      expect(computeCurrentTurn([], 'SNAKE', 0, 2)).toBeNull()
    })

    it('handles single player', () => {
      const turn = computeCurrentTurn(['solo'], 'LINEAR', 0, 3)
      expect(turn?.tournamentPlayerId).toBe('solo')
      expect(turn?.roundNumber).toBe(1)
      // Pick 1 → round 2
      expect(computeCurrentTurn(['solo'], 'LINEAR', 1, 3)?.roundNumber).toBe(2)
      // Complete after 3 picks
      expect(computeCurrentTurn(['solo'], 'LINEAR', 3, 3)).toBeNull()
    })

    it('handles single player snake (same as linear)', () => {
      expect(computeCurrentTurn(['solo'], 'SNAKE', 0, 2)?.tournamentPlayerId).toBe('solo')
      expect(computeCurrentTurn(['solo'], 'SNAKE', 1, 2)?.tournamentPlayerId).toBe('solo')
    })

    it('returns null when picksPerPlayer is 0', () => {
      expect(computeCurrentTurn(players, 'LINEAR', 0, 0)).toBeNull()
    })

    it('handles 3 players in snake (odd count)', () => {
      const three = ['a', 'b', 'c']
      // Round 1: a, b, c
      expect(computeCurrentTurn(three, 'SNAKE', 0, 2)?.tournamentPlayerId).toBe('a')
      expect(computeCurrentTurn(three, 'SNAKE', 1, 2)?.tournamentPlayerId).toBe('b')
      expect(computeCurrentTurn(three, 'SNAKE', 2, 2)?.tournamentPlayerId).toBe('c')
      // Round 2 reversed: c, b, a
      expect(computeCurrentTurn(three, 'SNAKE', 3, 2)?.tournamentPlayerId).toBe('c')
      expect(computeCurrentTurn(three, 'SNAKE', 4, 2)?.tournamentPlayerId).toBe('b')
      expect(computeCurrentTurn(three, 'SNAKE', 5, 2)?.tournamentPlayerId).toBe('a')
    })
  })
})

// ─── countPlayerAttacks ─────────────��───────────────────────────────────────

describe('countPlayerAttacks', () => {
  it('returns 0 for empty picks', () => {
    expect(countPlayerAttacks([], 'alice')).toBe(0)
  })

  it('counts only ATTACK type for specific player', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const },
      { tournamentPlayerId: 'alice', powerupType: 'BOOST' as const },
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const },
      { tournamentPlayerId: 'bob', powerupType: 'ATTACK' as const },
    ]
    expect(countPlayerAttacks(picks, 'alice')).toBe(2)
    expect(countPlayerAttacks(picks, 'bob')).toBe(1)
  })

  it('returns 0 for player with no picks', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const },
    ]
    expect(countPlayerAttacks(picks, 'bob')).toBe(0)
  })

  it('returns 0 when player has only BOOST picks', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'BOOST' as const },
      { tournamentPlayerId: 'alice', powerupType: 'BOOST' as const },
    ]
    expect(countPlayerAttacks(picks, 'alice')).toBe(0)
  })
})

// ─��─ canPickPowerup ─────��─────────────��─────────────────────────────────────

describe('canPickPowerup', () => {
  it('allows picking an available BOOST powerup', () => {
    const result = canPickPowerup([], 'alice', 'power-1', 'BOOST', 2)
    expect(result).toEqual({ allowed: true })
  })

  it('blocks picking an already-picked powerup', () => {
    const picks = [
      { tournamentPlayerId: 'bob', powerupType: 'BOOST' as const, powerupId: 'power-1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'power-1', 'BOOST', 2)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('already been picked')
  })

  it('blocks ATTACK when at max attacks', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a1' },
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a2' },
    ]
    const result = canPickPowerup(picks, 'alice', 'a3', 'ATTACK', 2)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('2 attack cards')
  })

  it('allows ATTACK when under max attacks', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'a2', 'ATTACK', 2)
    expect(result).toEqual({ allowed: true })
  })

  it('allows BOOST even when at max attacks', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a1' },
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a2' },
    ]
    const result = canPickPowerup(picks, 'alice', 'b1', 'BOOST', 2)
    expect(result).toEqual({ allowed: true })
  })

  it('uses singular "card" when maxAttacks is 1', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'a1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'a2', 'ATTACK', 1)
    expect(result.reason).toContain('1 attack card (max)')
  })

  it('handles maxAttacksPerPlayer = 0 (no attacks allowed)', () => {
    const result = canPickPowerup([], 'alice', 'a1', 'ATTACK', 0)
    expect(result.allowed).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { computeCurrentTurn, countPlayerAttacks, canPickPowerup } from './draft-utils'

// ─── computeCurrentTurn ──────────────────────────────────────────────────

describe('computeCurrentTurn', () => {
  const players = ['alice', 'bob', 'charlie']

  it('returns null for empty player list', () => {
    expect(computeCurrentTurn([], 'SNAKE', 0, 3)).toBeNull()
  })

  it('returns null when draft is complete', () => {
    // 3 players * 2 picks each = 6 total needed
    expect(computeCurrentTurn(players, 'SNAKE', 6, 2)).toBeNull()
  })

  it('LINEAR format: same order every round', () => {
    // Round 1: alice(0), bob(1), charlie(2)
    expect(computeCurrentTurn(players, 'LINEAR', 0, 3)?.tournamentPlayerId).toBe('alice')
    expect(computeCurrentTurn(players, 'LINEAR', 1, 3)?.tournamentPlayerId).toBe('bob')
    expect(computeCurrentTurn(players, 'LINEAR', 2, 3)?.tournamentPlayerId).toBe('charlie')
    // Round 2: alice, bob, charlie again
    expect(computeCurrentTurn(players, 'LINEAR', 3, 3)?.tournamentPlayerId).toBe('alice')
    expect(computeCurrentTurn(players, 'LINEAR', 4, 3)?.tournamentPlayerId).toBe('bob')
  })

  it('SNAKE format: reverses order every other round', () => {
    // Round 1 (forward): alice, bob, charlie
    expect(computeCurrentTurn(players, 'SNAKE', 0, 3)?.tournamentPlayerId).toBe('alice')
    expect(computeCurrentTurn(players, 'SNAKE', 1, 3)?.tournamentPlayerId).toBe('bob')
    expect(computeCurrentTurn(players, 'SNAKE', 2, 3)?.tournamentPlayerId).toBe('charlie')
    // Round 2 (reversed): charlie, bob, alice
    expect(computeCurrentTurn(players, 'SNAKE', 3, 3)?.tournamentPlayerId).toBe('charlie')
    expect(computeCurrentTurn(players, 'SNAKE', 4, 3)?.tournamentPlayerId).toBe('bob')
    expect(computeCurrentTurn(players, 'SNAKE', 5, 3)?.tournamentPlayerId).toBe('alice')
    // Round 3 (forward again): alice, bob, charlie
    expect(computeCurrentTurn(players, 'SNAKE', 6, 3)?.tournamentPlayerId).toBe('alice')
  })

  it('returns correct roundNumber and pickNumber', () => {
    const turn = computeCurrentTurn(players, 'SNAKE', 4, 3)!
    expect(turn.roundNumber).toBe(2)
    expect(turn.pickNumber).toBe(5)
  })
})

// ─── countPlayerAttacks ──────────────────────────────────────────────────

describe('countPlayerAttacks', () => {
  it('counts only ATTACK picks for the specified player', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const },
      { tournamentPlayerId: 'alice', powerupType: 'BOOST' as const },
      { tournamentPlayerId: 'bob', powerupType: 'ATTACK' as const },
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const },
    ]
    expect(countPlayerAttacks(picks, 'alice')).toBe(2)
    expect(countPlayerAttacks(picks, 'bob')).toBe(1)
    expect(countPlayerAttacks(picks, 'charlie')).toBe(0)
  })
})

// ─── canPickPowerup ──────────────────────────────────────────────────────

describe('canPickPowerup', () => {
  it('allows picking an unpicked boost', () => {
    const result = canPickPowerup([], 'alice', 'pw1', 'BOOST', 1)
    expect(result.allowed).toBe(true)
  })

  it('blocks picking an already-picked powerup', () => {
    const picks = [
      { tournamentPlayerId: 'bob', powerupType: 'BOOST' as const, powerupId: 'pw1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'pw1', 'BOOST', 1)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('already been picked')
  })

  it('blocks picking attack when at max attack limit', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'ATTACK' as const, powerupId: 'pw1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'pw2', 'ATTACK', 1)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('attack card')
  })

  it('allows picking attack when under limit', () => {
    const picks = [
      { tournamentPlayerId: 'alice', powerupType: 'BOOST' as const, powerupId: 'pw1' },
    ]
    const result = canPickPowerup(picks, 'alice', 'pw2', 'ATTACK', 2)
    expect(result.allowed).toBe(true)
  })
})

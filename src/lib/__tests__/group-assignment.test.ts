import { describe, it, expect } from 'vitest'
import {
  shuffleFisherYates,
  seededRng,
  assignRandom,
  snakeDraftByHandicap,
  flightByHandicap,
  assignWithPartnerAvoidance,
  autoAssign,
  type AssignablePlayer,
} from '../group-assignment'

function makePlayers(handicaps: number[]): AssignablePlayer[] {
  return handicaps.map((h, i) => ({
    id: `p${i}`,
    userId: `u${i}`,
    name: `Player ${i}`,
    handicap: h,
  }))
}

describe('shuffleFisherYates', () => {
  it('returns a permutation of the input', () => {
    const arr = [1, 2, 3, 4, 5]
    const out = shuffleFisherYates(arr)
    expect(out).toHaveLength(5)
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate the input', () => {
    const arr = [1, 2, 3, 4, 5]
    shuffleFisherYates(arr)
    expect(arr).toEqual([1, 2, 3, 4, 5])
  })

  it('is deterministic with a seeded RNG', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const a = shuffleFisherYates(arr, seededRng(42))
    const b = shuffleFisherYates(arr, seededRng(42))
    expect(a).toEqual(b)
  })

  it('produces different orderings with different seeds', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const a = shuffleFisherYates(arr, seededRng(1))
    const b = shuffleFisherYates(arr, seededRng(2))
    expect(a).not.toEqual(b)
  })
})

describe('snakeDraftByHandicap (BALANCED)', () => {
  it('produces groups whose handicap sums are roughly equal', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const groups = snakeDraftByHandicap(players, 4)
    expect(groups).toHaveLength(3)
    const sums = groups.map((g) => g.reduce((s, p) => s + p.handicap, 0))
    const avg = sums.reduce((s, v) => s + v, 0) / sums.length
    for (const sum of sums) {
      expect(Math.abs(sum - avg)).toBeLessThanOrEqual(2)
    }
  })

  it('places every player exactly once', () => {
    const players = makePlayers([5, 12, 3, 8, 18, 22, 1, 9, 14, 6])
    const groups = snakeDraftByHandicap(players, 4)
    const flat = groups.flat().map((p) => p.id).sort()
    expect(flat).toEqual(players.map((p) => p.id).sort())
  })

  it('handles empty input', () => {
    expect(snakeDraftByHandicap([], 4)).toEqual([])
  })
})

describe('flightByHandicap (TIGHT)', () => {
  it('groups consecutive handicaps together', () => {
    const players = makePlayers([1, 5, 9, 12, 14, 18])
    const groups = flightByHandicap(players, 3)
    expect(groups).toHaveLength(2)
    expect(groups[0].map((p) => p.handicap)).toEqual([1, 5, 9])
    expect(groups[1].map((p) => p.handicap)).toEqual([12, 14, 18])
  })
})

describe('assignRandom', () => {
  it('places every player exactly once', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7])
    const groups = assignRandom(players, 4, seededRng(7))
    const flat = groups.flat().map((p) => p.id).sort()
    expect(flat).toEqual(players.map((p) => p.id).sort())
  })

  it('respects group size cap (last group may be smaller)', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7])
    const groups = assignRandom(players, 4, seededRng(1))
    expect(groups[0].length).toBeLessThanOrEqual(4)
    expect(groups.flat()).toHaveLength(7)
  })
})

describe('assignWithPartnerAvoidance', () => {
  function partnerMapFromGroups(groups: AssignablePlayer[][]): Record<string, Set<string>> {
    const out: Record<string, Set<string>> = {}
    for (const g of groups) {
      for (const p of g) {
        if (!out[p.userId]) out[p.userId] = new Set()
        for (const q of g) if (q.userId !== p.userId) out[p.userId].add(q.userId)
      }
    }
    return out
  }

  it('reports zero conflicts when avoidance is solvable', () => {
    // 16 players, 4 groups of 4. Last week's pairings can be re-shuffled.
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    // Previous event: groups by index 0-3, 4-7, 8-11, 12-15
    const prev: AssignablePlayer[][] = [
      players.slice(0, 4),
      players.slice(4, 8),
      players.slice(8, 12),
      players.slice(12, 16),
    ]
    const recent = partnerMapFromGroups(prev)
    const result = assignWithPartnerAvoidance(players, 4, recent, 'BALANCED', seededRng(1))
    expect(result.groups).toHaveLength(4)
    expect(result.conflicts).toBe(0)
  })

  it('returns conflicts > 0 when avoidance is infeasible', () => {
    // Only 8 players, 2 groups of 4. After one event everyone's already played
    // with everyone else in their group — repeats are unavoidable.
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8])
    const prev: AssignablePlayer[][] = [players.slice(0, 4), players.slice(4, 8)]
    const recent = partnerMapFromGroups(prev)
    const result = assignWithPartnerAvoidance(players, 4, recent, 'BALANCED', seededRng(1))
    expect(result.groups).toHaveLength(2)
    expect(result.conflicts).toBeGreaterThan(0)
  })

  it('places every player exactly once even with conflicts', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8])
    const prev: AssignablePlayer[][] = [players.slice(0, 4), players.slice(4, 8)]
    const recent = partnerMapFromGroups(prev)
    const result = assignWithPartnerAvoidance(players, 4, recent, 'BALANCED', seededRng(1))
    const flat = result.groups.flat().map((p) => p.id).sort()
    expect(flat).toEqual(players.map((p) => p.id).sort())
  })
})

describe('autoAssign entrypoint', () => {
  it('routes RANDOM mode to a shuffle', () => {
    const players = makePlayers([1, 2, 3, 4])
    const result = autoAssign(players, 'RANDOM', 4, { rng: seededRng(1) })
    expect(result.groups.flat()).toHaveLength(4)
    expect(result.conflicts).toBe(0)
  })

  it('routes BALANCED mode to snake draft', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8])
    const result = autoAssign(players, 'BALANCED', 4)
    expect(result.groups).toHaveLength(2)
    // Group sums should be roughly equal (snake draft of 1..8 → 1+4+5+8=18, 2+3+6+7=18)
    const sums = result.groups.map((g) => g.reduce((s, p) => s + p.handicap, 0))
    expect(sums[0]).toBe(sums[1])
  })

  it('uses partner avoidance when enabled', () => {
    const players = makePlayers([1, 2, 3, 4, 5, 6, 7, 8])
    const recent: Record<string, Set<string>> = { u0: new Set(['u1', 'u2', 'u3']) }
    const result = autoAssign(players, 'BALANCED', 4, {
      avoidLastEventPartners: true,
      recentPartners: recent,
      rng: seededRng(1),
    })
    expect(result.groups.flat()).toHaveLength(8)
    // p0 should not be grouped with p1, p2, p3 if at all avoidable
    const p0Group = result.groups.find((g) => g.some((p) => p.id === 'p0'))!
    const p0Mates = p0Group.filter((p) => p.id !== 'p0').map((p) => p.userId)
    const collisions = p0Mates.filter((u) => ['u1', 'u2', 'u3'].includes(u))
    expect(collisions.length).toBe(0)
  })
})

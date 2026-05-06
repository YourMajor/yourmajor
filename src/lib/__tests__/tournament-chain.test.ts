import { describe, it, expect } from 'vitest'
import {
  aggregateChainRoster,
  type RosterTournamentInput,
} from '@/lib/tournament-chain'

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeInput(opts: {
  slug: string
  name: string
  year: number | null
  rows: Array<{
    rank: number
    tournamentPlayerId: string
    playerName: string
    avatarUrl?: string | null
    userId: string | null
  }>
}): RosterTournamentInput {
  return {
    tournament: { slug: opts.slug, name: opts.name, year: opts.year },
    standings: opts.rows.map((r) => ({
      rank: r.rank,
      tournamentPlayerId: r.tournamentPlayerId,
      playerName: r.playerName,
      avatarUrl: r.avatarUrl ?? null,
    })),
    userIdByPlayer: new Map<string, string | null>(
      opts.rows.map((r) => [r.tournamentPlayerId, r.userId]),
    ),
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('aggregateChainRoster', () => {
  it('totalYearsInChain reflects the number of inputs (completed tournaments) passed', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024 Open',
        year: 2024,
        rows: [{ rank: 1, tournamentPlayerId: 'tp1', playerName: 'Alice', userId: 'u1' }],
      }),
      makeInput({
        slug: '2023',
        name: '2023 Open',
        year: 2023,
        rows: [{ rank: 1, tournamentPlayerId: 'tp2', playerName: 'Alice', userId: 'u1' }],
      }),
      makeInput({
        slug: '2022',
        name: '2022 Open',
        year: 2022,
        rows: [{ rank: 1, tournamentPlayerId: 'tp3', playerName: 'Alice', userId: 'u1' }],
      }),
    ])
    expect(result.totalYearsInChain).toBe(3)
  })

  it('aggregates yearsPlayed for a player across multiple completed tournaments', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [
          { rank: 1, tournamentPlayerId: 'tpA1', playerName: 'Alice', userId: 'u1' },
          { rank: 2, tournamentPlayerId: 'tpB1', playerName: 'Bob', userId: 'u2' },
        ],
      }),
      makeInput({
        slug: '2023',
        name: '2023',
        year: 2023,
        rows: [
          { rank: 1, tournamentPlayerId: 'tpA2', playerName: 'Alice', userId: 'u1' },
        ],
      }),
      makeInput({
        slug: '2022',
        name: '2022',
        year: 2022,
        rows: [
          { rank: 5, tournamentPlayerId: 'tpA3', playerName: 'Alice', userId: 'u1' },
          { rank: 6, tournamentPlayerId: 'tpB3', playerName: 'Bob', userId: 'u2' },
        ],
      }),
    ])

    const alice = result.entries.find((e) => e.userId === 'u1')!
    const bob = result.entries.find((e) => e.userId === 'u2')!
    expect(alice.yearsPlayed).toBe(3)
    expect(bob.yearsPlayed).toBe(2)
  })

  it('bestFinish picks the lowest (best) rank across the chain, not the most recent', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [{ rank: 8, tournamentPlayerId: 'tp1', playerName: 'Alice', userId: 'u1' }],
      }),
      makeInput({
        slug: '2023',
        name: '2023 Open',
        year: 2023,
        rows: [{ rank: 1, tournamentPlayerId: 'tp2', playerName: 'Alice', userId: 'u1' }],
      }),
      makeInput({
        slug: '2022',
        name: '2022',
        year: 2022,
        rows: [{ rank: 4, tournamentPlayerId: 'tp3', playerName: 'Alice', userId: 'u1' }],
      }),
    ])

    const alice = result.entries.find((e) => e.userId === 'u1')!
    expect(alice.bestFinish).toEqual({
      rank: 1,
      year: 2023,
      tournamentName: '2023 Open',
      slug: '2023',
    })
  })

  it('skips entries where userId is null (guests)', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [
          { rank: 1, tournamentPlayerId: 'tpA', playerName: 'Alice', userId: 'u1' },
          { rank: 2, tournamentPlayerId: 'tpG', playerName: 'Some Guest', userId: null },
        ],
      }),
    ])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].userId).toBe('u1')
  })

  it('sorts by best rank ascending, then yearsPlayed descending, then name ascending', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [
          { rank: 2, tournamentPlayerId: 'tpA', playerName: 'Alice', userId: 'uA' },
          { rank: 1, tournamentPlayerId: 'tpB', playerName: 'Bob', userId: 'uB' },
          { rank: 1, tournamentPlayerId: 'tpC', playerName: 'Carol', userId: 'uC' },
        ],
      }),
      makeInput({
        slug: '2023',
        name: '2023',
        year: 2023,
        rows: [
          { rank: 5, tournamentPlayerId: 'tpC2', playerName: 'Carol', userId: 'uC' },
        ],
      }),
    ])

    // Bob (rank 1, 1 yr) ties with Carol (rank 1, 2 yrs) on rank → more years wins.
    // Alice (rank 2) comes after both.
    expect(result.entries.map((e) => e.userId)).toEqual(['uC', 'uB', 'uA'])
  })

  it('preserves the first-seen name and avatar when a userId appears in multiple inputs', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [
          {
            rank: 1,
            tournamentPlayerId: 'tp1',
            playerName: 'Current Display Name',
            avatarUrl: 'current.png',
            userId: 'u1',
          },
        ],
      }),
      makeInput({
        slug: '2023',
        name: '2023',
        year: 2023,
        rows: [
          {
            rank: 1,
            tournamentPlayerId: 'tp2',
            playerName: 'Old Display Name',
            avatarUrl: 'old.png',
            userId: 'u1',
          },
        ],
      }),
    ])

    expect(result.entries[0].playerName).toBe('Current Display Name')
    expect(result.entries[0].avatarUrl).toBe('current.png')
  })

  it('returns empty entries when given no inputs', () => {
    const result = aggregateChainRoster([])
    expect(result.totalYearsInChain).toBe(0)
    expect(result.entries).toEqual([])
  })

  it('counts inputs with all-guest standings toward totalYearsInChain but produces no entries', () => {
    const result = aggregateChainRoster([
      makeInput({
        slug: '2024',
        name: '2024',
        year: 2024,
        rows: [
          { rank: 1, tournamentPlayerId: 'tpG1', playerName: 'Guest A', userId: null },
          { rank: 2, tournamentPlayerId: 'tpG2', playerName: 'Guest B', userId: null },
        ],
      }),
    ])
    expect(result.totalYearsInChain).toBe(1)
    expect(result.entries).toEqual([])
  })
})

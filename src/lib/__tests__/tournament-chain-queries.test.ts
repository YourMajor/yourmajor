import { describe, it, expect, beforeEach, vi } from 'vitest'

// Query-count tests. getPodiumHistory and getChainRoster each used to issue a
// leaderboard read *and* a tournamentPlayer lookup per completed ancestor, so
// a 20-event chain cost ~40 serial round trips. Counting calls is the only
// thing that stops a batched query silently regressing back to a loop.
//
// Separate from tournament-chain.test.ts, which is deliberately mock-free and
// covers the pure aggregateChainRoster.

const CHAIN_DEPTH = 5

// tourn_0 is the current tournament; tourn_1..5 are its ancestors.
const parentOf: Record<string, string | null> = {
  tourn_0: 'tourn_1',
  tourn_1: 'tourn_2',
  tourn_2: 'tourn_3',
  tourn_3: 'tourn_4',
  tourn_4: 'tourn_5',
  tourn_5: null,
}

// A cyclic pair, to prove the walk terminates rather than hanging.
const cyclicParent: Record<string, string | null> = { cyc_a: 'cyc_b', cyc_b: 'cyc_a' }

let parents = parentOf

function row(id: string) {
  return {
    id,
    slug: id,
    name: `Event ${id}`,
    headerImage: null,
    status: 'COMPLETED',
    startDate: new Date('2020-01-01'),
    endDate: new Date('2020-01-02'),
    championUserId: null,
    championName: null,
    parentTournamentId: parents[id] ?? null,
  }
}

const prismaMock = {
  tournament: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id in parents ? row(where.id) : null,
    ),
  },
  tournamentPlayer: {
    findMany: vi.fn(async () => [{ id: 'tp_1', userId: 'user_1' }]),
  },
}

const scoringMock = {
  getCachedLeaderboard: vi.fn(async () => [
    {
      rank: 1,
      tournamentPlayerId: 'tp_1',
      playerName: 'Winner',
      avatarUrl: null,
      grossTotal: 72,
      netTotal: 70,
      grossVsPar: 0,
      netVsPar: -2,
    },
  ]),
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/scoring', () => scoringMock)

beforeEach(() => {
  vi.clearAllMocks()
  parents = parentOf
})

describe('tournament chain query batching', () => {
  it('getPodiumHistory does one player lookup for the whole chain', async () => {
    const { getPodiumHistory } = await import('../tournament-chain')
    const podiums = await getPodiumHistory('tourn_0', 3)

    expect(podiums).toHaveLength(CHAIN_DEPTH)
    // Was one per completed ancestor.
    expect(prismaMock.tournamentPlayer.findMany).toHaveBeenCalledTimes(1)
    expect(scoringMock.getCachedLeaderboard).toHaveBeenCalledTimes(CHAIN_DEPTH)
    // The podium still resolves the userId through the batched map.
    expect(podiums[0].finishers[0].userId).toBe('user_1')
  })

  it('getChainRoster does one player lookup for the whole chain', async () => {
    const { getChainRoster } = await import('../tournament-chain')
    const roster = await getChainRoster('tourn_0')

    expect(prismaMock.tournamentPlayer.findMany).toHaveBeenCalledTimes(1)
    // Current tournament + 5 ancestors, all COMPLETED in these fixtures.
    expect(roster.totalYearsInChain).toBe(CHAIN_DEPTH + 1)
    expect(roster.entries.length).toBeGreaterThan(0)
  })

  it('skips the player lookup entirely when nothing is completed', async () => {
    scoringMock.getCachedLeaderboard.mockResolvedValue([])

    const { getPodiumHistory } = await import('../tournament-chain')
    const podiums = await getPodiumHistory('tourn_0', 3)

    expect(podiums).toHaveLength(0)
    expect(prismaMock.tournamentPlayer.findMany).not.toHaveBeenCalled()
  })

  it('terminates on a cyclic parentTournamentId instead of hanging', async () => {
    parents = cyclicParent

    const { getAncestorChain } = await import('../tournament-chain')
    const ancestors = await getAncestorChain('cyc_a')

    // Bounded by MAX_CHAIN_DEPTH rather than looping forever.
    expect(ancestors.length).toBeLessThanOrEqual(20)
  })
})

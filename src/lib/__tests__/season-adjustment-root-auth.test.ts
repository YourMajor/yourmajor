import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the season-adjustment IDOR: the exported actions prove
// admin on the caller-supplied *leaf* id but read/write SeasonAdjustment rows
// keyed on the league *root* resolved by walking parentTournamentId. A caller
// who administers a tournament grafted under someone else's league could
// therefore list, add and delete that league's adjustments. Every export must
// re-check admin on the resolved root.

const authMock = {
  requireTournamentAdmin: vi.fn(),
  isTournamentAdmin: vi.fn(),
}

const leagueChainMock = {
  // Leaf 'leaf1' hangs off victim league root 'root1'.
  getRootTournamentId: vi.fn(async () => 'root1'),
}

const prismaMock = {
  seasonAdjustment: {
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => ({ rootTournamentId: 'root1' })),
    create: vi.fn(async () => ({ id: 'adj1' })),
    delete: vi.fn(async () => ({ id: 'adj1' })),
  },
  tournamentPlayer: { findFirst: vi.fn(async () => ({ id: 'tp1' })) },
  tournament: { findUnique: vi.fn(async () => ({ slug: 'victim-league' })) },
  user: { findMany: vi.fn(async () => []) },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/league-chain', () => leagueChainMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireTournamentAdmin.mockResolvedValue({ id: 'attacker' })
  leagueChainMock.getRootTournamentId.mockResolvedValue('root1')
  prismaMock.seasonAdjustment.findUnique.mockResolvedValue({ rootTournamentId: 'root1' })
})

describe('season adjustments — leaf admin is not root admin', () => {
  it('refuses to add an adjustment when the caller does not administer the root', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { addSeasonAdjustment } = await import('../season-standings-actions')
    await expect(
      addSeasonAdjustment('leaf1', { userId: 'victim', delta: 999, reason: 'lol' }),
    ).rejects.toThrow(/forbidden/i)
    expect(prismaMock.seasonAdjustment.create).not.toHaveBeenCalled()
  })

  it('refuses to delete another league\'s adjustment', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { deleteSeasonAdjustment } = await import('../season-standings-actions')
    await expect(deleteSeasonAdjustment('leaf1', 'adj1')).rejects.toThrow(/forbidden/i)
    expect(prismaMock.seasonAdjustment.delete).not.toHaveBeenCalled()
  })

  it('refuses to list another league\'s adjustments', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { listSeasonAdjustments } = await import('../season-standings-actions')
    await expect(listSeasonAdjustments('leaf1')).rejects.toThrow(/forbidden/i)
    expect(prismaMock.seasonAdjustment.findMany).not.toHaveBeenCalled()
  })

  it('allows a real league admin — admin on both the leaf and the root', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(true)

    const { addSeasonAdjustment } = await import('../season-standings-actions')
    await addSeasonAdjustment('leaf1', { userId: 'player', delta: 5, reason: 'ace' })
    expect(prismaMock.seasonAdjustment.create).toHaveBeenCalledWith({
      data: {
        rootTournamentId: 'root1',
        userId: 'player',
        delta: 5,
        reason: 'ace',
        createdBy: 'attacker',
      },
    })
  })

  it('does not add a second admin lookup when the leaf IS the root', async () => {
    leagueChainMock.getRootTournamentId.mockResolvedValue('root1')

    const { listSeasonAdjustments } = await import('../season-standings-actions')
    await listSeasonAdjustments('root1')
    expect(authMock.isTournamentAdmin).not.toHaveBeenCalled()
    expect(prismaMock.seasonAdjustment.findMany).toHaveBeenCalled()
  })
})

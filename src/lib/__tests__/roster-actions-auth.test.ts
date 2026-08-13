import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the leaf/root privilege split in roster-actions.
// These actions authorized the caller-supplied tournament id but wrote to the
// league root resolved from it, so an admin of a descendant event could mutate
// another organizer's league. Admin on the ROOT is now required too.

const authMock = {
  requireTournamentAdmin: vi.fn(),
}

const prismaMock = {
  tournament: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  leagueRoster: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  leagueRosterMember: {
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  tournamentPlayer: { findMany: vi.fn() },
}

const chainMock = {
  getRootTournamentId: vi.fn(),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/league-chain', () => chainMock)
vi.mock('@/lib/invite-sender', () => ({ sendInvitations: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const CONFIG = {
  seasonScoringMethod: 'POINTS',
  seasonBestOf: null,
  seasonPointsTable: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  // The caller named a leaf event; the chain resolves to someone else's root.
  chainMock.getRootTournamentId.mockResolvedValue('root_victim')
  prismaMock.tournament.findUnique.mockResolvedValue({ slug: 'some-slug' })
  prismaMock.tournament.update.mockResolvedValue({ id: 'root_victim' })
  prismaMock.leagueRoster.findUnique.mockResolvedValue({ id: 'r1', members: [] })
})

/** Admin of the leaf only — the attacker's position. */
function leafOnlyAdmin() {
  authMock.requireTournamentAdmin.mockImplementation(async (id: string) => {
    if (id !== 'leaf_mine') throw new Error('Forbidden')
    return { id: 'user_1' }
  })
}

describe('roster-actions — league root authorization', () => {
  it('updateSeasonConfig refuses an admin of a leaf in someone else’s chain', async () => {
    leafOnlyAdmin()

    const { updateSeasonConfig } = await import('../roster-actions')
    await expect(updateSeasonConfig('leaf_mine', CONFIG)).rejects.toThrow(/forbidden/i)
    expect(prismaMock.tournament.update).not.toHaveBeenCalled()
  })

  it('updateSeasonConfig still writes the root for an admin of that root', async () => {
    authMock.requireTournamentAdmin.mockResolvedValue({ id: 'user_1' })

    const { updateSeasonConfig } = await import('../roster-actions')
    await updateSeasonConfig('leaf_mine', CONFIG)

    expect(authMock.requireTournamentAdmin).toHaveBeenCalledWith('root_victim')
    expect(prismaMock.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'root_victim' } }),
    )
  })

  it('removeRosterMember refuses before touching the roster', async () => {
    leafOnlyAdmin()

    const { removeRosterMember } = await import('../roster-actions')
    await expect(removeRosterMember('leaf_mine', 'member_1')).rejects.toThrow(/forbidden/i)
    expect(prismaMock.leagueRosterMember.deleteMany).not.toHaveBeenCalled()
  })

  it('getOrCreateRoster refuses to read or seed another chain’s roster', async () => {
    leafOnlyAdmin()

    const { getOrCreateRoster } = await import('../roster-actions')
    await expect(getOrCreateRoster('leaf_mine')).rejects.toThrow(/forbidden/i)
    expect(prismaMock.leagueRoster.findUnique).not.toHaveBeenCalled()
  })
})

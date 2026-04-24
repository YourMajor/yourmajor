import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression tests for the C1/C2 auth bypasses.
// These server actions previously had zero auth checks — any authenticated
// user could call them with any tournamentId and mutate it. Lock them down
// so a missing `requireAuth()` or `isTournamentAdmin()` call is a test failure.

const authMock = {
  requireAuth: vi.fn(),
  isTournamentAdmin: vi.fn(),
}

const prismaMock = {
  tournament: {
    findUnique: vi.fn(async () => ({ id: 't1', slug: 'ryder', handicapSystem: 'WHS', powerupsEnabled: true, powerupsPerPlayer: 3, maxAttacksPerPlayer: 1, distributionMode: 'DRAFT' })),
    update: vi.fn(async () => ({ id: 't1' })),
  },
  score: { count: vi.fn(async () => 0) },
  draft: { findUnique: vi.fn(async () => null) },
  playerPowerup: { count: vi.fn(async () => 0) },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('closeRegistrationAndGoLive — auth gate', () => {
  it('throws Forbidden when caller is not a tournament admin', async () => {
    authMock.requireAuth.mockResolvedValue({ id: 'user_1' })
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { closeRegistrationAndGoLive } = await import('./actions')
    await expect(closeRegistrationAndGoLive('t1')).rejects.toThrow(/forbidden/i)
    expect(prismaMock.tournament.update).not.toHaveBeenCalled()
  })

  it('throws Unauthorized when caller is not authenticated', async () => {
    authMock.requireAuth.mockRejectedValue(new Error('Unauthorized'))
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { closeRegistrationAndGoLive } = await import('./actions')
    await expect(closeRegistrationAndGoLive('t1')).rejects.toThrow(/unauthorized/i)
    expect(prismaMock.tournament.update).not.toHaveBeenCalled()
  })

  it('proceeds when caller IS a tournament admin', async () => {
    authMock.requireAuth.mockResolvedValue({ id: 'user_1' })
    authMock.isTournamentAdmin.mockResolvedValue(true)

    const { closeRegistrationAndGoLive } = await import('./actions')
    await closeRegistrationAndGoLive('t1')
    expect(prismaMock.tournament.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { registrationClosed: true, status: 'ACTIVE' },
    })
  })
})

describe('updateTournament — auth gate', () => {
  function makeFormData(): FormData {
    const fd = new FormData()
    fd.set('name', 'Ryder Cup')
    fd.set('slug', 'ryder')
    fd.set('primaryColor', '#006747')
    fd.set('accentColor', '#ffcc00')
    fd.set('handicapSystem', 'WHS')
    fd.set('powerupsEnabled', 'on')
    fd.set('powerupsPerPlayer', '3')
    fd.set('maxAttacksPerPlayer', '1')
    fd.set('distributionMode', 'DRAFT')
    return fd
  }

  it('throws Forbidden when caller is not a tournament admin', async () => {
    authMock.requireAuth.mockResolvedValue({ id: 'user_1' })
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { updateTournament } = await import('./setup/actions')
    await expect(updateTournament('t1', 'ryder', null, null, makeFormData())).rejects.toThrow(/forbidden/i)
    expect(prismaMock.tournament.update).not.toHaveBeenCalled()
  })

  it('throws Unauthorized when caller is not authenticated', async () => {
    authMock.requireAuth.mockRejectedValue(new Error('Unauthorized'))
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { updateTournament } = await import('./setup/actions')
    await expect(updateTournament('t1', 'ryder', null, null, makeFormData())).rejects.toThrow(/unauthorized/i)
    expect(prismaMock.tournament.update).not.toHaveBeenCalled()
  })
})

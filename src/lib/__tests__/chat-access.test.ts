import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  tournamentPlayer: { findUnique: vi.fn(), upsert: vi.fn() },
  tournament: { findUnique: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { resolveChatAccess } from '@/lib/chat-access'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tournamentPlayer.upsert.mockResolvedValue({ id: 'tp_new' })
})

describe('resolveChatAccess', () => {
  it('lets anyone with a row in (player, admin or watcher)', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue({ id: 'tp_1' })
    await expect(resolveChatAccess('t1', 'u1', { enrollAsWatcher: true })).resolves.toEqual({
      allowed: true,
      tournamentPlayerId: 'tp_1',
    })
    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })

  it('lets a bystander read an open tournament without enrolling them', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
    prismaMock.tournament.findUnique.mockResolvedValue({ tournamentType: 'OPEN' })
    await expect(resolveChatAccess('t1', 'u1')).resolves.toEqual({
      allowed: true,
      tournamentPlayerId: null,
    })
    expect(prismaMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })

  it('records a posting bystander as a watcher', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
    prismaMock.tournament.findUnique.mockResolvedValue({ tournamentType: 'PUBLIC' })
    await expect(resolveChatAccess('t1', 'u1', { enrollAsWatcher: true })).resolves.toEqual({
      allowed: true,
      tournamentPlayerId: 'tp_new',
    })
    expect(prismaMock.tournamentPlayer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isParticipant: false, isAdmin: false, isWatching: true }),
        update: {},
      }),
    )
  })

  it('keeps INVITE tournaments members-only', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
    prismaMock.tournament.findUnique.mockResolvedValue({ tournamentType: 'INVITE' })
    const res = await resolveChatAccess('t1', 'u1', { enrollAsWatcher: true })
    expect(res).toMatchObject({ allowed: false, status: 403 })
    expect(prismaMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })

  it('404s an unknown tournament', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
    prismaMock.tournament.findUnique.mockResolvedValue(null)
    await expect(resolveChatAccess('nope', 'u1')).resolves.toMatchObject({ allowed: false, status: 404 })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Undo used to revert the PlayerPowerup row and nothing else, leaving the
// target with a permanent attack notification and the chat with a permanent
// attack announcement.

const authMock = { getUser: vi.fn() }
const broadcastMock = { broadcastNotification: vi.fn(async () => {}) }

const USED_AT = new Date('2026-08-10T10:00:00Z')
let powerupRow: Record<string, unknown> | null = null

const resetWrites: Array<Record<string, unknown>> = []
const messageUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = []

const prismaMock = {
  tournamentPlayer: { findUnique: vi.fn(async () => ({ id: 'tp_caller' })) },
  playerPowerup: {
    findUnique: vi.fn(async () => powerupRow),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => {
      resetWrites.push(args.data)
      return { status: 'AVAILABLE' }
    }),
  },
  notification: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  tournamentMessage: {
    updateMany: vi.fn(
      async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        messageUpdates.push(args)
        return { count: 1 }
      },
    ),
  },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/notification-broadcast', () => broadcastMock)

beforeEach(() => {
  vi.clearAllMocks()
  resetWrites.length = 0
  messageUpdates.length = 0
  authMock.getUser.mockResolvedValue({ id: 'user_caller' })
  powerupRow = {
    id: 'pp_1',
    tournamentPlayerId: 'tp_caller',
    status: 'USED',
    targetPlayerId: 'tp_target',
    usedAt: USED_AT,
    powerup: { name: 'Out of Bounds' },
  }
})

const ctx = () => ({ params: Promise.resolve({ id: 'tourn_1' }) })

const req = () =>
  new NextRequest('http://localhost/api/tournaments/tourn_1/powerups/undo', {
    method: 'POST',
    body: JSON.stringify({ playerPowerupId: 'pp_1' }),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/tournaments/[id]/powerups/undo', () => {
  it('clears every field activation wrote, including targetHoleNumber and metadata', async () => {
    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(200)
    const data = resetWrites[0]
    expect(data.targetHoleNumber).toBeNull()
    // Prisma treats `undefined` as "don't touch", so a JSON null has to be
    // explicit or the variable-powerup metadata survives the undo.
    expect(data.metadata).not.toBeUndefined()
  })

  it('deletes the attack notification and re-broadcasts to the target', async () => {
    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        tournamentPlayerId: 'tp_target',
        type: 'ATTACK_RECEIVED',
        payload: { path: ['playerPowerupId'], equals: 'pp_1' },
      },
    })
    expect(broadcastMock.broadcastNotification).toHaveBeenCalledWith('tp_target')
  })

  it('soft-deletes the system chat message for this activation', async () => {
    const { POST } = await import('./route')
    await POST(req(), ctx())

    const call = messageUpdates[0]
    expect(call.where).toMatchObject({
      tournamentId: 'tourn_1',
      isSystem: true,
      content: { contains: 'Out of Bounds' },
      createdAt: { gte: USED_AT },
    })
    expect(call.data.deletedBy).toBe('user_caller')
  })

  it('skips the notification cleanup for a boost with no target', async () => {
    powerupRow = { ...powerupRow, targetPlayerId: null }

    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(prismaMock.notification.deleteMany).not.toHaveBeenCalled()
    expect(broadcastMock.broadcastNotification).not.toHaveBeenCalled()
    // The chat line still goes — boosts announce themselves too.
    expect(prismaMock.tournamentMessage.updateMany).toHaveBeenCalled()
  })
})

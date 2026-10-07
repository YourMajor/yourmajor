import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Undo used to revert the PlayerPowerup row and nothing else, leaving the
// target with a permanent attack notification and the chat with a permanent
// attack announcement.
//
// It also had no caller at all for months — the route was built and tested but
// never wired to a button, which is how players ended up stuck with cards they
// activated by accident. The cases below pin the two rules that let it be
// exposed safely: a player may only take a card back while its outcome is
// still unknown, and an admin may always take anyone's back.

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }
const broadcastMock = { broadcastNotification: vi.fn(async () => {}) }

const USED_AT = new Date('2026-08-10T10:00:00Z')
let powerupRow: Record<string, unknown> | null = null
/** Scores the mocked DB will claim exist, for the outcome-known check. */
let scoreRow: { id: string } | null = null
let scoreCount = 0

const resetWrites: Array<Record<string, unknown>> = []
const messageUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = []
const scoreQueries: Array<Record<string, unknown>> = []

const prismaMock = {
  // Returns null for an admin who is not a participant — admin ≠ participant.
  tournamentPlayer: { findUnique: vi.fn<() => Promise<{ id: string } | null>>(async () => ({ id: 'tp_caller' })) },
  playerPowerup: {
    findUnique: vi.fn(async () => powerupRow),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => {
      resetWrites.push(args.data)
      return { status: 'AVAILABLE' }
    }),
    // Re-arming any reaction the undone activation consumed.
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  score: {
    findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
      scoreQueries.push(args.where)
      return scoreRow
    }),
    count: vi.fn(async (args: { where: Record<string, unknown> }) => {
      scoreQueries.push(args.where)
      return scoreCount
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
  scoreQueries.length = 0
  scoreRow = null
  scoreCount = 0
  authMock.getUser.mockResolvedValue({ id: 'user_caller' })
  authMock.isTournamentAdmin.mockResolvedValue(false)
  prismaMock.tournamentPlayer.findUnique.mockResolvedValue({ id: 'tp_caller' })
  powerupRow = {
    id: 'pp_1',
    tournamentPlayerId: 'tp_caller',
    status: 'USED',
    targetPlayerId: 'tp_target',
    roundId: 'round_1',
    holeNumber: 4,
    targetHoleNumber: 11,
    usedAt: USED_AT,
    powerup: { name: 'Out of Bounds', type: 'ATTACK' },
    tournamentPlayer: { tournamentId: 'tourn_1', userId: 'user_caller' },
  }
})

const ctx = () => ({ params: Promise.resolve({ id: 'tourn_1' }) })

const req = () =>
  new NextRequest('http://localhost/api/tournaments/tourn_1/powerups/undo', {
    method: 'POST',
    body: JSON.stringify({ playerPowerupId: 'pp_1' }),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/tournaments/[id]/powerups/undo — rollback', () => {
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
    powerupRow = { ...powerupRow, targetPlayerId: null, powerup: { name: 'Out of Bounds', type: 'BOOST' } }

    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(prismaMock.notification.deleteMany).not.toHaveBeenCalled()
    expect(broadcastMock.broadcastNotification).not.toHaveBeenCalled()
    // The chat line still goes — boosts announce themselves too.
    expect(prismaMock.tournamentMessage.updateMany).toHaveBeenCalled()
  })
})

describe('POST /api/tournaments/[id]/powerups/undo — who may undo', () => {
  it('lets an admin undo a card belonging to someone else', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(true)
    authMock.getUser.mockResolvedValue({ id: 'user_admin' })
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue({ id: 'tp_admin' })
    powerupRow = { ...powerupRow, tournamentPlayerId: 'tp_someone_else' }

    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(200)
  })

  it('lets an admin who is not a participant undo', async () => {
    // admin ≠ participant in this product, so an organiser who is not playing
    // must still be able to fix a card.
    authMock.isTournamentAdmin.mockResolvedValue(true)
    authMock.getUser.mockResolvedValue({ id: 'user_admin' })
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
    powerupRow = { ...powerupRow, tournamentPlayerId: 'tp_someone_else' }

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(200)
  })

  it('refuses a non-admin undoing somebody else\'s card', async () => {
    powerupRow = { ...powerupRow, tournamentPlayerId: 'tp_someone_else' }

    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Not your powerup')
  })

  it('refuses to reach a card belonging to another tournament', async () => {
    // playerPowerupId is caller-supplied; an admin of one tournament must not
    // be able to undo a card in another.
    authMock.isTournamentAdmin.mockResolvedValue(true)
    powerupRow = { ...powerupRow, tournamentPlayer: { tournamentId: 'tourn_OTHER', userId: 'user_x' } }

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(404)
  })

  it('refuses a card that is not in use', async () => {
    powerupRow = { ...powerupRow, status: 'AVAILABLE' }

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(400)
  })
})

describe('POST /api/tournaments/[id]/powerups/undo — the outcome-known lock', () => {
  it('blocks a player once the outcome is known, and says to ask an admin', async () => {
    scoreRow = { id: 'score_1' }

    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('admin')
    // and nothing was rolled back
    expect(resetWrites).toHaveLength(0)
  })

  it('reads an ATTACK off the victim\'s landing hole, not the attacker\'s hole', async () => {
    // holeNumber 4 is the attacker's; targetHoleNumber 11 is where it lands.
    // Reading the attacker's hole would say nothing about what the attack did.
    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(scoreQueries[0]).toMatchObject({
      tournamentPlayerId: 'tp_target',
      roundId: 'round_1',
      hole: { number: 11 },
    })
  })

  it('reads a BOOST off the activator\'s own hole', async () => {
    powerupRow = {
      ...powerupRow,
      targetPlayerId: null,
      powerup: { name: 'Mulligan', type: 'BOOST' },
    }

    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(scoreQueries[0]).toMatchObject({
      tournamentPlayerId: 'tp_caller',
      hole: { number: 4 },
    })
  })

  it('treats a multi-hole card as known once ANY hole in its window is scored', async () => {
    powerupRow = {
      ...powerupRow,
      status: 'ACTIVE',
      targetPlayerId: null,
      powerup: { name: 'Par Train', type: 'BOOST' },
    }
    scoreCount = 1

    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(409)
    // the window runs from the hole AFTER activation
    expect(scoreQueries[0]).toMatchObject({ hole: { number: { gt: 4 } } })
  })

  it('allows a multi-hole card back while no window hole has been scored', async () => {
    powerupRow = {
      ...powerupRow,
      status: 'ACTIVE',
      targetPlayerId: null,
      powerup: { name: 'Par Train', type: 'BOOST' },
    }
    scoreCount = 0

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(200)
  })

  it('lets an admin through even when the outcome is known', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(true)
    scoreRow = { id: 'score_1' }

    const { POST } = await import('./route')
    const res = await POST(req(), ctx())

    expect(res.status).toBe(200)
    // the lock is not even consulted for an admin
    expect(prismaMock.score.findFirst).not.toHaveBeenCalled()
  })
})

describe('POST /api/tournaments/[id]/powerups/undo — reactive cards', () => {
  it('lets an ARMED card be taken back', async () => {
    // The guard used to allow only USED/ACTIVE, which left a reactive card
    // played by mistake stuck armed for the rest of the round.
    powerupRow = {
      ...powerupRow,
      status: 'ARMED',
      targetPlayerId: null,
      powerup: { name: 'Deflector', type: 'BOOST' },
    }

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(200)
  })

  it('never locks an ARMED card — nothing about it is knowable yet', async () => {
    powerupRow = {
      ...powerupRow,
      status: 'ARMED',
      targetPlayerId: null,
      powerup: { name: 'Deflector', type: 'BOOST' },
    }
    scoreRow = { id: 'score_1' } // the hole IS scored

    const { POST } = await import('./route')
    expect((await POST(req(), ctx())).status).toBe(200)
  })

  it('re-arms a reaction the undone attack had burned', async () => {
    // Otherwise undo is a free way to strip somebody's Deflector: attack into
    // it, watch it fire, take the attack back, keep the advantage.
    powerupRow = {
      ...powerupRow,
      metadata: { reactedBy: [{ playerPowerupId: 'pp_deflector', reaction: 'on_targeted' }] },
    }

    const { POST } = await import('./route')
    await POST(req(), ctx())

    expect(prismaMock.playerPowerup.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['pp_deflector'] }, status: 'USED' },
      data: { status: 'ARMED', scoreModifier: null, targetHoleNumber: null },
    })
  })

  it('ignores a malformed reactedBy rather than throwing', async () => {
    for (const bad of [null, 'nope', 42, { reactedBy: 'x' }, { reactedBy: [1, 2] }, { reactedBy: [{}] }]) {
      vi.clearAllMocks()
      powerupRow = { ...powerupRow, metadata: bad }
      const { POST } = await import('./route')
      expect((await POST(req(), ctx())).status).toBe(200)
      expect(prismaMock.playerPowerup.updateMany).not.toHaveBeenCalled()
    }
  })
})

describe('POST /api/tournaments/[id]/powerups/undo — admin chat cleanup', () => {
  it('soft-deletes the ACTIVATOR\'s chat line, not the admin\'s own messages', async () => {
    // Activation authors the system line as the activating player. Scoping the
    // cleanup to the caller left the real line standing in chat for good
    // whenever an admin undid someone else's card.
    authMock.isTournamentAdmin.mockResolvedValue(true)
    authMock.getUser.mockResolvedValue({ id: 'user_admin' })
    powerupRow = {
      ...powerupRow,
      tournamentPlayerId: 'tp_someone_else',
      tournamentPlayer: { tournamentId: 'tourn_1', userId: 'user_activator' },
    }

    const { POST } = await import('./route')
    await POST(req(), ctx())

    const call = messageUpdates[0]
    expect(call.where).toMatchObject({ userId: 'user_activator' })
    // but the admin is recorded as who deleted it
    expect(call.data.deletedBy).toBe('user_admin')
  })
})

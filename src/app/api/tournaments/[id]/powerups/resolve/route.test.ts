import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = { getUser: vi.fn() }

type PlayerRow = { id: string }
type PlayerPowerupRow = {
  id: string
  tournamentPlayerId: string
  targetPlayerId: string | null
  status: 'AVAILABLE' | 'ACTIVE' | 'USED'
  powerup: { slug: string; effect: { scoring: { modifier: number | null; cap?: number | null } } }
}

let currentPlayer: PlayerRow | null = null
let powerupRow: PlayerPowerupRow | null = null
const updatedScoreModifiers: Array<{ id: string; scoreModifier: number }> = []

const prismaMock = {
  tournamentPlayer: {
    findUnique: vi.fn(async () => currentPlayer),
  },
  playerPowerup: {
    findUnique: vi.fn(async () => powerupRow),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { scoreModifier: number } }) => {
      updatedScoreModifiers.push({ id: where.id, scoreModifier: data.scoreModifier })
      return { ...powerupRow, scoreModifier: data.scoreModifier }
    }),
  },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

beforeEach(() => {
  currentPlayer = null
  powerupRow = null
  updatedScoreModifiers.length = 0
  vi.clearAllMocks()
})

function ctx() {
  return { params: Promise.resolve({ id: 'tourn_1' }) }
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tournaments/tourn_1/powerups/resolve', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/tournaments/[id]/powerups/resolve — authorization', () => {
  it('boost: activator (powerup.tournamentPlayerId) is authorized', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_activator' })
    currentPlayer = { id: 'tp_activator' }
    powerupRow = {
      id: 'pp_1',
      tournamentPlayerId: 'tp_activator',
      targetPlayerId: null,
      status: 'USED',
      powerup: { slug: 'greenside-magic', effect: { scoring: { modifier: -2 } } },
    }

    const { POST } = await import('./route')
    const res = await POST(req({ playerPowerupId: 'pp_1', scoreModifier: -2 }), ctx())
    expect(res.status).toBe(200)
    expect(updatedScoreModifiers).toEqual([{ id: 'pp_1', scoreModifier: -2 }])
  })

  it('boost: target cannot resolve (only the activator can)', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_target' })
    currentPlayer = { id: 'tp_target' }
    powerupRow = {
      id: 'pp_2',
      tournamentPlayerId: 'tp_activator',
      targetPlayerId: null,
      status: 'USED',
      powerup: { slug: 'greenside-magic', effect: { scoring: { modifier: -2 } } },
    }

    const { POST } = await import('./route')
    const res = await POST(req({ playerPowerupId: 'pp_2', scoreModifier: -2 }), ctx())
    expect(res.status).toBe(403)
    expect(updatedScoreModifiers).toEqual([])
  })

  it('attack (yes/no): target is authorized, activator is forbidden', async () => {
    powerupRow = {
      id: 'pp_3',
      tournamentPlayerId: 'tp_activator',
      targetPlayerId: 'tp_target',
      status: 'USED',
      powerup: { slug: 'drink-up', effect: { scoring: { modifier: 1 } } },
    }

    // Target resolves → 200
    authMock.getUser.mockResolvedValue({ id: 'user_target' })
    currentPlayer = { id: 'tp_target' }
    const { POST } = await import('./route')
    const targetRes = await POST(req({ playerPowerupId: 'pp_3', scoreModifier: 1 }), ctx())
    expect(targetRes.status).toBe(200)

    // Activator resolves → 403
    updatedScoreModifiers.length = 0
    authMock.getUser.mockResolvedValue({ id: 'user_activator' })
    currentPlayer = { id: 'tp_activator' }
    const activatorRes = await POST(req({ playerPowerupId: 'pp_3', scoreModifier: 1 }), ctx())
    expect(activatorRes.status).toBe(403)
    expect(updatedScoreModifiers).toEqual([])
  })

  it('attack (count): target is authorized, activator is forbidden', async () => {
    powerupRow = {
      id: 'pp_4',
      tournamentPlayerId: 'tp_activator',
      targetPlayerId: 'tp_target',
      status: 'USED',
      powerup: { slug: 'out-of-bounds', effect: { scoring: { modifier: 1, cap: 5 } } },
    }

    authMock.getUser.mockResolvedValue({ id: 'user_target' })
    currentPlayer = { id: 'tp_target' }
    const { POST } = await import('./route')
    const targetRes = await POST(req({ playerPowerupId: 'pp_4', scoreModifier: 3 }), ctx())
    expect(targetRes.status).toBe(200)

    updatedScoreModifiers.length = 0
    authMock.getUser.mockResolvedValue({ id: 'user_activator' })
    currentPlayer = { id: 'tp_activator' }
    const activatorRes = await POST(req({ playerPowerupId: 'pp_4', scoreModifier: 3 }), ctx())
    expect(activatorRes.status).toBe(403)
  })

  it('attack with no targetPlayerId: neither side can resolve (defensive)', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_activator' })
    currentPlayer = { id: 'tp_activator' }
    powerupRow = {
      id: 'pp_5',
      tournamentPlayerId: 'tp_activator',
      targetPlayerId: null,
      status: 'USED',
      powerup: { slug: 'drink-up', effect: { scoring: { modifier: 1 } } },
    }

    const { POST } = await import('./route')
    const res = await POST(req({ playerPowerupId: 'pp_5', scoreModifier: 1 }), ctx())
    expect(res.status).toBe(403)
  })
})

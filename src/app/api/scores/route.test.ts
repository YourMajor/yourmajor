import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = {
  getUser: vi.fn(),
}

type TargetRow = {
  userId: string
  tournamentId: string
  isAdmin: boolean
  teamMembership: { teamId: string } | null
  tournament: { status: string }
}
type CallerRow = { isAdmin: boolean; teamMembership: { teamId: string } | null }

let target: TargetRow | null = null
let caller: CallerRow | null = null

const prismaMock = {
  tournamentPlayer: {
    // The route looks the target up by id and the caller by (tournamentId, userId).
    findUnique: vi.fn(async ({ where }: { where: { id?: string } }) =>
      where.id ? target : caller,
    ),
  },
  tournamentRound: {
    findFirst: vi.fn(async () => ({ courseId: 'course_1' })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  hole: { findFirst: vi.fn(async () => ({ id: 'hole_1' })) },
  score: {
    // Non-null: an existing score keeps the round-start-message path out of the way.
    findUnique: vi.fn(async () => ({ id: 'score_1' })),
    upsert: vi.fn(async () => ({ id: 'score_1', strokes: 4 })),
  },
  tournament: { findUnique: vi.fn(async () => ({ tournamentFormat: 'SCRAMBLE' })) },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/variable-powerup-evaluator', () => ({
  evaluateActiveVariablePowerups: vi.fn(async () => []),
  evaluateAsKothTarget: vi.fn(async () => []),
  evaluateAsDoubleOrNothingTarget: vi.fn(async () => []),
  evaluatePostHoleAttacks: vi.fn(async () => []),
  findPendingConfirmations: vi.fn(async () => []),
}))

beforeEach(() => {
  target = null
  caller = null
  vi.clearAllMocks()
})

function fakeReq(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tournamentPlayerId: 'tp_1',
      holeId: 'hole_1',
      roundId: 'round_1',
      strokes: 4,
      ...body,
    }),
  })
}

describe('POST /api/scores — completed tournaments are frozen', () => {
  it('returns 409 and writes nothing when a player scores their own COMPLETED event', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
    target = {
      userId: 'user_1',
      tournamentId: 'tourn_1',
      isAdmin: false,
      teamMembership: null,
      tournament: { status: 'COMPLETED' },
    }

    const { POST } = await import('./route')
    const res = await POST(fakeReq())

    expect(res.status).toBe(409)
    expect(prismaMock.score.upsert).not.toHaveBeenCalled()
  })

  it('still saves on an ACTIVE tournament', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
    target = {
      userId: 'user_1',
      tournamentId: 'tourn_1',
      isAdmin: false,
      teamMembership: null,
      tournament: { status: 'ACTIVE' },
    }

    const { POST } = await import('./route')
    const res = await POST(fakeReq())

    expect(res.status).toBe(200)
    expect(prismaMock.score.upsert).toHaveBeenCalled()
  })

  it('returns 409 for a teammate writing the team score on a COMPLETED event', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_2', role: 'USER' })
    target = {
      userId: 'user_1',
      tournamentId: 'tourn_1',
      isAdmin: false,
      teamMembership: { teamId: 'team_1' },
      tournament: { status: 'COMPLETED' },
    }
    caller = { isAdmin: false, teamMembership: { teamId: 'team_1' } }

    const { POST } = await import('./route')
    const res = await POST(fakeReq())

    expect(res.status).toBe(409)
    expect(prismaMock.score.upsert).not.toHaveBeenCalled()
  })

  it('lets a tournament admin correct a COMPLETED event', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_2', role: 'USER' })
    target = {
      userId: 'user_1',
      tournamentId: 'tourn_1',
      isAdmin: false,
      teamMembership: null,
      tournament: { status: 'COMPLETED' },
    }
    caller = { isAdmin: true, teamMembership: null }

    const { POST } = await import('./route')
    const res = await POST(fakeReq())

    expect(res.status).toBe(200)
    expect(prismaMock.score.upsert).toHaveBeenCalled()
  })

  it('lets an admin scoring their own card correct a COMPLETED event', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
    target = {
      userId: 'user_1',
      tournamentId: 'tourn_1',
      isAdmin: true,
      teamMembership: null,
      tournament: { status: 'COMPLETED' },
    }

    const { POST } = await import('./route')
    const res = await POST(fakeReq())

    expect(res.status).toBe(200)
    expect(prismaMock.score.upsert).toHaveBeenCalled()
  })
})

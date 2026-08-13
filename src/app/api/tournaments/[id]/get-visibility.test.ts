import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// GET /api/tournaments/[id] used to return the whole Tournament row plus every
// round's full record to anyone holding an id. That published
// TournamentRound.peoriaHoles — the six secret Peoria holes the leaderboard
// withholds until a round completes — and exposed INVITE (private) events.

const authMock = {
  getUser: vi.fn(),
  isTournamentAdmin: vi.fn(),
}

let tournamentType = 'OPEN'
let membership: { id: string } | null = null
let lastSelect: Record<string, unknown> | undefined

const prismaMock = {
  tournament: {
    findUnique: vi.fn(async ({ select }: { select?: Record<string, unknown> }) => {
      lastSelect = select
      return { id: 'tourn_1', slug: 'open-cup', tournamentType, rounds: [], _count: { players: 3 } }
    }),
  },
  tournamentPlayer: {
    findUnique: vi.fn(async () => membership),
  },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  tournamentType = 'OPEN'
  membership = null
  lastSelect = undefined
  vi.clearAllMocks()
})

const ctx = () => ({ params: Promise.resolve({ id: 'tourn_1' }) })
const fakeReq = () => new NextRequest('http://localhost/api/tournaments/tourn_1')

describe('GET /api/tournaments/[id]', () => {
  it('never selects the Peoria secret holes or the join code', async () => {
    authMock.getUser.mockResolvedValue(null)

    const { GET } = await import('./route')
    await GET(fakeReq(), ctx())

    expect(lastSelect).toBeDefined()
    expect(lastSelect).not.toHaveProperty('joinCode')
    const rounds = lastSelect!.rounds as { select: Record<string, unknown> }
    expect(rounds.select).not.toHaveProperty('peoriaHoles')
  })

  it('stays anonymous-readable for a public tournament', async () => {
    authMock.getUser.mockResolvedValue(null)

    const { GET } = await import('./route')
    const res = await GET(fakeReq(), ctx())

    expect(res.status).toBe(200)
  })

  it('returns 401 for an anonymous caller on an INVITE tournament', async () => {
    tournamentType = 'INVITE'
    authMock.getUser.mockResolvedValue(null)

    const { GET } = await import('./route')
    const res = await GET(fakeReq(), ctx())

    expect(res.status).toBe(401)
  })

  it('returns 403 for a signed-in non-member on an INVITE tournament', async () => {
    tournamentType = 'INVITE'
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
    membership = null

    const { GET } = await import('./route')
    const res = await GET(fakeReq(), ctx())

    expect(res.status).toBe(403)
  })

  it('allows a member of an INVITE tournament', async () => {
    tournamentType = 'INVITE'
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
    membership = { id: 'tp_1' }

    const { GET } = await import('./route')
    const res = await GET(fakeReq(), ctx())

    expect(res.status).toBe(200)
  })
})

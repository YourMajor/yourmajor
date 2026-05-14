import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression tests for find-by-code: ensure a logged-in lookup persists a
// watching row so the tournament shows up on /tournaments, while leaving
// existing memberships and anonymous lookups untouched.

const authMock = {
  getUser: vi.fn(),
}

type MembershipRow = {
  tournamentId: string
  userId: string
  isParticipant: boolean
  isAdmin: boolean
  isWatching: boolean
}
const memberships: MembershipRow[] = []

const tournamentFixture = {
  id: 'tourn_1',
  slug: 'ryder-cup',
  name: 'Ryder Cup',
  tournamentType: 'PUBLIC',
  status: 'REGISTRATION',
}

const prismaMock = {
  tournament: {
    findUnique: vi.fn(async ({ where }: { where: { joinCode: string } }) => {
      if (where.joinCode === 'HTT3X9') return tournamentFixture
      return null
    }),
  },
  tournamentPlayer: {
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { tournamentId_userId: { tournamentId: string; userId: string } }
        create: MembershipRow
        update: Partial<MembershipRow>
      }) => {
        const existing = memberships.find(
          (m) =>
            m.tournamentId === where.tournamentId_userId.tournamentId &&
            m.userId === where.tournamentId_userId.userId
        )
        if (existing) {
          Object.assign(existing, update)
          return existing
        }
        memberships.push(create)
        return create
      }
    ),
  },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

beforeEach(() => {
  memberships.length = 0
  vi.clearAllMocks()
})

function req(code: string) {
  return new NextRequest(`http://localhost/api/tournaments/find?code=${code}`)
}

describe('GET /api/tournaments/find — watching upsert', () => {
  it('creates a watching row for a logged-in user with no existing membership', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })

    const { GET } = await import('./route')
    const res = await GET(req('HTT3X9'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      slug: 'ryder-cup',
      name: 'Ryder Cup',
      status: 'REGISTRATION',
    })
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toMatchObject({
      tournamentId: 'tourn_1',
      userId: 'user_1',
      isParticipant: false,
      isAdmin: false,
      isWatching: true,
    })
  })

  it('leaves an existing participant row untouched (update payload is empty)', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_2' })
    memberships.push({
      tournamentId: 'tourn_1',
      userId: 'user_2',
      isParticipant: true,
      isAdmin: false,
      isWatching: false,
    })

    const { GET } = await import('./route')
    const res = await GET(req('HTT3X9'))

    expect(res.status).toBe(200)
    expect(memberships).toHaveLength(1)
    expect(memberships[0].isParticipant).toBe(true)
    expect(memberships[0].isWatching).toBe(false)
    // Confirm the upsert was called with an empty update payload — that's the
    // mechanism that protects registered users from being silently downgraded.
    expect(prismaMock.tournamentPlayer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} })
    )
  })

  it('does not write any row for an anonymous lookup', async () => {
    authMock.getUser.mockResolvedValue(null)

    const { GET } = await import('./route')
    const res = await GET(req('HTT3X9'))

    expect(res.status).toBe(200)
    expect(prismaMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
    expect(memberships).toHaveLength(0)
  })

  it('returns 404 and writes nothing for an unknown code', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })

    const { GET } = await import('./route')
    const res = await GET(req('NOPE99'))

    expect(res.status).toBe(404)
    expect(prismaMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })
})

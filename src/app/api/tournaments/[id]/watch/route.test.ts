import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = {
  getUser: vi.fn(),
}

type MembershipRow = {
  id: string
  isParticipant: boolean
  isAdmin: boolean
}
let row: MembershipRow | null = null
const deletes: string[] = []

const prismaMock = {
  tournamentPlayer: {
    findUnique: vi.fn(async () => row),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      deletes.push(where.id)
      row = null
      return { id: where.id }
    }),
  },
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  row = null
  deletes.length = 0
  vi.clearAllMocks()
})

function ctx() {
  return { params: Promise.resolve({ id: 'tourn_1' }) }
}

function fakeReq() {
  return new NextRequest('http://localhost/api/tournaments/tourn_1/watch', { method: 'DELETE' })
}

describe('DELETE /api/tournaments/[id]/watch', () => {
  it('returns 401 for anonymous callers', async () => {
    authMock.getUser.mockResolvedValue(null)

    const { DELETE } = await import('./route')
    const res = await DELETE(fakeReq(), ctx())

    expect(res.status).toBe(401)
    expect(prismaMock.tournamentPlayer.delete).not.toHaveBeenCalled()
  })

  it('deletes the row for a pure watcher (isParticipant=false, isAdmin=false)', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })
    row = { id: 'tp_1', isParticipant: false, isAdmin: false }

    const { DELETE } = await import('./route')
    const res = await DELETE(fakeReq(), ctx())

    expect(res.status).toBe(200)
    expect(deletes).toEqual(['tp_1'])
    expect(row).toBeNull()
  })

  it('returns 409 and leaves the row intact when the caller is a participant', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })
    row = { id: 'tp_2', isParticipant: true, isAdmin: false }

    const { DELETE } = await import('./route')
    const res = await DELETE(fakeReq(), ctx())

    expect(res.status).toBe(409)
    expect(prismaMock.tournamentPlayer.delete).not.toHaveBeenCalled()
    expect(row).not.toBeNull()
  })

  it('returns 409 and leaves the row intact when the caller is an admin', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })
    row = { id: 'tp_3', isParticipant: false, isAdmin: true }

    const { DELETE } = await import('./route')
    const res = await DELETE(fakeReq(), ctx())

    expect(res.status).toBe(409)
    expect(prismaMock.tournamentPlayer.delete).not.toHaveBeenCalled()
  })

  it('is a no-op (200) when no membership row exists', async () => {
    authMock.getUser.mockResolvedValue({ id: 'user_1' })
    row = null

    const { DELETE } = await import('./route')
    const res = await DELETE(fakeReq(), ctx())

    expect(res.status).toBe(200)
    expect(prismaMock.tournamentPlayer.delete).not.toHaveBeenCalled()
  })
})

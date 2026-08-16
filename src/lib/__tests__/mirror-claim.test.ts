import { describe, it, expect, beforeEach, vi } from 'vitest'

// The Prisma User row used to be resolvable by email, which made the address an
// identity: whoever arrived at it got the row. Email can now change (behind a
// confirmation link), so the mirror is pinned to the Supabase auth user id
// instead, and the reconcile that follows a confirmed change must never take a
// row that belongs to someone else.

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}

const supabaseAuth = { getUser: vi.fn() }

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: supabaseAuth })),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ getUserTier: vi.fn() }))

const AUTH_ID = 'auth-uuid-1'
const row = (over: Record<string, unknown> = {}) => ({
  id: AUTH_ID,
  authUserId: null,
  email: 'player@example.com',
  name: 'Sam',
  ...over,
})

/** where-clause → row, for the two distinct findUnique lookups in the claim. */
function findUniqueBy(map: { authUserId?: unknown; id?: unknown }) {
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    if ('authUserId' in where) return map.authUserId ?? null
    if ('id' in where) return map.id ?? null
    return null
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(null)
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
})

describe('claimMirrorUser', () => {
  it('returns an already-claimed row without restamping it', async () => {
    const claimed = row({ id: 'legacy-uuid', authUserId: AUTH_ID })
    findUniqueBy({ authUserId: claimed })

    const { claimMirrorUser } = await import('@/lib/auth')
    await expect(claimMirrorUser(AUTH_ID, 'player@example.com')).resolves.toEqual(claimed)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('stamps a row found by primary key, and only while the stamp is still null', async () => {
    findUniqueBy({ id: row() })

    const { claimMirrorUser } = await import('@/lib/auth')
    const result = await claimMirrorUser(AUTH_ID, 'player@example.com')

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: AUTH_ID, authUserId: null },
      data: { authUserId: AUTH_ID },
    })
    expect(result?.authUserId).toBe(AUTH_ID)
  })

  it('matches a legacy row by email only while it is unclaimed', async () => {
    // CSV-imported row: its primary key is a random uuid, not the auth id.
    const legacy = row({ id: 'legacy-uuid' })
    prismaMock.user.findFirst.mockResolvedValue(legacy)

    const { claimMirrorUser } = await import('@/lib/auth')
    const result = await claimMirrorUser(AUTH_ID, 'player@example.com')

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'player@example.com', authUserId: null },
    })
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'legacy-uuid', authUserId: null },
      data: { authUserId: AUTH_ID },
    })
    expect(result?.id).toBe('legacy-uuid')
  })

  it('declines a row already claimed by a different identity', async () => {
    findUniqueBy({ id: row({ authUserId: 'someone-else' }) })

    const { claimMirrorUser } = await import('@/lib/auth')
    await expect(claimMirrorUser(AUTH_ID, 'player@example.com')).resolves.toBeNull()
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('declines on any unique violation, keyed on the code, without leaking Prisma text', async () => {
    findUniqueBy({ id: row() })
    const err = Object.assign(new Error('Unique constraint failed on the fields: (`authUserId`)'), {
      code: 'P2002',
    })
    prismaMock.user.updateMany.mockRejectedValue(err)

    const { claimMirrorUser } = await import('@/lib/auth')
    await expect(claimMirrorUser(AUTH_ID, 'player@example.com')).resolves.toBeNull()
  })
})

describe('getUser — email mirror reconcile', () => {
  beforeEach(() => {
    supabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: AUTH_ID, email: 'confirmed@example.com' } },
    })
  })

  it('follows the verified Supabase address once the confirmation has landed', async () => {
    findUniqueBy({ authUserId: row({ email: 'old@example.com', authUserId: AUTH_ID }) })
    prismaMock.user.update.mockResolvedValue(row({ email: 'confirmed@example.com', authUserId: AUTH_ID }))

    const { getUser } = await import('@/lib/auth')
    const result = await getUser()

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: AUTH_ID },
      data: { email: 'confirmed@example.com' },
    })
    expect(result?.email).toBe('confirmed@example.com')
  })

  it('declines, logs and keeps the caller on their own row when another row holds the address', async () => {
    const mine = row({ email: 'old@example.com', authUserId: AUTH_ID })
    findUniqueBy({ authUserId: mine })
    prismaMock.user.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { getUser } = await import('@/lib/auth')
    await expect(getUser()).resolves.toEqual(mine)
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})

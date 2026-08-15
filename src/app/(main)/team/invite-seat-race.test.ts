import { describe, it, expect, beforeEach, vi } from 'vitest'

// inviteCoAdmin counted the seats and then created the row as two plain awaits,
// so N concurrent invitations all saw the same pre-write count and all inserted.
// The write is now a conditional INSERT ... SELECT whose WHERE re-counts the
// seats, serialised by a transaction-scoped advisory lock taken as the first
// statement of a batch transaction. These tests pin that shape: a plain
// accountAdmin.create() would pass none of them.

const authMock = { requireAuth: vi.fn() }

const prismaMock = {
  accountAdmin: {
    count: vi.fn(async () => 0),
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
  },
  user: { findUnique: vi.fn(async () => ({ id: 'invitee' })) },
  $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  $executeRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  $transaction: vi.fn(),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  getUserTier: vi.fn(async () => ({ tier: 'CLUB', expiresAt: null, proCredits: 0 })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireAuth.mockResolvedValue({ id: 'owner', email: 'owner@example.com' })
  prismaMock.accountAdmin.count.mockResolvedValue(0)
  prismaMock.accountAdmin.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue({ id: 'invitee' })
  prismaMock.$transaction.mockResolvedValue([[{ locked: true }], 1])
})

/** Rebuild the SQL text from a tagged-template call's arguments. */
function sqlOf(callArgs: unknown[]): string {
  return (callArgs[0] as TemplateStringsArray).join(' ? ')
}

describe('inviteCoAdmin — seat limit is enforced by the write itself', () => {
  it('never uses an unconditional create', async () => {
    const { inviteCoAdmin } = await import('./actions')
    await inviteCoAdmin('friend@example.com')
    expect(prismaMock.accountAdmin.create).not.toHaveBeenCalled()
  })

  it('takes the advisory lock as the first statement of a batch transaction', async () => {
    const { inviteCoAdmin } = await import('./actions')
    expect(await inviteCoAdmin('friend@example.com')).toEqual({ ok: true })

    const [statements] = prismaMock.$transaction.mock.calls[0]
    // An array, not a callback: no application code inside BEGIN/COMMIT.
    expect(Array.isArray(statements)).toBe(true)
    expect(statements).toHaveLength(2)

    const lockSql = sqlOf(prismaMock.$queryRaw.mock.calls[0])
    expect(lockSql).toMatch(/pg_try_advisory_xact_lock/)
    // Non-blocking only — a waiting lock would pin a pooled connection.
    expect(lockSql).not.toMatch(/pg_advisory_xact_lock\s*\(/)
    // Keyed to the account, not to any row an ordinary feature writes.
    expect(lockSql).not.toMatch(/"User"/)
    expect(prismaMock.$queryRaw.mock.calls[0][1]).toBe('owner')
  })

  it('re-counts the seats in the INSERT and supplies an explicit id', async () => {
    const { inviteCoAdmin } = await import('./actions')
    await inviteCoAdmin('friend@example.com')

    const insertSql = sqlOf(prismaMock.$executeRaw.mock.calls[0])
    expect(insertSql).toMatch(/INSERT INTO "AccountAdmin"/)
    expect(insertSql).toMatch(/"id"/)
    expect(insertSql).toMatch(/count\(\*\)[\s\S]*\+ 1\s*<|\+ 1\s*<[\s\S]*count\(\*\)/)
    expect(insertSql).toMatch(/pg_try_advisory_xact_lock/)

    // id, ownerUserId, adminUserId, invitedEmail, and the seat limit.
    const values = prismaMock.$executeRaw.mock.calls[0].slice(1)
    expect(values[0]).toEqual(expect.any(String))
    expect(values[0]).not.toBe('')
    expect(values).toContain('owner')
    expect(values).toContain('invitee')
    expect(values).toContain('friend@example.com')
    expect(values).toContain(2) // CLUB: maxAdminSeats
  })

  it('refuses when the conditional insert wrote nothing', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ locked: true }], 0])
    const { inviteCoAdmin } = await import('./actions')

    expect(await inviteCoAdmin('friend@example.com')).toEqual({
      error: expect.stringMatching(/used all 2 admin seats/),
    })
  })

  it('tells the caller to retry when another invitation held the lock', async () => {
    prismaMock.$transaction.mockResolvedValue([[{ locked: false }], 0])
    const { inviteCoAdmin } = await import('./actions')

    expect(await inviteCoAdmin('friend@example.com')).toEqual({
      error: expect.stringMatching(/try again/i),
    })
  })

  it('still refuses on the pre-flight count without touching the database', async () => {
    prismaMock.accountAdmin.count.mockResolvedValue(1) // CLUB seat already used
    const { inviteCoAdmin } = await import('./actions')

    expect(await inviteCoAdmin('friend@example.com')).toEqual({
      error: expect.stringMatching(/used all 2 admin seats/),
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

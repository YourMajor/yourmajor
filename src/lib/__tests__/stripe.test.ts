import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockPurchase = {
  id: string
  userId: string
  type: string
  status: string
  tournamentId: string | null
  consumedAt: Date | null
  createdAt: Date
}

const purchaseStore: MockPurchase[] = []

// An undefined key is "no filter", same as Prisma — so a dropped predicate
// widens the match here exactly as it would against the database.
function matches(p: MockPurchase, where: Partial<MockPurchase>) {
  return (Object.keys(where) as (keyof MockPurchase)[]).every(
    (k) => where[k] === undefined || p[k] === where[k],
  )
}

const prismaMock = {
  purchase: {
    findFirst: vi.fn(async ({ where }: { where: Partial<MockPurchase> }) => {
      return (
        purchaseStore
          .filter((p) => matches(p, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null
      )
    }),
    count: vi.fn(async ({ where }: { where: Partial<MockPurchase> }) => {
      return purchaseStore.filter((p) => matches(p, where)).length
    }),
    // Atomic check-and-set: the filter and the write happen with no await in between,
    // which is what the real single-statement UPDATE ... WHERE gives us.
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; tournamentId: string | null; consumedAt: Date | null }
        data: { tournamentId: string; consumedAt: Date }
      }) => {
        const rows = purchaseStore.filter(
          (p) =>
            p.id === where.id &&
            p.tournamentId === where.tournamentId &&
            p.consumedAt === where.consumedAt,
        )
        for (const row of rows) {
          row.tournamentId = data.tournamentId
          row.consumedAt = data.consumedAt
        }
        return { count: rows.length }
      },
    ),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

function seedCredit(id: string): MockPurchase {
  const row: MockPurchase = {
    id,
    userId: 'user_1',
    type: 'EVENT',
    status: 'ACTIVE',
    tournamentId: null,
    consumedAt: null,
    createdAt: new Date('2026-01-01'),
  }
  purchaseStore.push(row)
  return row
}

beforeEach(() => {
  purchaseStore.length = 0
  vi.clearAllMocks()
})

describe('consumeProCredit — concurrent consumption', () => {
  it('two concurrent calls against one credit yield exactly one true', async () => {
    const { consumeProCredit } = await import('@/lib/stripe')
    seedCredit('pur_1')

    const results = await Promise.all([
      consumeProCredit('user_1', 'tourn_a'),
      consumeProCredit('user_1', 'tourn_b'),
    ])

    // Both calls read the same unused row via findFirst before either wrote.
    expect(prismaMock.purchase.findFirst).toHaveBeenCalledTimes(2)
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(purchaseStore).toHaveLength(1)
    expect(['tourn_a', 'tourn_b']).toContain(purchaseStore[0].tournamentId)
  })

  it('returns false when the credit was consumed between findFirst and updateMany', async () => {
    const { consumeProCredit } = await import('@/lib/stripe')
    const row = seedCredit('pur_1')

    // findFirst hands back a stale snapshot; the row is already attached by the
    // time the write runs, so updateMany matches nothing.
    prismaMock.purchase.findFirst.mockImplementationOnce(async () => {
      row.tournamentId = 'tourn_other'
      return { ...row, tournamentId: null }
    })

    expect(await consumeProCredit('user_1', 'tourn_a')).toBe(false)
    expect(prismaMock.purchase.updateMany).toHaveBeenCalledTimes(1)
    expect(row.tournamentId).toBe('tourn_other')
  })

  it('returns false when the user has no unused credits', async () => {
    const { consumeProCredit } = await import('@/lib/stripe')

    expect(await consumeProCredit('user_1', 'tourn_a')).toBe(false)
    expect(prismaMock.purchase.updateMany).not.toHaveBeenCalled()
  })

  it('consumes the oldest credit and leaves the newer one untouched', async () => {
    const { consumeProCredit } = await import('@/lib/stripe')
    const older = seedCredit('pur_1')
    const newer = seedCredit('pur_2')
    newer.createdAt = new Date('2026-02-01')

    expect(await consumeProCredit('user_1', 'tourn_a')).toBe(true)
    expect(older.tournamentId).toBe('tourn_a')
    expect(newer.tournamentId).toBeNull()
  })
})

describe('Pro credit consumption survives tournament deletion', () => {
  it('a spent credit is not refunded when the tournament FK is nulled', async () => {
    const { consumeProCredit, getUnusedProCredits } = await import('@/lib/stripe')
    const row = seedCredit('pur_1')

    expect(await getUnusedProCredits('user_1')).toBe(1)
    expect(await consumeProCredit('user_1', 'tourn_a')).toBe(true)
    expect(row.consumedAt).toBeInstanceOf(Date)
    expect(await getUnusedProCredits('user_1')).toBe(0)

    // Deleting the tournament fires ON DELETE SET NULL on Purchase.tournamentId.
    row.tournamentId = null

    expect(await getUnusedProCredits('user_1')).toBe(0)
    expect(await consumeProCredit('user_1', 'tourn_b')).toBe(false)
  })

  it('an unconsumed credit is still spendable', async () => {
    const { consumeProCredit, getUnusedProCredits } = await import('@/lib/stripe')
    seedCredit('pur_1')

    expect(await getUnusedProCredits('user_1')).toBe(1)
    expect(await consumeProCredit('user_1', 'tourn_a')).toBe(true)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockPurchaseRow = {
  id: string
  stripeSessionId: string
  tournamentId?: string
  consumedAt?: Date
}
const purchaseStore: MockPurchaseRow[] = []

const prismaMock = {
  purchase: {
    findUnique: vi.fn(async ({ where }: { where: { stripeSessionId: string } }) => {
      return purchaseStore.find((p) => p.stripeSessionId === where.stripeSessionId) ?? null
    }),
    create: vi.fn(async ({ data }: { data: Omit<MockPurchaseRow, 'id'> }) => {
      if (purchaseStore.some((p) => p.stripeSessionId === data.stripeSessionId)) {
        throw new Error('Unique constraint violation on stripeSessionId')
      }
      const row = { ...data, id: `pur_${purchaseStore.length + 1}` }
      purchaseStore.push(row)
      return row
    }),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}

// A Pro purchase bought against a specific tournament (the upgrade interstitial).
const baseMetadata: Record<string, string> = {
  userId: 'user_1',
  tournamentId: 'tourn_1',
  purchaseType: 'EVENT',
}

const eventFixture = {
  type: 'checkout.session.completed' as const,
  data: {
    object: {
      id: 'cs_test_abc123',
      amount_total: 2900,
      subscription: null,
      metadata: { ...baseMetadata },
    },
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('stripe', () => {
  class StripeSDK {
    webhooks = {
      constructEvent: () => eventFixture,
    }
  }
  return { default: StripeSDK }
})

beforeEach(() => {
  purchaseStore.length = 0
  eventFixture.data.object.metadata = { ...baseMetadata }
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
})

function fakeRequest(body: string) {
  return {
    text: async () => body,
    headers: new Headers({ 'stripe-signature': 't=1,v1=dummy' }),
  } as unknown as Request
}

describe('POST /api/webhooks/stripe — idempotency', () => {
  it('creates a Purchase row on first delivery', async () => {
    const { POST } = await import('./route')
    const res = await POST(fakeRequest('{}') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ received: true })
    expect(purchaseStore).toHaveLength(1)
    expect(purchaseStore[0].stripeSessionId).toBe('cs_test_abc123')
  })

  it('ack-only on duplicate delivery — no second row, no throw', async () => {
    const { POST } = await import('./route')
    await POST(fakeRequest('{}') as never)
    const res = await POST(fakeRequest('{}') as never)

    expect(res.status).toBe(200)
    expect(purchaseStore).toHaveLength(1)
    // prisma.purchase.create should NOT be called on the duplicate
    expect(prismaMock.purchase.create).toHaveBeenCalledTimes(1)
    // but findUnique is called both times (that's the dedup gate)
    expect(prismaMock.purchase.findUnique).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/webhooks/stripe — EVENT purchase consumption', () => {
  it('stamps consumedAt when the purchase arrives already attached to a tournament', async () => {
    const { POST } = await import('./route')
    await POST(fakeRequest('{}') as never)

    // Bought against tourn_1, so it is spent on arrival. Without consumedAt,
    // deleting tourn_1 would null the FK and refund the credit.
    expect(purchaseStore[0].tournamentId).toBe('tourn_1')
    expect(purchaseStore[0].consumedAt).toBeInstanceOf(Date)
  })

  it('leaves consumedAt null for an unattached credit purchase', async () => {
    delete eventFixture.data.object.metadata.tournamentId
    const { POST } = await import('./route')
    await POST(fakeRequest('{}') as never)

    // A credit bought from the pricing page is unused and must stay spendable.
    expect(purchaseStore[0].tournamentId).toBeUndefined()
    expect(purchaseStore[0].consumedAt).toBeUndefined()
  })
})

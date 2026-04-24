import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockPurchaseRow = { id: string; stripeSessionId: string }
const purchaseStore: MockPurchaseRow[] = []

const prismaMock = {
  purchase: {
    findUnique: vi.fn(async ({ where }: { where: { stripeSessionId: string } }) => {
      return purchaseStore.find((p) => p.stripeSessionId === where.stripeSessionId) ?? null
    }),
    create: vi.fn(async ({ data }: { data: { stripeSessionId: string } }) => {
      if (purchaseStore.some((p) => p.stripeSessionId === data.stripeSessionId)) {
        throw new Error('Unique constraint violation on stripeSessionId')
      }
      const row = { id: `pur_${purchaseStore.length + 1}`, stripeSessionId: data.stripeSessionId }
      purchaseStore.push(row)
      return row
    }),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}

const eventFixture = {
  type: 'checkout.session.completed' as const,
  data: {
    object: {
      id: 'cs_test_abc123',
      amount_total: 2900,
      subscription: null,
      metadata: {
        userId: 'user_1',
        tournamentId: 'tourn_1',
        purchaseType: 'EVENT',
      },
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

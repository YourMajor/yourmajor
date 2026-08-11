import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory stand-in for the RateLimit table, modelling the two behaviours the
// helper depends on: atomic increment, and deleteMany by expiry.
type Row = { key: string; count: number; expiresAt: Date }
const rows = new Map<string, Row>()

const prismaMock = {
  rateLimit: {
    deleteMany: vi.fn(async ({ where }: { where: { key?: string; expiresAt: { lte: Date } } }) => {
      let count = 0
      for (const [k, row] of rows) {
        if (where.key !== undefined && k !== where.key) continue
        if (row.expiresAt.getTime() <= where.expiresAt.lte.getTime()) {
          rows.delete(k)
          count++
        }
      }
      return { count }
    }),
    upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: Row }) => {
      const existing = rows.get(where.key)
      if (existing) {
        existing.count += 1
        return existing
      }
      const row = { ...create }
      rows.set(where.key, row)
      return row
    }),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { checkRateLimit, clientIp, LIMITS } = await import('@/lib/rate-limit')

beforeEach(() => {
  rows.clear()
  vi.clearAllMocks()
  vi.spyOn(Math, 'random').mockReturnValue(0.5) // above the 1% sweep threshold
})

const opts = { limit: 3, windowSeconds: 60 }

describe('checkRateLimit', () => {
  it('allows up to the limit then blocks', async () => {
    const results = []
    for (let i = 0; i < 5; i++) results.push((await checkRateLimit('k', opts)).ok)
    expect(results).toEqual([true, true, true, false, false])
  })

  it('reports remaining budget', async () => {
    expect((await checkRateLimit('k', opts)).remaining).toBe(2)
    expect((await checkRateLimit('k', opts)).remaining).toBe(1)
    expect((await checkRateLimit('k', opts)).remaining).toBe(0)
    expect((await checkRateLimit('k', opts)).remaining).toBe(0)
  })

  it('keys are independent', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit('a', opts)
    expect((await checkRateLimit('a', opts)).ok).toBe(false)
    expect((await checkRateLimit('b', opts)).ok).toBe(true)
  })

  it('starts a fresh window once the old one expires', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit('k', opts)
    expect((await checkRateLimit('k', opts)).ok).toBe(false)

    rows.get('k')!.expiresAt = new Date(Date.now() - 1000)

    const after = await checkRateLimit('k', opts)
    expect(after.ok).toBe(true)
    expect(after.remaining).toBe(2)
  })

  it('returns a positive retryAfter while blocked', async () => {
    for (let i = 0; i < 4; i++) await checkRateLimit('k', opts)
    const blocked = await checkRateLimit('k', opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.retryAfter).toBeLessThanOrEqual(60)
  })

  // A limiter that 500s when the database blips is a worse outage than the
  // abuse it prevents, so the helper deliberately fails open.
  it('fails open if the store throws', async () => {
    prismaMock.rateLimit.deleteMany.mockRejectedValueOnce(new Error('db down'))
    const result = await checkRateLimit('k', opts)
    expect(result.ok).toBe(true)
  })

  it('every configured limit is a sane positive window', () => {
    for (const [name, cfg] of Object.entries(LIMITS)) {
      expect(cfg.limit, name).toBeGreaterThan(0)
      expect(cfg.windowSeconds, name).toBeGreaterThan(0)
    }
  })
})

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(clientIp(h)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  // Unknown callers must share one bucket. Returning something unique per
  // request would hand every anonymous caller their own unlimited budget.
  it('falls back to a single shared bucket, not a unique value', () => {
    expect(clientIp(new Headers())).toBe('unknown')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

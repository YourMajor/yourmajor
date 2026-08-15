import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PricingTier } from '@/generated/prisma/client'

// isTournamentAdmin used to grant co-admin rights on the mere existence of an
// AccountAdmin row. Nothing prunes those rows when a plan is cancelled — the
// Stripe webhook only flips Purchase.status — so a cancelled Club account kept
// handing out admin on every tournament it administered. The read path now
// honours only the first `maxAdminSeats - 1` rows by createdAt for the owner's
// *current* tier. Rows are never deleted, so restoring the plan restores them.

type AccountAdminRow = {
  id: string
  ownerUserId: string
  adminUserId: string
  createdAt: Date
}

let rows: AccountAdminRow[] = []
let ownerTier: PricingTier = 'CLUB'

const prismaMock = {
  user: { findUnique: vi.fn(async () => ({ role: 'PLAYER' })) },
  tournamentPlayer: {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => [{ userId: 'owner' }]),
  },
  accountAdmin: {
    // Minimal in-memory stand-in that honours where/orderBy/take, so the
    // ordering and the cap are actually exercised rather than asserted on a
    // canned reply.
    findMany: vi.fn(
      async (args: {
        where: { ownerUserId?: string | { in: string[] }; adminUserId?: string }
        orderBy?: unknown
        take?: number
      }) => {
        const { ownerUserId, adminUserId } = args.where
        let out = rows.filter((r) => {
          if (adminUserId && r.adminUserId !== adminUserId) return false
          if (typeof ownerUserId === 'string' && r.ownerUserId !== ownerUserId) return false
          if (ownerUserId && typeof ownerUserId === 'object' && !ownerUserId.in.includes(r.ownerUserId)) return false
          return true
        })
        if (args.orderBy) {
          out = [...out].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
          )
        }
        return args.take ? out.slice(0, args.take) : out
      },
    ),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  getUserTier: vi.fn(async () => ({ tier: ownerTier, expiresAt: null, proCredits: 0 })),
}))

function seat(id: string, adminUserId: string, minutes: number, ownerUserId = 'owner'): AccountAdminRow {
  return { id, ownerUserId, adminUserId, createdAt: new Date(2026, 0, 1, 0, minutes) }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tournamentPlayer.findMany.mockResolvedValue([{ userId: 'owner' }])
  ownerTier = 'CLUB'
  rows = []
})

describe('isTournamentAdmin — co-admin seats are capped at read time', () => {
  it('honours a seat that fits inside the plan', async () => {
    rows = [seat('a1', 'coadmin_1', 0)]
    const { isTournamentAdmin } = await import('../auth')
    expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(true)
  })

  it('does not honour rows beyond the cap', async () => {
    // CLUB is 2 seats: the owner plus exactly one AccountAdmin row.
    rows = [seat('a1', 'coadmin_1', 0), seat('a2', 'coadmin_2', 1), seat('a3', 'coadmin_3', 2)]
    const { isTournamentAdmin } = await import('../auth')

    expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(true)
    expect(await isTournamentAdmin('coadmin_2', 't1')).toBe(false)
    expect(await isTournamentAdmin('coadmin_3', 't1')).toBe(false)
  })

  it('ranks seats by createdAt ascending, not insertion order', async () => {
    // Oldest row last in the array — the query must sort, not take as given.
    rows = [seat('a2', 'coadmin_2', 30), seat('a1', 'coadmin_1', 5)]
    const { isTournamentAdmin } = await import('../auth')

    expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(true)
    expect(await isTournamentAdmin('coadmin_2', 't1')).toBe(false)

    const findManyArgs = prismaMock.accountAdmin.findMany.mock.calls.map(([a]) => a)
    expect(findManyArgs.some((a) => JSON.stringify(a.orderBy) === JSON.stringify([{ createdAt: 'asc' }, { id: 'asc' }]))).toBe(true)
  })

  it('honours zero rows after a downgrade to a 1-seat plan', async () => {
    // The rows survive the downgrade; they simply stop granting anything.
    rows = [seat('a1', 'coadmin_1', 0), seat('a2', 'coadmin_2', 1)]
    const { isTournamentAdmin } = await import('../auth')

    for (const tier of ['FREE', 'PRO'] as const) {
      ownerTier = tier
      expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(false)
      expect(await isTournamentAdmin('coadmin_2', 't1')).toBe(false)
    }
    expect(rows).toHaveLength(2)
  })

  it('restores dormant seats when the tier goes back up', async () => {
    rows = [seat('a1', 'coadmin_1', 0), seat('a2', 'coadmin_2', 1), seat('a3', 'coadmin_3', 2)]
    const { isTournamentAdmin } = await import('../auth')

    ownerTier = 'FREE'
    expect(await isTournamentAdmin('coadmin_3', 't1')).toBe(false)

    ownerTier = 'LEAGUE' // 5 seats: owner + 4 rows
    expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(true)
    expect(await isTournamentAdmin('coadmin_2', 't1')).toBe(true)
    expect(await isTournamentAdmin('coadmin_3', 't1')).toBe(true)
  })

  it("caps per owner, using that owner's own tier", async () => {
    prismaMock.tournamentPlayer.findMany.mockResolvedValue([{ userId: 'owner' }, { userId: 'owner_2' }])
    // Dormant on `owner` (second seat on a 2-seat plan) but the first seat on
    // `owner_2`, who also administers this tournament.
    rows = [seat('a1', 'someone_else', 0), seat('a2', 'coadmin_1', 1), seat('b1', 'coadmin_1', 2, 'owner_2')]
    const { isTournamentAdmin } = await import('../auth')

    expect(await isTournamentAdmin('coadmin_1', 't1')).toBe(true)
  })

  it('leaves the non-co-admin path at a single accountAdmin query', async () => {
    rows = [seat('a1', 'coadmin_1', 0)]
    const { isTournamentAdmin } = await import('../auth')

    expect(await isTournamentAdmin('stranger', 't1')).toBe(false)
    expect(prismaMock.accountAdmin.findMany).toHaveBeenCalledTimes(1)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TIER_LIMITS } from '@/lib/tiers'
// '@/lib/rate-limit' is imported lazily inside the tests — it pulls in the
// mocked prisma module, which can't be touched at import time.

// Regression tests for the roster-import fan-out (U04). importRosterCsv bills a
// Resend email and/or a Twilio SMS per CSV row, and the row array is
// client-supplied — an uncapped, unlimited call turned one server action into
// unbounded outbound mail. Both gates must refuse before anything is read,
// written or sent.

const authMock = {
  requireTournamentAdmin: vi.fn(async () => ({ id: 'admin_1' })),
  getUser: vi.fn(async () => ({ id: 'admin_1' })),
}

const txMock = {
  user: { createMany: vi.fn(async () => ({ count: 0 })) },
  playerProfile: {
    createMany: vi.fn(async () => ({ count: 0 })),
    update: vi.fn(async () => ({})),
  },
  leagueRosterMember: {
    createMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  invitation: { createMany: vi.fn(async () => ({ count: 0 })) },
}

const prismaMock = {
  // The import is rate-limited; give the limiter a working store so these tests
  // exercise the real limiter rather than its fail-open fallback.
  rateLimit: {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async () => ({ count: 1, expiresAt: new Date(Date.now() + 3_600_000) })),
  },
  tournament: { findUnique: vi.fn(async () => ({ name: 'Ryder Cup', slug: 'ryder' })) },
  leagueRoster: { findUnique: vi.fn(async () => ({ id: 'roster_1', members: [] })) },
  user: { findMany: vi.fn(async () => []) },
  playerProfile: { findMany: vi.fn(async () => []) },
  invitation: { findMany: vi.fn(async () => [] as unknown[]) },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/league-chain', () => ({ getRootTournamentId: vi.fn(async () => 'root_1') }))
vi.mock('@/lib/invite-sender', () => ({
  sendInvitations: vi.fn(async () => {}),
  // U02 moved invitation tokens off cuid's Math.random block and onto this
  // helper, which roster-actions now calls per invite; stub it so the fan-out
  // bounds under test don't depend on the generator.
  invitationToken: vi.fn(() => 'test-invitation-token'),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const CAP = TIER_LIMITS.LEAGUE.maxPlayers

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Player ${i}`, email: `p${i}@example.com` }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importRosterCsv — fan-out bounds', () => {
  it('refuses a CSV over the row cap without reading, writing or sending', async () => {
    const { importRosterCsv } = await import('@/lib/roster-actions')
    const { sendInvitations } = await import('@/lib/invite-sender')

    await expect(importRosterCsv('t1', rows(CAP + 1))).rejects.toThrow(/too many rows/i)

    expect(prismaMock.leagueRoster.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(sendInvitations).not.toHaveBeenCalled()
    // The cap is checked first, so an oversized CSV doesn't burn a limiter slot.
    expect(prismaMock.rateLimit.upsert).not.toHaveBeenCalled()
  })

  it('refuses once the caller is over the per-caller import limit, writing nothing', async () => {
    const { LIMITS } = await import('@/lib/rate-limit')
    prismaMock.rateLimit.upsert.mockResolvedValueOnce({
      count: LIMITS.rosterImport.limit + 1,
      expiresAt: new Date(Date.now() + 3_600_000),
    })

    const { importRosterCsv } = await import('@/lib/roster-actions')
    const { sendInvitations } = await import('@/lib/invite-sender')

    await expect(importRosterCsv('t1', rows(2))).rejects.toThrow(/too many roster imports/i)

    expect(prismaMock.leagueRoster.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(sendInvitations).not.toHaveBeenCalled()
  })

  it('still imports and invites a full roster at the cap, keyed on the caller', async () => {
    prismaMock.invitation.findMany
      .mockResolvedValueOnce([]) // existing invites
      .mockResolvedValueOnce([{ email: 'p0@example.com', phone: null, token: 'tok_0' }])

    const { importRosterCsv } = await import('@/lib/roster-actions')
    const { sendInvitations } = await import('@/lib/invite-sender')

    const result = await importRosterCsv('t1', rows(CAP))

    expect(result.added).toBe(CAP)
    expect(result.invitedEmails).toBe(CAP)
    expect(sendInvitations).toHaveBeenCalledTimes(1)
    // Keyed on the caller — not the IP, and not the tournament.
    expect(prismaMock.rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'roster-import:admin_1' } }),
    )
  })
})

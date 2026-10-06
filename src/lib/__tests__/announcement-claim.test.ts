import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the scheduled-announcement double-send.
//
// dispatchPendingAnnouncement read a PENDING row, checked the status, then
// dispatched. The cron runs every 5 minutes and its own comment notes a large
// backlog can overrun that, so two invocations both passed the check and both
// emailed/SMS-ed (and billed) every recipient. The claim is now a conditional
// write, and these tests drive it through a fake that enforces the predicate.

type Row = { id: string; status: string; dispatchStartedAt: Date | null }

const rows = new Map<string, Row>()

const prismaMock = vi.hoisted(() => ({
  leagueAnnouncement: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  leagueAnnouncementDelivery: {
    createMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  leagueRoster: {
    findUnique: vi.fn(async () => ({
      members: [
        {
          status: 'ACTIVE',
          user: { id: 'u1', name: 'A', email: 'a@b.c', phone: '+15550001', smsNotifications: true },
        },
        {
          status: 'ACTIVE',
          user: { id: 'u2', name: 'B', email: 'b@b.c', phone: '+15550002', smsNotifications: true },
        },
      ],
    })),
  },
}))
const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: string) => s }))
const smsMock = vi.hoisted(() => ({ sendSMS: vi.fn(async () => {}) }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email', () => emailMock)
vi.mock('@/lib/sms', () => smsMock)
vi.mock('@/lib/league-events', () => ({ getLeagueRootId: vi.fn(async (id: string) => id) }))

import { dispatchPendingAnnouncement } from '@/lib/league-announcements'

const STALE_MS = 15 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  rows.clear()
  rows.set('a1', { id: 'a1', status: 'PENDING', dispatchStartedAt: null })

  // Honour the same predicate Postgres would: the claim only lands when the
  // row is still PENDING and unclaimed (or its claim has gone stale).
  prismaMock.leagueAnnouncement.updateMany.mockImplementation(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = rows.get(where.id as string)
      if (!row) return { count: 0 }
      if (where.status && row.status !== where.status) return { count: 0 }
      if (where.OR) {
        const staleBefore = Date.now() - STALE_MS
        const unclaimed = row.dispatchStartedAt === null
        const stale = row.dispatchStartedAt !== null && row.dispatchStartedAt.getTime() < staleBefore
        if (!unclaimed && !stale) return { count: 0 }
      }
      Object.assign(row, data)
      return { count: 1 }
    },
  )

  prismaMock.leagueAnnouncement.findUnique.mockImplementation(async () => ({
    id: 'a1',
    subject: 'Tee times',
    body: 'See you Saturday.',
    channels: ['EMAIL', 'SMS'],
    audienceFilter: { type: 'ALL_ACTIVE' },
    rootTournamentId: 'tourn_1',
  }))
  prismaMock.leagueAnnouncement.update.mockImplementation(async () => ({}))
})

describe('dispatchPendingAnnouncement — dispatch claim', () => {
  it('claims the row before reading anything it will act on', async () => {
    await dispatchPendingAnnouncement('a1')

    const claim = prismaMock.leagueAnnouncement.updateMany.mock.calls[0][0]
    expect(claim.where).toMatchObject({ id: 'a1', status: 'PENDING' })
    expect(claim.data.dispatchStartedAt).toBeInstanceOf(Date)
    expect(rows.get('a1')!.dispatchStartedAt).toBeInstanceOf(Date)
  })

  it('refuses a second dispatch of a row already claimed', async () => {
    rows.set('a1', { id: 'a1', status: 'PENDING', dispatchStartedAt: new Date() })

    const result = await dispatchPendingAnnouncement('a1')

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/already being dispatched/i) })
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
    expect(smsMock.sendSMS).not.toHaveBeenCalled()
  })

  it('refuses a row that is no longer PENDING', async () => {
    rows.set('a1', { id: 'a1', status: 'CANCELED', dispatchStartedAt: null })

    const result = await dispatchPendingAnnouncement('a1')

    expect(result.ok).toBe(false)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })

  it('reclaims a row whose claim has gone stale', async () => {
    // A run that died mid-dispatch must not strand the row forever.
    rows.set('a1', { id: 'a1', status: 'PENDING', dispatchStartedAt: new Date(Date.now() - STALE_MS - 1000) })

    const result = await dispatchPendingAnnouncement('a1')

    expect(result.ok).toBe(true)
  })

  it('does not reclaim a row claimed just inside the window', async () => {
    rows.set('a1', { id: 'a1', status: 'PENDING', dispatchStartedAt: new Date(Date.now() - 60_000) })

    const result = await dispatchPendingAnnouncement('a1')

    expect(result.ok).toBe(false)
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })
})

describe('dispatchPendingAnnouncement — delivery bookkeeping', () => {
  it('stamps outcomes once per channel, not once per recipient', async () => {
    // 2 recipients x 2 channels used to be 4 awaited round trips; a 200-member
    // league on both channels was ~400.
    const result = await dispatchPendingAnnouncement('a1')

    expect(result).toMatchObject({ ok: true, deliveryCount: 4, successCount: 4 })
    expect(prismaMock.leagueAnnouncementDelivery.updateMany).toHaveBeenCalledTimes(2)

    for (const [args] of prismaMock.leagueAnnouncementDelivery.updateMany.mock.calls) {
      expect(args.where.userId).toEqual({ in: ['u1', 'u2'] })
      // Explicit null, so a retry clears a previous attempt's failure reason
      // instead of leaving it on a row now marked SENT.
      expect(args.data).toMatchObject({ status: 'SENT', failureReason: null })
    }
  })
})

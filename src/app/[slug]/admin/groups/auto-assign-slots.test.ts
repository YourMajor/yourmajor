import { describe, it, expect, beforeEach, vi } from 'vitest'

// Covers the two things autoAssignGroups now promises beyond the assignment
// itself (the algorithms are tested in src/lib/__tests__/group-assignment.test.ts):
//
// 1. Slot carry-over. Generating wipes and recreates every group row, so an
//    admin who had set tee times lost them just for reshuffling the names
//    underneath. name / teeTime / startingHole now carry across by slot index.
//    lastNotified* must NOT carry — members come back with notifiedAt null, so
//    everyone has to re-count as "affected" or the next notify silently skips
//    players whose group changed.
// 2. Staggered createdAt. createMany issues one INSERT, so every row used to
//    share the same transaction-constant now(). The page orders groups by
//    createdAt, and with every value tied that falls back to heap order —
//    which visibly reshuffled the list the moment one tee time was edited.

const prismaMock = {
  tournament: { findUnique: vi.fn() },
  tournamentPlayer: { findMany: vi.fn() },
  tournamentTeam: { findMany: vi.fn() },
  tournamentGroup: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  tournamentGroupMember: { createMany: vi.fn() },
  $transaction: vi.fn(async () => []),
}

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), escapeHtml: (s: string) => s }))
vi.mock('@/lib/sms', () => ({ sendSMS: vi.fn() }))
vi.mock('@/lib/app-url', () => ({ getAppUrl: () => 'https://example.test' }))
vi.mock('@/lib/league-events', () => ({
  getRecentPartners: vi.fn(async () => ({})),
  getLeagueRootId: vi.fn(async () => null),
}))
vi.mock('@/lib/handicap-snapshot', () => ({ snapshotHandicapOnActivation: vi.fn() }))
vi.mock('@/lib/league-announcements', () => ({ logOutboundCommunication: vi.fn() }))

const TOURNAMENT_ID = 'tourn_1'

// Imported inside the test, not at the top: static imports hoist above the
// mock consts and the action would load against an uninitialised prisma mock.
async function generate(mode: 'RANDOM' | 'BALANCED' | 'TIGHT', groupSize: number) {
  const { autoAssignGroups } = await import('./actions')
  return autoAssignGroups(TOURNAMENT_ID, mode, groupSize)
}

/** TIGHT mode flights by handicap, so an 8-player roster is fully deterministic. */
function roster(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `tp_${i}`,
    userId: `user_${i}`,
    handicap: i,
    user: { name: `Player ${i}`, email: `p${i}@example.test` },
    teamMembership: null,
  }))
}

/** The `data` array handed to tournamentGroup.createMany inside the transaction. */
function writtenGroupRows() {
  const call = prismaMock.tournamentGroup.createMany.mock.calls.at(-1)
  return call![0].data as Array<{
    id: string
    tournamentId: string
    name: string
    teeTime: Date | null
    startingHole: number | null
    createdAt: Date
  }>
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'admin_1', email: 'admin@example.test' })
  authMock.isTournamentAdmin.mockResolvedValue(true)
  prismaMock.tournament.findUnique.mockResolvedValue({
    id: TOURNAMENT_ID,
    slug: 'the-open',
    isLeague: false,
    parentTournamentId: null,
    teamsEnabled: false,
  })
  prismaMock.tournamentPlayer.findMany.mockResolvedValue(roster(8))
  prismaMock.tournamentGroup.findMany.mockResolvedValue([])
  prismaMock.$transaction.mockResolvedValue([])
})

describe('autoAssignGroups — group rows', () => {
  it('names groups and leaves the schedule empty on a first generate', async () => {
    const result = await generate('TIGHT', 4)

    expect(result).toEqual({ ok: true, groupCount: 2, conflicts: 0 })
    const rows = writtenGroupRows()
    expect(rows.map((r) => r.name)).toEqual(['Group 1', 'Group 2'])
    expect(rows.every((r) => r.teeTime === null && r.startingHole === null)).toBe(true)
  })

  it('gives every group a distinct, ascending createdAt', async () => {
    await generate('TIGHT', 4)

    const stamps = writtenGroupRows().map((r) => r.createdAt.getTime())
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b))
    expect(new Set(stamps).size).toBe(stamps.length)
  })

  it('carries name, tee time and starting hole across a regenerate by slot', async () => {
    const teeTime = new Date('2026-10-10T13:40:00.000Z')
    prismaMock.tournamentGroup.findMany.mockResolvedValue([
      { name: '8:00 tee', teeTime, startingHole: 10 },
      { name: 'Group 2', teeTime: null, startingHole: null },
    ])

    await generate('TIGHT', 4)

    const rows = writtenGroupRows()
    expect(rows[0].name).toBe('8:00 tee')
    expect(rows[0].teeTime).toEqual(teeTime)
    expect(rows[0].startingHole).toBe(10)
    expect(rows[1].teeTime).toBeNull()
  })

  it('never carries the lastNotified snapshots, so everyone re-counts as affected', async () => {
    prismaMock.tournamentGroup.findMany.mockResolvedValue([
      {
        name: 'Group 1',
        teeTime: new Date('2026-10-10T13:40:00.000Z'),
        startingHole: 1,
        lastNotifiedTeeTime: new Date('2026-10-10T13:40:00.000Z'),
        lastNotifiedStartHole: 1,
      },
    ])

    await generate('TIGHT', 4)

    for (const row of writtenGroupRows()) {
      expect(row).not.toHaveProperty('lastNotifiedTeeTime')
      expect(row).not.toHaveProperty('lastNotifiedStartHole')
    }
  })

  it('falls back to defaults for slots the previous generate did not have', async () => {
    prismaMock.tournamentGroup.findMany.mockResolvedValue([
      { name: 'Early', teeTime: new Date('2026-10-10T13:40:00.000Z'), startingHole: 1 },
    ])

    // Threesomes over 8 players needs 3 groups, one more than exists.
    await generate('TIGHT', 3)

    const rows = writtenGroupRows()
    expect(rows).toHaveLength(3)
    expect(rows[0].name).toBe('Early')
    expect(rows.slice(1).map((r) => r.name)).toEqual(['Group 2', 'Group 3'])
    expect(rows.slice(1).every((r) => r.teeTime === null && r.startingHole === null)).toBe(true)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression tests for the league-event credit charge.
// scheduleLeagueEvent used to create the event, clone its rounds, register the
// roster and write its powerup rows, and only *then* call consumeProCredit —
// discarding the boolean it returns. A user with no credits got a paid-tier
// event for free. The create and the charge now share one transaction, so a
// charge that cannot be made leaves no event behind.

type TemplateRound = { roundNumber: number; courseId: string; teeMode: string }

function makeTemplate(rounds: number, powerupsEnabled = false) {
  return {
    id: 't_root',
    slug: 'ryder',
    name: 'Ryder Cup',
    description: null,
    logo: null,
    headerImage: null,
    primaryColor: '#006747',
    accentColor: '#C9A84C',
    tournamentType: 'INVITE',
    isOpenRegistration: false,
    handicapSystem: 'NONE',
    powerupsEnabled,
    powerupsPerPlayer: 0,
    maxAttacksPerPlayer: 0,
    distributionMode: 'SNAKE',
    rounds: Array.from({ length: rounds }, (_, i): TemplateRound => ({
      roundNumber: i + 1,
      courseId: 'course_1',
      teeMode: 'UNIFORM',
    })),
  }
}

let template = makeTemplate(2)

// Rows written inside the transaction only join `committed` if the callback
// returns — a throw discards them, which is what the real rollback does.
type Row = { id: string; slug: string }
const committed: Row[] = []
let staged: Row[] = []
let seq = 0

const txMock = {
  tournament: {
    create: vi.fn(async ({ data }: { data: { slug: string } }) => {
      const row: Row = { id: `evt_${++seq}`, slug: data.slug }
      staged.push(row)
      return row
    }),
  },
}

const prismaMock = {
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<Row>) => {
    staged = []
    const result = await fn(txMock)
    committed.push(...staged)
    return result
  }),
  tournament: {
    // getLatestInChain: no child → the template is the latest in the chain.
    findFirst: vi.fn(async () => null),
    findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
      where.id ? template : null,
    ),
    count: vi.fn(async () => 0),
    // A create outside the transaction commits immediately — there is nothing
    // to roll back. This is the path the old code took.
    create: vi.fn(async ({ data }: { data: { slug: string } }) => {
      const row: Row = { id: `evt_${++seq}`, slug: data.slug }
      committed.push(row)
      return row
    }),
  },
  tournamentRound: { create: vi.fn(async () => ({ id: 'round_1' })) },
  playerProfile: {
    findUnique: vi.fn(async () => ({ handicap: 10 })),
    findMany: vi.fn(async () => []),
  },
  tournamentPlayer: {
    create: vi.fn(async () => ({ id: 'tp_1' })),
    createMany: vi.fn(async () => ({ count: 0 })),
  },
  draft: { create: vi.fn(async () => ({ id: 'draft_1' })) },
  powerup: { findMany: vi.fn(async () => []) },
  tournamentPowerup: { createMany: vi.fn(async () => ({ count: 0 })) },
}

const authMock = {
  getUser: vi.fn(async () => ({ id: 'user_1' })),
  isTournamentAdmin: vi.fn(async () => true),
}

const stripeMock = {
  getUserTier: vi.fn(async () => ({ tier: 'FREE', expiresAt: null, proCredits: 0 })),
  consumeProCredit: vi.fn(async () => false),
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/stripe', () => stripeMock)
vi.mock('@/lib/join-code', () => ({ generateJoinCode: vi.fn(async () => 'ABC123') }))
vi.mock('@/lib/league-events', () => ({ getLeagueRootId: vi.fn(async () => null) }))
vi.mock('@/lib/roster-actions', () => ({ getOrCreateRoster: vi.fn(async () => null) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  committed.length = 0
  staged = []
  seq = 0
  template = makeTemplate(2)
  authMock.getUser.mockResolvedValue({ id: 'user_1' })
  authMock.isTournamentAdmin.mockResolvedValue(true)
  stripeMock.getUserTier.mockResolvedValue({ tier: 'FREE', expiresAt: null, proCredits: 0 })
  stripeMock.consumeProCredit.mockResolvedValue(false)
})

describe('scheduleLeagueEvent — Pro credit enforcement', () => {
  it('leaves no event behind when there is no credit to consume', async () => {
    const { scheduleLeagueEvent } = await import('@/lib/league-event-actions')

    await expect(scheduleLeagueEvent('t_root', { date: '2026-05-02' })).rejects.toThrow(
      /no pro credits/i,
    )

    // The create was rolled back with the charge, and none of the child rows
    // (rounds, registrations, powerups) were ever written.
    expect(committed).toHaveLength(0)
    expect(prismaMock.tournamentRound.create).not.toHaveBeenCalled()
    expect(prismaMock.tournamentPlayer.create).not.toHaveBeenCalled()
  })

  it('consumes the credit inside the same transaction as the create', async () => {
    stripeMock.consumeProCredit.mockResolvedValue(true)
    const { scheduleLeagueEvent } = await import('@/lib/league-event-actions')

    const result = await scheduleLeagueEvent('t_root', { date: '2026-05-02' })

    expect(result.slug).toContain('ryder')
    expect(committed).toHaveLength(1)
    // Third argument is the transaction client — that is what ties the charge
    // to the create rather than trailing it.
    expect(stripeMock.consumeProCredit).toHaveBeenCalledWith('user_1', committed[0].id, txMock)
    expect(prismaMock.tournamentRound.create).toHaveBeenCalledTimes(2)
  })

  it('charges once per event, so each pass of a season schedule needs its own credit', async () => {
    stripeMock.consumeProCredit.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { scheduleLeagueEvent } = await import('@/lib/league-event-actions')

    await scheduleLeagueEvent('t_root', { date: '2026-05-02' })
    await expect(scheduleLeagueEvent('t_root', { date: '2026-05-09' })).rejects.toThrow(
      /no pro credits/i,
    )

    expect(stripeMock.consumeProCredit).toHaveBeenCalledTimes(2)
    expect(committed).toHaveLength(1)
  })

  it('Tour (LEAGUE) organisers still schedule without spending a credit', async () => {
    stripeMock.getUserTier.mockResolvedValue({ tier: 'LEAGUE', expiresAt: null, proCredits: 0 })
    const { scheduleLeagueEvent } = await import('@/lib/league-event-actions')

    await scheduleLeagueEvent('t_root', { date: '2026-05-02' })

    expect(stripeMock.consumeProCredit).not.toHaveBeenCalled()
    expect(committed).toHaveLength(1)
  })

  it('a free-tier event (single round, no powerups) still costs nothing', async () => {
    template = makeTemplate(1)
    const { scheduleLeagueEvent } = await import('@/lib/league-event-actions')

    await scheduleLeagueEvent('t_root', { date: '2026-05-02' })

    expect(stripeMock.consumeProCredit).not.toHaveBeenCalled()
    expect(committed).toHaveLength(1)
  })
})

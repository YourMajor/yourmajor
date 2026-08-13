import { describe, it, expect, beforeEach, vi } from 'vitest'

// setEventParticipation is an exported Server Action, so its id ships in a
// public chunk (LeagueScheduleView imports it). It used to create a
// TournamentPlayer row for any authenticated caller who passed any tournament
// id — bypassing the invite / open-registration / player-cap rules the register
// page enforces. Membership alone gates chat history and photos, so joining is
// a real access grant, not a preference toggle.

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }
const leagueEventsMock = { getLeagueEvents: vi.fn() }
const stripeMock = { getTournamentTier: vi.fn() }

const prismaMock = {
  tournament: { findUnique: vi.fn() },
  tournamentPlayer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  leagueRosterMember: { findFirst: vi.fn() },
  invitation: { findFirst: vi.fn() },
  playerProfile: { findUnique: vi.fn() },
  score: { count: vi.fn() },
  $transaction: vi.fn(async (fn: unknown) =>
    typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(prismaMock) : null,
  ),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/league-events', () => leagueEventsMock)
vi.mock('@/lib/stripe', () => stripeMock)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Default world: an invite-only league, caller is a stranger with no rows.
beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'u_outsider', email: 'stranger@example.com', phone: null })
  authMock.isTournamentAdmin.mockResolvedValue(false)
  leagueEventsMock.getLeagueEvents.mockResolvedValue([
    { id: 'root', isRoot: true },
    { id: 'ev2', isRoot: false },
    { id: 'ev3', isRoot: false },
  ])
  stripeMock.getTournamentTier.mockResolvedValue('FREE') // maxPlayers: 16
  prismaMock.tournament.findUnique.mockResolvedValue({
    id: 'ev3',
    slug: 'league-ev3',
    status: 'REGISTRATION',
    isOpenRegistration: false,
    registrationClosed: false,
  })
  prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null) // no row on this event
  prismaMock.tournamentPlayer.findFirst.mockResolvedValue(null) // no row anywhere in the chain
  prismaMock.tournamentPlayer.count.mockResolvedValue(0)
  prismaMock.tournamentPlayer.create.mockResolvedValue({ id: 'tp_new' })
  prismaMock.leagueRosterMember.findFirst.mockResolvedValue(null)
  prismaMock.invitation.findFirst.mockResolvedValue(null)
  prismaMock.playerProfile.findUnique.mockResolvedValue({ handicap: 12 })
  prismaMock.score.count.mockResolvedValue(0)
})

describe('setEventParticipation — join gate', () => {
  it('refuses a stranger joining an invite-only event and writes nothing', async () => {
    const { setEventParticipation } = await import('./actions')
    const result = await setEventParticipation('ev3', true)

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/invite-only/i) })
    expect(prismaMock.tournamentPlayer.create).not.toHaveBeenCalled()
  })

  it('refuses a stranger when registration is closed', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({
      id: 'ev3',
      slug: 'league-ev3',
      status: 'REGISTRATION',
      isOpenRegistration: true,
      registrationClosed: true,
    })

    const { setEventParticipation } = await import('./actions')
    const result = await setEventParticipation('ev3', true)

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/closed/i) })
    expect(prismaMock.tournamentPlayer.create).not.toHaveBeenCalled()
  })

  it('lets anyone join an open-registration event', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({
      id: 'ev3',
      slug: 'league-ev3',
      status: 'REGISTRATION',
      isOpenRegistration: true,
      registrationClosed: false,
    })

    const { setEventParticipation } = await import('./actions')
    const result = await setEventParticipation('ev3', true)

    expect(result).toEqual({ ok: true })
    expect(prismaMock.tournamentPlayer.create).toHaveBeenCalled()
  })

  it('lets a player from an earlier event in the chain join, with no roster row and a spent invitation', async () => {
    // The regression that matters: roster seeding is one-shot, so a player who
    // accepted an invite to event 2 may hold no LeagueRosterMember row, and
    // their invitation now has acceptedAt set. The chain TournamentPlayer row
    // is what proves they belong — same membership definition getOrCreateRoster
    // seeds from.
    prismaMock.tournamentPlayer.findFirst.mockResolvedValue({ id: 'tp_ev2' })

    const { setEventParticipation } = await import('./actions')
    const result = await setEventParticipation('ev3', true)

    expect(result).toEqual({ ok: true })
    expect(prismaMock.tournamentPlayer.create).toHaveBeenCalled()
    // Admitted as a chain insider — never sent down the invitation path.
    expect(prismaMock.invitation.findFirst).not.toHaveBeenCalled()
  })

  it('refuses the join when the tier player cap is already reached', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({
      id: 'ev3',
      slug: 'league-ev3',
      status: 'REGISTRATION',
      isOpenRegistration: true,
      registrationClosed: false,
    })
    prismaMock.tournamentPlayer.count.mockResolvedValue(16) // FREE tier limit

    const { setEventParticipation } = await import('./actions')
    const result = await setEventParticipation('ev3', true)

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/16-player limit/i) })
    expect(prismaMock.tournamentPlayer.create).not.toHaveBeenCalled()
  })

  it('still lets an existing player toggle their own row', async () => {
    prismaMock.tournamentPlayer.findUnique.mockResolvedValue({ id: 'tp_mine' })

    const { setEventParticipation } = await import('./actions')
    expect(await setEventParticipation('ev3', false)).toEqual({ ok: true })
    expect(prismaMock.tournamentPlayer.update).toHaveBeenCalledWith({
      where: { id: 'tp_mine' },
      data: { isParticipant: false },
    })
  })
})

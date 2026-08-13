import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WizardPayload } from './actions'

// Regression test for the parentTournamentId authorization bypass.
// parentTournamentId arrives from the client, so the wizard previously let any
// authenticated user graft a new tournament onto someone else's league chain.
// Keep `isTournamentAdmin` on the parent a hard gate.

const authMock = {
  getUser: vi.fn(),
  isTournamentAdmin: vi.fn(),
}

const prismaMock = {
  tournament: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  tournamentRound: { count: vi.fn(async () => 0) },
  $transaction: vi.fn(),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  getUserTier: vi.fn(async () => ({ tier: 'FREE', expiresAt: null, proCredits: 0 })),
  consumeProCredit: vi.fn(async () => true),
  getUnusedProCredits: vi.fn(async () => 0),
}))
vi.mock('@/lib/invite-sender', () => ({ sendInvitations: vi.fn() }))
vi.mock('@/lib/join-code', () => ({ generateJoinCode: vi.fn(async () => 'CODE') }))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'attacker' })
})

// Dates are deliberately invalid so an authorized call fails the *next* check
// instead of running the whole creation transaction.
function payload(parentTournamentId: string | null): WizardPayload {
  return {
    name: 'Grafted Event',
    description: '',
    startDate: '2026-07-01',
    endDate: '2026-06-01',
    numRounds: 1,
    logoUrl: null,
    headerImageUrl: null,
    primaryColor: '#006747',
    accentColor: '#C9A84C',
    rounds: [],
    handicapSystem: 'NONE',
    powerupsEnabled: false,
    powerupsPerPlayer: 0,
    maxAttacksPerPlayer: 0,
    distributionMode: 'RANDOM',
    draftFormat: 'LINEAR',
    draftTiming: 'PRE_TOURNAMENT',
    isOpenRegistration: true,
    inviteEmails: [],
    tournamentType: 'OPEN',
    parentTournamentId,
  }
}

describe('createTournamentFromWizard — parent tournament auth gate', () => {
  it('rejects a parentTournamentId the caller does not administer', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { createTournamentFromWizard } = await import('./actions')
    const result = await createTournamentFromWizard(payload('victim-league'))

    expect(result).toEqual({ error: 'Forbidden' })
    expect(authMock.isTournamentAdmin).toHaveBeenCalledWith('attacker', 'victim-league')
    // Nothing touched the victim's chain — not even the round-count lookup.
    expect(prismaMock.tournamentRound.count).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('lets an admin of the parent through the gate', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(true)

    const { createTournamentFromWizard } = await import('./actions')
    const result = await createTournamentFromWizard(payload('my-league'))

    // Past the gate — stopped by the date validation that follows it.
    expect(result).toEqual({ error: 'Start date must be before end date.' })
  })

  it('does not gate a standalone tournament with no parent', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { createTournamentFromWizard } = await import('./actions')
    const result = await createTournamentFromWizard(payload(null))

    expect(result).toEqual({ error: 'Start date must be before end date.' })
    expect(authMock.isTournamentAdmin).not.toHaveBeenCalled()
  })
})

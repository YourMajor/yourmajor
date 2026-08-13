import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression tests for the U10 invitation auth bypass.
// The register page used to resolve a pending invitation by matching the
// caller's OWN profile email or phone when no ?token= was present. Neither
// identifier is verified — the profile form writes the phone straight through
// and User.phone isn't even unique — so anyone could type a victim's address
// or number and consume their invitation to a private tournament.
// Only token possession authorizes now. A missing token must refuse.

const prismaMock = {
  tournament: { findUnique: vi.fn() },
  invitation: { findUnique: vi.fn(), findFirst: vi.fn() },
  tournamentPlayer: { findUnique: vi.fn() },
  playerProfile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}

const txMock = {
  tournamentPlayer: { count: vi.fn(), upsert: vi.fn() },
  invitation: { updateMany: vi.fn() },
}

const authMock = { getUser: vi.fn() }
const supabaseMock = { createClient: vi.fn() }
const stripeMock = { getTournamentTier: vi.fn() }
const redirectMock = vi.fn()

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('@/utils/supabase/server', () => supabaseMock)
vi.mock('@/lib/stripe', () => stripeMock)
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/components/ui/tournament-message', () => ({
  TournamentMessage: () => null,
}))

const INVITE_ONLY_TOURNAMENT = {
  id: 't1',
  slug: 'ryder',
  status: 'REGISTRATION',
  registrationClosed: false,
  isOpenRegistration: false,
  _count: { players: 0 },
}

async function renderRegisterPage(token?: string) {
  const { default: RegisterPage } = await import('./page')
  const result = await RegisterPage({
    params: Promise.resolve({ slug: 'ryder' }),
    searchParams: Promise.resolve(token ? { token } : {}),
  })
  return result as unknown as { props: { heading?: string } } | null
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMock.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  })
  prismaMock.tournament.findUnique.mockResolvedValue(INVITE_ONLY_TOURNAMENT)
  prismaMock.tournamentPlayer.findUnique.mockResolvedValue(null)
  prismaMock.playerProfile.findUnique.mockResolvedValue(null)
  stripeMock.getTournamentTier.mockResolvedValue('FREE')
  // A pending invitation for this tournament DOES exist and would have matched
  // the caller under the old code — the point is that it is never consulted.
  prismaMock.invitation.findFirst.mockResolvedValue({ token: 'tok_victim' })
  txMock.tournamentPlayer.count.mockResolvedValue(0)
  txMock.tournamentPlayer.upsert.mockResolvedValue({})
  txMock.invitation.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock))
})

describe('invite-only register page — no token', () => {
  it('refuses a caller whose email matches a pending invitation', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'victim@example.com', phone: null })

    const result = await renderRegisterPage()

    expect(result?.props.heading).toBe('Invitation Required')
    expect(prismaMock.invitation.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })

  it('refuses a caller whose phone matches a pending invitation', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'attacker@example.com', phone: '+15551234567' })

    const result = await renderRegisterPage()

    expect(result?.props.heading).toBe('Invitation Required')
    expect(prismaMock.invitation.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.tournamentPlayer.upsert).not.toHaveBeenCalled()
  })
})

describe('invite-only register page — with token', () => {
  it('still registers the holder of a valid invitation link', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'invitee@example.com', phone: null })
    prismaMock.invitation.findUnique.mockResolvedValue({
      id: 'i1',
      acceptedAt: null,
      tournamentId: 't1',
      expiresAt: null,
    })

    await renderRegisterPage('tok_valid')

    expect(txMock.tournamentPlayer.upsert).toHaveBeenCalled()
    expect(txMock.invitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ token: 'tok_valid' }) }),
    )
    expect(redirectMock).toHaveBeenCalledWith('/ryder')
  })

  it('refuses an expired invitation token', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'invitee@example.com', phone: null })
    prismaMock.invitation.findUnique.mockResolvedValue({
      id: 'i1',
      acceptedAt: null,
      tournamentId: 't1',
      expiresAt: new Date('2020-01-01'),
    })

    const result = await renderRegisterPage('tok_expired')

    expect(result?.props.heading).toBe('Invitation Expired')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { safeNextPath } from '@/lib/safe-redirect'

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

const OPEN_TOURNAMENT = { ...INVITE_ONLY_TOURNAMENT, isOpenRegistration: true }

async function renderRegisterPage(token?: string) {
  const { default: RegisterPage } = await import('./page')
  const result = await RegisterPage({
    params: Promise.resolve({ slug: 'ryder' }),
    searchParams: Promise.resolve(token ? { token } : {}),
  })
  return result as unknown as { props: { heading?: string } } | null
}

async function runConfirmRegistration(input: unknown) {
  const { confirmRegistration } = await import('./actions')
  return confirmRegistration(input)
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

    // F112: the GET render no longer writes — it offers a confirmation form.
    const page = await renderRegisterPage('tok_valid')
    expect(page?.props.heading).toBe('Confirm Registration')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()

    await runConfirmRegistration({ slug: 'ryder', token: 'tok_valid' })

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

// F112: the registration write moved off the GET render into confirmRegistration.
// Its slug and token are caller-supplied — the slug reaches redirect() through
// the href helpers, the token reaches Prisma — so both are checked here.
//
// Two independent layers guard the redirect targets, and both are asserted:
//   (a) `slug: z.string().min(1)` in the action's schema. encodeURIComponent('')
//       is '', so an empty slug builds the protocol-relative '//register',
//       whose origin is 'https://register'.
//   (b) safeNextPath(..., '/') on every redirect target, which rejects '',
//       '//', '/\', tab/LF/CR and anything not starting with a single '/'.

const ORIGIN = 'https://yourmajor.club'

const HOSTILE = [
  '',
  '/evil.com',
  '//evil.com',
  '/\\evil.com',
  '/\tevil.com',
  '/\nevil.com',
  '/\revil.com',
  '/\t/evil.com',
  'https://evil.com',
  '@evil.com',
]

function expectSameOrigin(href: string) {
  expect(new URL(href, ORIGIN).origin, `off-origin target: ${JSON.stringify(href)}`).toBe(ORIGIN)
}

describe('register href helpers — hostile slugs and tokens', () => {
  it('never builds an off-origin redirect target once passed through safeNextPath', async () => {
    const { registerHref, tournamentHref } = await import('./registration')

    for (const slug of HOSTILE) {
      expectSameOrigin(safeNextPath(tournamentHref(slug), '/'))
      for (const token of [null, ...HOSTILE]) {
        expectSameOrigin(safeNextPath(registerHref(slug, token), '/'))
      }
    }
  })

  it('collapses the //register an empty slug builds', async () => {
    const { registerHref } = await import('./registration')

    // The raw helper cannot save this one: encodeURIComponent('') is ''. Layer
    // (b) is what makes the target same-origin, layer (a) refuses it outright.
    expectSameOrigin(safeNextPath(registerHref('', null), '/'))
    expect(safeNextPath(registerHref('', null), '/')).toBe('/')
  })
})

describe('confirmRegistration — hostile action arguments', () => {
  it('never redirects off-origin for an invite-only tournament', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'a@example.com', phone: null })
    prismaMock.invitation.findUnique.mockResolvedValue(null)

    for (const slug of HOSTILE) {
      for (const token of [null, ...HOSTILE]) {
        await runConfirmRegistration({ slug, token })
      }
    }

    expect(redirectMock).toHaveBeenCalled()
    for (const [href] of redirectMock.mock.calls) expectSameOrigin(href as string)
  })

  it('never redirects off-origin for an open-registration tournament', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'a@example.com', phone: null })
    prismaMock.tournament.findUnique.mockResolvedValue(OPEN_TOURNAMENT)

    for (const slug of HOSTILE) {
      for (const token of [null, ...HOSTILE]) {
        await runConfirmRegistration({ slug, token })
      }
    }

    expect(redirectMock).toHaveBeenCalled()
    for (const [href] of redirectMock.mock.calls) expectSameOrigin(href as string)
  })

  it('refuses an empty slug before touching Prisma', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'a@example.com', phone: null })

    await runConfirmRegistration({ slug: '', token: null })

    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('refuses an object token before it can reach invitation.updateMany as a Prisma filter', async () => {
    // The exploit this closes: an open-registration tournament skips token
    // validation by design, so `{ not: null }` would arrive at updateMany as a
    // StringFilter matching every pending invitation for the tournament and
    // re-assign them all to the attacker.
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'attacker@example.com', phone: null })
    prismaMock.tournament.findUnique.mockResolvedValue(OPEN_TOURNAMENT)

    await runConfirmRegistration({ slug: 'ryder', token: { not: null } })

    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.invitation.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.invitation.updateMany).not.toHaveBeenCalled()
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('refuses every other non-string argument shape before touching Prisma', async () => {
    authMock.getUser.mockResolvedValue({ id: 'u1', email: 'a@example.com', phone: null })
    prismaMock.tournament.findUnique.mockResolvedValue(OPEN_TOURNAMENT)

    const shapes: unknown[] = [
      undefined,
      null,
      'ryder',
      { slug: 'ryder' },
      { slug: 'ryder', token: ['tok'] },
      { slug: 'ryder', token: 1 },
      { slug: { contains: '' }, token: null },
      { slug: 1, token: null },
      { slug: ['ryder'], token: null },
    ]
    for (const shape of shapes) await runConfirmRegistration(shape)

    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.invitation.updateMany).not.toHaveBeenCalled()
    for (const [href] of redirectMock.mock.calls) expectSameOrigin(href as string)
  })
})

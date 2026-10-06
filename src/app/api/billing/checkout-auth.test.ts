import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Two regressions on POST /api/billing/checkout:
//
//  1. No ownership check on `tournamentId` — any authenticated user could pay
//     against a tournament they do not administer, stamping a Purchase (and so
//     a tier grant) onto someone else's event.
//  2. The Stripe success / cancel URL was built from the request's `Origin`
//     header, which a non-browser POST sets freely, so a paying user could be
//     redirected to an attacker's host after payment.

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }
const stripeMock = {
  createProCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/s/1' })),
  createClubCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/s/2' })),
  createLeagueCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/s/3' })),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/stripe', () => stripeMock)

function post(body: unknown, origin?: string) {
  return new NextRequest('https://yourmajor.club/api/billing/checkout', {
    method: 'POST',
    headers: origin ? { origin, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'yourmajor.club')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://yourmajor.club')
  authMock.getUser.mockResolvedValue({ id: 'user_1', email: 'a@b.c', role: 'USER' })
  authMock.isTournamentAdmin.mockResolvedValue(true)
})

describe('POST /api/billing/checkout — tournament ownership', () => {
  it('rejects a tournamentId the caller does not administer', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { POST } = await import('./checkout/route')
    const res = await POST(post({ type: 'PRO', tournamentId: 'tourn_other', slug: 'theirs' }))

    expect(res.status).toBe(403)
    expect(stripeMock.createProCheckoutSession).not.toHaveBeenCalled()
  })

  it('allows it when the caller IS the tournament admin', async () => {
    const { POST } = await import('./checkout/route')
    const res = await POST(post({ type: 'PRO', tournamentId: 'tourn_1', slug: 'mine' }))

    expect(res.status).toBe(200)
    expect(authMock.isTournamentAdmin).toHaveBeenCalledWith('user_1', 'tourn_1')
    expect(stripeMock.createProCheckoutSession).toHaveBeenCalled()
  })

  it('does not consult the admin check for a tournament-less purchase', async () => {
    const { POST } = await import('./checkout/route')
    await POST(post({ type: 'LEAGUE' }))

    expect(authMock.isTournamentAdmin).not.toHaveBeenCalled()
    expect(stripeMock.createLeagueCheckoutSession).toHaveBeenCalled()
  })

  it('still rejects an anonymous caller', async () => {
    authMock.getUser.mockResolvedValue(null)

    const { POST } = await import('./checkout/route')
    const res = await POST(post({ type: 'PRO', tournamentId: 'tourn_1' }))

    expect(res.status).toBe(401)
    expect(stripeMock.createProCheckoutSession).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/checkout — return URL origin', () => {
  it('ignores a spoofed Origin and uses the app URL', async () => {
    const { POST } = await import('./checkout/route')
    await POST(post({ type: 'PRO', tournamentId: 'tourn_1', slug: 'mine' }, 'https://evil.tld'))

    const { returnUrl } = stripeMock.createProCheckoutSession.mock.calls[0][0]
    expect(returnUrl).toBe('https://yourmajor.club/mine')
  })

  it('keeps a league subdomain origin', async () => {
    const { POST } = await import('./checkout/route')
    await POST(post({ type: 'CLUB' }, 'https://my-league.yourmajor.club'))

    const { returnUrl } = stripeMock.createClubCheckoutSession.mock.calls[0][0]
    expect(returnUrl).toBe('https://my-league.yourmajor.club/pricing')
  })

  it('encodes a slug that tries to inject path segments', async () => {
    const { POST } = await import('./checkout/route')
    await POST(post({ type: 'PRO', tournamentId: 'tourn_1', slug: '../../admin' }))

    const { returnUrl } = stripeMock.createProCheckoutSession.mock.calls[0][0]
    expect(returnUrl).toBe('https://yourmajor.club/..%2F..%2Fadmin')
  })
})

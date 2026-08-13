import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the redeemProCredit authorization gap. The action was
// gated only on being logged in, and its id ships in the client bundle via
// BrandingUpsell, so any authenticated user could bind a Pro credit to a
// tournamentId they do not administer.

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }
const stripeMock = { consumeProCredit: vi.fn(async () => true) }

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/stripe', () => stripeMock)
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
})

describe('redeemProCredit — auth gate', () => {
  it('throws Forbidden when the caller does not administer the tournament', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { redeemProCredit } = await import('./actions')
    await expect(redeemProCredit('tourn_1', 'ryder')).rejects.toThrow(/forbidden/i)
    expect(stripeMock.consumeProCredit).not.toHaveBeenCalled()
  })

  it('throws Unauthorized when the caller is not authenticated', async () => {
    authMock.getUser.mockResolvedValue(null)
    authMock.isTournamentAdmin.mockResolvedValue(false)

    const { redeemProCredit } = await import('./actions')
    await expect(redeemProCredit('tourn_1', 'ryder')).rejects.toThrow(/unauthorized/i)
    expect(stripeMock.consumeProCredit).not.toHaveBeenCalled()
  })

  it('consumes the credit when the caller IS a tournament admin', async () => {
    authMock.isTournamentAdmin.mockResolvedValue(true)

    const { redeemProCredit } = await import('./actions')
    await redeemProCredit('tourn_1', 'ryder')
    expect(authMock.isTournamentAdmin).toHaveBeenCalledWith('user_1', 'tourn_1')
    expect(stripeMock.consumeProCredit).toHaveBeenCalledWith('user_1', 'tourn_1')
  })
})

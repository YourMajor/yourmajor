import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the profile handicap fan-out.
// updateProfile pushed the new handicap onto every TournamentPlayer row the
// user owned, with a bare `where: { userId }`. TournamentPlayer.handicap is the
// snapshot net scores and ranks are computed from, and season points follow
// those ranks, so editing a profile reordered finished leaderboards and the
// season table behind them. The write is now scoped to events that have not
// completed and rows with no scores.
//
// Also covers the email-change path: it used to rebind the account's login
// address through the service-role admin API with no proof the caller owned
// the new address. It now asks Supabase to mail a confirmation link, and no
// way of failing that request may cost the caller the rest of the form.

const prismaMock = {
  user: { update: vi.fn() },
  playerProfile: { upsert: vi.fn() },
  tournamentPlayer: { updateMany: vi.fn() },
}

const authMock = { getUser: vi.fn() }
const supabaseAuth = { getUser: vi.fn(), updateUser: vi.fn() }
const createClient = vi.fn(async () => ({ auth: supabaseAuth }))
const checkRateLimit = vi.fn()

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('@/utils/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit,
  LIMITS: { emailChange: { limit: 3, windowSeconds: 3600 } },
}))

const EMAIL = 'player@example.com'
const NEW_EMAIL = 'someone-elses@example.com'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'user_1', email: EMAIL })
  prismaMock.tournamentPlayer.updateMany.mockResolvedValue({ count: 0 })
  supabaseAuth.getUser.mockResolvedValue({ data: { user: { id: 'auth_1' } } })
  supabaseAuth.updateUser.mockResolvedValue({ error: null })
  checkRateLimit.mockResolvedValue({ ok: true, remaining: 2, retryAfter: 3600 })
})

/** Defaults to the session user's own email, so the email branch is skipped. */
function form(handicap: string, email = EMAIL) {
  const fd = new FormData()
  fd.set('firstName', 'Sam')
  fd.set('lastName', 'Jones')
  fd.set('email', email)
  fd.set('handicap', handicap)
  fd.set('phone', '')
  return fd
}

describe('updateProfile — handicap fan-out scope', () => {
  it('never reaches a completed event or a row that has scores', async () => {
    const { updateProfile } = await import('./actions')
    await expect(updateProfile(form('12'))).resolves.toEqual({ success: true })

    expect(prismaMock.tournamentPlayer.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        tournament: { status: { not: 'COMPLETED' } },
        scores: { none: {} },
      },
      data: { handicap: 12 },
    })
  })

  it('writes no membership at all when the handicap field is left blank', async () => {
    const { updateProfile } = await import('./actions')
    await expect(updateProfile(form(''))).resolves.toEqual({ success: true })

    expect(prismaMock.tournamentPlayer.updateMany).not.toHaveBeenCalled()
  })
})

describe('updateProfile — email change', () => {
  it('asks Supabase to mail a confirmation link instead of rebinding the address', async () => {
    const { updateProfile } = await import('./actions')
    const result = await updateProfile(form('12', NEW_EMAIL))

    expect(supabaseAuth.updateUser).toHaveBeenCalledWith(
      { email: NEW_EMAIL },
      { emailRedirectTo: expect.stringContaining('/api/auth/callback') },
    )
    // The Prisma mirror must not move ahead of the confirmation.
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'Sam Jones', phone: null, smsNotifications: false },
    })
    expect(result).toMatchObject({ success: true })
    expect('notice' in result && result.notice).toContain(NEW_EMAIL)
  })

  it('rate limits the confirmation mail per caller, never by IP', async () => {
    const { updateProfile } = await import('./actions')
    await updateProfile(form('12', NEW_EMAIL))

    expect(checkRateLimit).toHaveBeenCalledWith('email-change:user_1', {
      limit: 3,
      windowSeconds: 3600,
    })
  })

  // Both halves of the invariant the round-two rejection was about: no way of
  // failing the email change may discard the rest of the form, and none of
  // them may report an address change that did not happen.
  it('still saves name, handicap and phone when the rate limit refuses', async () => {
    checkRateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 1800 })
    const { updateProfile } = await import('./actions')

    const fd = form('12', NEW_EMAIL)
    fd.set('phone', '5551234567')
    const result = await updateProfile(fd)

    expect(supabaseAuth.updateUser).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'Sam Jones', phone: '+15551234567', smsNotifications: false },
    })
    expect(prismaMock.playerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { displayName: 'Sam Jones', handicap: 12 } }),
    )
    expect(result).toMatchObject({ success: true })
    const notice = 'notice' in result ? result.notice ?? '' : ''
    expect(notice).toMatch(/email/i)
    expect(notice).toMatch(/not sent|too many/i)
  })

  it('still saves name, handicap and phone when Supabase refuses the address', async () => {
    supabaseAuth.updateUser.mockResolvedValue({ error: { message: 'already registered' } })
    const { updateProfile } = await import('./actions')

    const fd = form('12', NEW_EMAIL)
    fd.set('phone', '5551234567')
    const result = await updateProfile(fd)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'Sam Jones', phone: '+15551234567', smsNotifications: false },
    })
    expect(prismaMock.playerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { displayName: 'Sam Jones', handicap: 12 } }),
    )
    expect(prismaMock.tournamentPlayer.updateMany).toHaveBeenCalled()
    expect(result).toMatchObject({ success: true })
    const notice = 'notice' in result ? result.notice ?? '' : ''
    expect(notice).toMatch(/email/i)
    expect(notice).toMatch(/could not be changed/i)
    // Never the provider's own text.
    expect(notice).not.toContain('already registered')
  })
})

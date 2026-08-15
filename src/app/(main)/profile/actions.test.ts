import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression test for the profile handicap fan-out.
// updateProfile pushed the new handicap onto every TournamentPlayer row the
// user owned, with a bare `where: { userId }`. TournamentPlayer.handicap is the
// snapshot net scores and ranks are computed from, and season points follow
// those ranks, so editing a profile reordered finished leaderboards and the
// season table behind them. The write is now scoped to events that have not
// completed and rows with no scores.

const prismaMock = {
  user: { update: vi.fn() },
  playerProfile: { upsert: vi.fn() },
  tournamentPlayer: { updateMany: vi.fn() },
}

const authMock = { getUser: vi.fn() }

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const EMAIL = 'player@example.com'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'user_1', email: EMAIL })
  prismaMock.tournamentPlayer.updateMany.mockResolvedValue({ count: 0 })
})

/** Same email as the session user, so the Supabase email-change path is skipped. */
function form(handicap: string) {
  const fd = new FormData()
  fd.set('firstName', 'Sam')
  fd.set('lastName', 'Jones')
  fd.set('email', EMAIL)
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

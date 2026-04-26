'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

/**
 * Toggle the current user's participation in a league event.
 *
 *  - going=false : marks the user's TournamentPlayer as `isParticipant: false`.
 *                  Creates the row first if it doesn't exist (so admins can
 *                  see the user opted out without auto-recreating them).
 *  - going=true  : ensures TournamentPlayer exists with `isParticipant: true`.
 *
 * Blocked when the event already has scores submitted by the user — at that
 * point they're committed and shouldn't silently disappear from results.
 * Returns ok=false with a reason on validation errors.
 */
export async function setEventParticipation(
  eventTournamentId: string,
  going: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const event = await prisma.tournament.findUnique({
    where: { id: eventTournamentId },
    select: { id: true, slug: true, status: true },
  })
  if (!event) return { ok: false, error: 'Event not found.' }

  if (event.status === 'COMPLETED') {
    return { ok: false, error: 'This event has already finished.' }
  }

  const existing = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: event.id, userId: user.id } },
    select: { id: true },
  })

  // Don't allow unregistering once scores exist.
  if (!going && existing) {
    const scoreCount = await prisma.score.count({
      where: { tournamentPlayerId: existing.id },
    })
    if (scoreCount > 0) {
      return { ok: false, error: 'You already have scores submitted for this event.' }
    }
  }

  if (existing) {
    await prisma.tournamentPlayer.update({
      where: { id: existing.id },
      data: { isParticipant: going },
    })
  } else if (going) {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: user.id },
      select: { handicap: true },
    })
    await prisma.tournamentPlayer.create({
      data: {
        tournamentId: event.id,
        userId: user.id,
        isParticipant: true,
        handicap: profile?.handicap ?? 0,
      },
    })
  }
  // else: not registered AND going=false → no-op

  revalidatePath(`/${event.slug}`)
  revalidatePath(`/${event.slug}/season`)
  return { ok: true }
}

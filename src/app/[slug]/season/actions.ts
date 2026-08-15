'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { User } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { getLeagueEvents } from '@/lib/league-events'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { snapshotHandicapOnActivation } from '@/lib/handicap-snapshot'

/**
 * Gate a first-time join on the same conditions the register page enforces
 * (src/app/[slug]/register/page.tsx): registration not closed, and either open
 * registration or a pending invitation addressed to this user.
 *
 * League insiders skip that gate — an admin of the event, an ACTIVE league
 * roster member, or anyone who already holds a TournamentPlayer row anywhere in
 * the chain. That last one is the same definition of membership
 * `getOrCreateRoster` seeds a roster from (src/lib/roster-actions.ts): roster
 * seeding is one-shot, so a player who joined an earlier event by code or invite
 * may hold no roster row and must still be treated as a league member.
 */
async function canJoinEvent(
  user: User,
  event: { id: string; isOpenRegistration: boolean; registrationClosed: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Empty for a tournament that isn't part of a league chain — then the chain
  // is just this event and the register-page rules apply unchanged.
  const chain = await getLeagueEvents(event.id)
  const chainIds = chain.length > 0 ? chain.map((e) => e.id) : [event.id]
  const rootId = chain.find((e) => e.isRoot)?.id ?? null

  const insider =
    (await isTournamentAdmin(user.id, event.id)) ||
    (rootId !== null &&
      !!(await prisma.leagueRosterMember.findFirst({
        where: { userId: user.id, roster: { rootTournamentId: rootId }, status: 'ACTIVE' },
        select: { id: true },
      }))) ||
    !!(await prisma.tournamentPlayer.findFirst({
      where: { userId: user.id, tournamentId: { in: chainIds } },
      select: { id: true },
    }))
  if (insider) return { ok: true }

  if (event.registrationClosed) {
    return { ok: false, error: 'Registration is closed for this event.' }
  }
  if (event.isOpenRegistration) return { ok: true }

  // Invite-only: match a pending invitation anywhere in the chain (league
  // invites are created against the root). Matched, not consumed — the register
  // page is what accepts an invitation. expiresAt is omitted here exactly as
  // register/page.tsx omits it on its email/phone branch.
  const orConditions = [
    ...(user.email ? [{ email: user.email }] : []),
    ...(user.phone ? [{ phone: user.phone }] : []),
  ]
  const invitation =
    orConditions.length > 0
      ? await prisma.invitation.findFirst({
          where: { tournamentId: { in: chainIds }, acceptedAt: null, OR: orConditions },
          select: { id: true },
        })
      : null
  if (!invitation) {
    return { ok: false, error: 'This event is invite-only. Ask the league admin for an invitation.' }
  }
  return { ok: true }
}

/**
 * Toggle the current user's participation in a league event.
 *
 *  - going=false : marks the user's TournamentPlayer as `isParticipant: false`.
 *                  Creates the row first if it doesn't exist (so admins can
 *                  see the user opted out without auto-recreating them).
 *  - going=true  : ensures TournamentPlayer exists with `isParticipant: true`.
 *                  A *first* join runs `canJoinEvent` and the tier player cap
 *                  first — this action's id is public, so it must not be a way
 *                  to join an event the register page would refuse.
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
    select: {
      id: true,
      slug: true,
      status: true,
      isOpenRegistration: true,
      registrationClosed: true,
    },
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
    // Joining on an existing row (a watcher, or a reversed opt-out) — it was
    // created with the default 0 handicap and needs the snapshot the create
    // branch below takes. A row already holding a real handicap or any scores
    // keeps what it has.
    if (going) {
      const profile = await prisma.playerProfile.findUnique({
        where: { userId: user.id },
        select: { handicap: true },
      })
      await snapshotHandicapOnActivation(prisma, existing.id, profile?.handicap ?? 0)
    }
  } else if (going) {
    const gate = await canJoinEvent(user, event)
    if (!gate.ok) return gate

    const profile = await prisma.playerProfile.findUnique({
      where: { userId: user.id },
      select: { handicap: true },
    })
    const maxPlayers = TIER_LIMITS[await getTournamentTier(event.id)].maxPlayers

    // Re-count inside the transaction before inserting, same as the register
    // page. Best-effort: it narrows the window, it does not serialise joins.
    const joined = await prisma.$transaction(async (tx) => {
      const playerCount = await tx.tournamentPlayer.count({
        where: { tournamentId: event.id },
      })
      if (playerCount >= maxPlayers) return false

      await tx.tournamentPlayer.create({
        data: {
          tournamentId: event.id,
          userId: user.id,
          isParticipant: true,
          handicap: profile?.handicap ?? 0,
        },
      })
      return true
    })
    if (!joined) {
      return {
        ok: false,
        error: `This event has reached the ${maxPlayers}-player limit for its current plan.`,
      }
    }
  }
  // else: not registered AND going=false → no-op

  revalidatePath(`/${event.slug}`)
  revalidatePath(`/${event.slug}/season`)
  return { ok: true }
}

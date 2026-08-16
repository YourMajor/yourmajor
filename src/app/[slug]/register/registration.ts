import { prisma } from '@/lib/prisma'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

// NOTE: this file deliberately has NO 'use server' directive. Every export of a
// 'use server' module is a public HTTP endpoint; the eligibility chain below is
// shared between the page render and the confirm action, so it lives here as
// ordinary server-side code that neither the browser nor Next can invoke.

/**
 * Path helpers for this route.
 *
 * `slug` and `token` are caller-supplied, so both are percent-encoded: a slug
 * of `/evil.com` would otherwise build `//evil.com`, which browsers resolve as
 * an absolute, off-origin URL. Encoding is necessary but NOT sufficient —
 * `encodeURIComponent('')` is the empty string, so an empty slug still yields
 * `//register`. Callers must additionally pass the result through
 * `safeNextPath()` before handing it to `redirect()`.
 */
export function tournamentHref(slug: string): string {
  return `/${encodeURIComponent(slug)}`
}

export function registerHref(slug: string, token: string | null): string {
  return `${tournamentHref(slug)}/register${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export type RefusalIcon = 'closed' | 'invalid' | 'accepted' | 'required' | 'full'

export type RegistrationResolution =
  | { status: 'not-found' }
  | { status: 'redirect'; href: string }
  | {
      status: 'refused'
      icon: RefusalIcon
      heading: string
      description: string
      backHref: string
    }
  | { status: 'ready'; tournamentId: string; maxPlayers: number; profileHandicap: number }

/**
 * Decide whether this caller may register for this tournament, without writing
 * anything. Both the GET render and the POST confirm action run this — the
 * action re-runs it from scratch and trusts nothing the client sent beyond the
 * slug and token it validates first.
 */
export async function resolveRegistration({
  slug,
  token,
  user,
}: {
  slug: string
  token: string | null
  user: { id: string } | null
}): Promise<RegistrationResolution> {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      _count: { select: { players: true } },
    },
  })

  if (!tournament) return { status: 'not-found' }

  // Registration is closed if: admin manually closed it, or tournament is completed
  if (tournament.status === 'COMPLETED' || tournament.registrationClosed) {
    return {
      status: 'refused',
      icon: 'closed',
      heading: 'Registration Closed',
      description: tournament.status === 'COMPLETED'
        ? 'This tournament has been completed. Registration is no longer available.'
        : 'Registration is currently closed. Contact the tournament admin if you need to register.',
      backHref: tournamentHref(slug),
    }
  }

  // Invite-only: require a valid invitation token. Never match on the caller's
  // own email or phone — neither is verified, so either would let anyone claim
  // someone else's invitation just by typing their address or number.
  if (!tournament.isOpenRegistration) {
    if (token) {
      // Validate the provided token
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        select: { id: true, acceptedAt: true, tournamentId: true, expiresAt: true },
      })

      if (!invitation || invitation.tournamentId !== tournament.id) {
        return {
          status: 'refused',
          icon: 'invalid',
          heading: 'Invalid Invitation',
          description: 'This invitation link is invalid or has expired.',
          backHref: tournamentHref(slug),
        }
      }

      if (invitation.expiresAt && invitation.expiresAt < new Date()) {
        return {
          status: 'refused',
          icon: 'invalid',
          heading: 'Invitation Expired',
          description: 'This invitation has expired. Ask the tournament admin to send a new one.',
          backHref: tournamentHref(slug),
        }
      }

      if (invitation.acceptedAt) {
        return {
          status: 'refused',
          icon: 'accepted',
          heading: 'Invitation Already Used',
          description: 'This invitation has already been accepted.',
          backHref: tournamentHref(slug),
        }
      }

    } else {
      return {
        status: 'refused',
        icon: 'required',
        heading: 'Invitation Required',
        description: 'This tournament requires an invitation. Please use the link from your invite email or text.',
        backHref: tournamentHref(slug),
      }
    }
  }

  // Already registered as participant → send to hub
  // (admins with isParticipant=false should still be able to register)
  if (user) {
    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    })
    if (existing?.isParticipant) return { status: 'redirect', href: tournamentHref(slug) }
  }

  // Player limit enforcement based on tier
  const tier = await getTournamentTier(tournament.id)
  const maxPlayers = TIER_LIMITS[tier].maxPlayers
  if (tournament._count.players >= maxPlayers) {
    return {
      status: 'refused',
      icon: 'full',
      heading: 'Tournament Full',
      description: `This tournament has reached the ${maxPlayers}-player limit for its current plan. The organizer can upgrade to allow more players.`,
      backHref: tournamentHref(slug),
    }
  }

  // Fetch user's profile handicap to use as default
  const userProfile = user
    ? await prisma.playerProfile.findUnique({
        where: { userId: user.id },
        select: { handicap: true },
      })
    : null

  return {
    status: 'ready',
    tournamentId: tournament.id,
    maxPlayers,
    profileHandicap: userProfile?.handicap ?? 0,
  }
}

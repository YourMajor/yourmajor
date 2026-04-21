import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { TournamentMessage } from '@/components/ui/tournament-message'
import { Lock, ShieldX, ShieldCheck, Mail, Users } from 'lucide-react'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const token = sp.token ?? null

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect(`/auth/login?next=/${slug}/register${token ? `?token=${token}` : ''}`)

  const [tournament, dbUser] = await Promise.all([
    prisma.tournament.findUnique({
      where: { slug },
      include: {
        _count: { select: { players: true } },
      },
    }),
    getUser(),
  ])

  if (!tournament) return null

  // Registration is closed if: admin manually closed it, or tournament is completed
  if (tournament.status === 'COMPLETED' || tournament.registrationClosed) {
    return (
      <TournamentMessage
        icon={Lock}
        heading="Registration Closed"
        description={tournament.status === 'COMPLETED'
          ? 'This tournament has been completed. Registration is no longer available.'
          : 'Registration is currently closed. Contact the tournament admin if you need to register.'}
        backHref={`/${slug}`}
      />
    )
  }

  // Invite-only: require valid token or matching email
  let resolvedToken = token
  if (!tournament.isOpenRegistration) {
    if (token) {
      // Validate the provided token
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        select: { id: true, acceptedAt: true, tournamentId: true },
      })

      if (!invitation || invitation.tournamentId !== tournament.id) {
        return (
          <TournamentMessage
            icon={ShieldX}
            heading="Invalid Invitation"
            description="This invitation link is invalid or has expired."
            backHref={`/${slug}`}
          />
        )
      }

      if (invitation.acceptedAt) {
        return (
          <TournamentMessage
            icon={ShieldCheck}
            heading="Invitation Already Used"
            description="This invitation has already been accepted."
            backHref={`/${slug}`}
          />
        )
      }

    } else if (dbUser?.email) {
      // No token — check if the user's email matches a pending invitation
      const emailInvitation = await prisma.invitation.findFirst({
        where: {
          tournamentId: tournament.id,
          email: dbUser.email,
          acceptedAt: null,
        },
        select: { token: true },
      })

      if (emailInvitation) {
        resolvedToken = emailInvitation.token
      } else {
        return (
          <TournamentMessage
            icon={Mail}
            heading="Invitation Required"
            description="This tournament requires an invitation. Please use the link from your invite email."
            backHref={`/${slug}`}
          />
        )
      }
    } else {
      return (
        <TournamentMessage
          icon={Mail}
          heading="Invitation Required"
          description="This tournament requires an invitation. Please use the link from your invite email."
          backHref={`/${slug}`}
        />
      )
    }
  }

  // Already registered as participant → redirect to hub
  // (admins with isParticipant=false should still be able to register)
  if (dbUser) {
    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: dbUser.id } },
    })
    if (existing?.isParticipant) redirect(`/${slug}`)
  }

  // Player limit enforcement based on tier
  const tier = await getTournamentTier(tournament.id)
  const maxPlayers = TIER_LIMITS[tier].maxPlayers
  if (tournament._count.players >= maxPlayers) {
    return (
      <TournamentMessage
        icon={Users}
        heading="Tournament Full"
        description={`This tournament has reached the ${maxPlayers}-player limit for its current plan. The organizer can upgrade to allow more players.`}
        backHref={`/${slug}`}
      />
    )
  }

  // Fetch user's profile handicap to use as default
  const userProfile = dbUser
    ? await prisma.playerProfile.findUnique({
        where: { userId: dbUser.id },
        select: { handicap: true },
      })
    : null
  const profileHandicap = userProfile?.handicap ?? 0

  // Register inside a transaction with an atomic count re-check to prevent
  // race conditions where two users pass the above limit check simultaneously.
  const registered = await prisma.$transaction(async (tx) => {
    const freshCount = await tx.tournamentPlayer.count({
      where: { tournamentId: tournament.id },
    })
    if (freshCount >= maxPlayers) return false

    await tx.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: dbUser!.id } },
      create: { tournamentId: tournament.id, userId: dbUser!.id, handicap: profileHandicap, isParticipant: true },
      update: { isParticipant: true },
    })

    if (resolvedToken) {
      await tx.invitation.updateMany({
        where: { token: resolvedToken, tournamentId: tournament.id, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: dbUser!.id },
      })
    }

    return true
  })

  if (!registered) {
    return (
      <TournamentMessage
        icon={Users}
        heading="Tournament Full"
        description={`This tournament has reached the ${maxPlayers}-player limit for its current plan. The organizer can upgrade to allow more players.`}
        backHref={`/${slug}`}
      />
    )
  }

  redirect(`/${slug}`)
}

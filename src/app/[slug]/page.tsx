export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getLeaderboard } from '@/lib/scoring'
import { maybeAutoAdvanceStatus } from '@/lib/tournament-status'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'
import { TournamentStats } from '@/components/leaderboard/TournamentStats'
import { TournamentHeaderBlock } from '@/components/leaderboard/TournamentHeaderBlock'
import { RegistrationBanner } from '@/components/RegistrationBanner'
import { UpgradeSuccessBanner } from '@/components/UpgradeSuccessBanner'
import { SponsorStrip } from '@/components/hub/SponsorStrip'
import { TeeTimeTile } from '@/components/hub/TeeTimeTile'

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ upgraded?: string }>
}) {
  const { slug } = await params
  const { upgraded } = await searchParams

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { course: { select: { holes: { select: { id: true } } } } },
      },
    },
  })
  if (!tournament) return null

  // Leagues land on the season dashboard by default
  if (tournament.isLeague) {
    redirect(`/${slug}/season`)
  }

  const user = await getUser()

  const membership = user
    ? await prisma.tournamentPlayer.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
        select: { isAdmin: true, isParticipant: true, id: true },
      })
    : null

  let isAdmin = membership?.isAdmin ?? false
  if (!isAdmin && user?.role === 'ADMIN') isAdmin = true
  const isRegistered = !!membership?.isParticipant

  const effectiveStatus = await maybeAutoAdvanceStatus(
    tournament.id,
    tournament.status,
    tournament.rounds,
    tournament.startDate,
    tournament.endDate,
    tournament.isLeague,
    tournament.tournamentType,
    tournament.leagueEndDate,
  )

  const initialStandings = await getLeaderboard(tournament.id)
  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)
  const roundIds = tournament.rounds.map((r) => r.id)

  // Fetch attack stats for superlatives (if powerups enabled)
  let attackStats: { playerName: string; count: number }[] = []
  if (tournament.powerupsEnabled) {
    const attacks = await prisma.playerPowerup.groupBy({
      by: ['targetPlayerId'],
      where: {
        tournamentPlayer: { tournamentId: tournament.id },
        status: 'USED',
        targetPlayerId: { not: null },
      },
      _count: { id: true },
    })
    if (attacks.length > 0) {
      const targetIds = attacks.map((a) => a.targetPlayerId!).filter(Boolean)
      const players = await prisma.tournamentPlayer.findMany({
        where: { id: { in: targetIds } },
        include: { user: { select: { name: true } } },
      })
      const playerMap = new Map(players.map((p) => [p.id, p.user.name ?? 'Player']))
      attackStats = attacks.map((a) => ({
        playerName: playerMap.get(a.targetPlayerId!) ?? 'Player',
        count: a._count.id,
      }))
    }
  }

  // Player progress for scoring CTA
  const holesPerRound = tournament.rounds[0]?.course?.holes?.length ?? 18
  const totalHoles = holesPerRound * roundNumbers.length
  let currentPlayerHolesPlayed = 0
  if (membership?.id) {
    const standing = initialStandings.find((s) => s.tournamentPlayerId === membership.id)
    currentPlayerHolesPlayed = standing?.holesPlayed ?? 0
  }

  const canScore = isRegistered && effectiveStatus === 'ACTIVE' && currentPlayerHolesPlayed < totalHoles

  // Fetch group assignment for "My Tee Time" card
  // Show until the player has started scoring (holesPlayed > 0)
  let myGroup: { name: string; teeTime: Date | null; startingHole: number | null; memberNames: string[] } | null = null
  if (membership?.id && effectiveStatus !== 'COMPLETED' && currentPlayerHolesPlayed === 0) {
    const gm = await prisma.tournamentGroupMember.findUnique({
      where: { tournamentPlayerId: membership.id },
      include: {
        group: {
          include: {
            members: {
              include: { tournamentPlayer: { include: { user: { select: { name: true, email: true } } } } },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    })
    if (gm) {
      myGroup = {
        name: gm.group.name,
        teeTime: gm.group.teeTime,
        startingHole: gm.group.startingHole,
        memberNames: gm.group.members.map((m) => m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email),
      }
    }
  }

  let inviteToken: string | null = null
  if (user && !isRegistered && !tournament.isOpenRegistration && effectiveStatus === 'REGISTRATION') {
    const orConditions = [
      ...(user.email ? [{ email: user.email }] : []),
      ...(user.phone ? [{ phone: user.phone }] : []),
    ]
    const invitation = orConditions.length > 0
      ? await prisma.invitation.findFirst({
          where: {
            tournamentId: tournament.id,
            acceptedAt: null,
            OR: orConditions,
          },
          select: { token: true },
        })
      : null
    inviteToken = invitation?.token ?? null
  }

  // Look up defending champion (from most recent parent tournament)
  let defendingChampionPlayerId: string | null = null
  if (tournament.parentTournamentId) {
    const parent = await prisma.tournament.findUnique({
      where: { id: tournament.parentTournamentId },
      select: { championUserId: true },
    })
    if (parent?.championUserId) {
      const champMembership = await prisma.tournamentPlayer.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: parent.championUserId } },
        select: { id: true },
      })
      defendingChampionPlayerId = champMembership?.id ?? null
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {upgraded === 'true' && <UpgradeSuccessBanner slug={slug} />}

      {/* Registration + tee time — paired in a row so they don't dominate the page,
          and both hide once the player enters live scoring. */}
      {(() => {
        const isRegisteredPreScoring =
          !!membership?.isParticipant && currentPlayerHolesPlayed === 0 && effectiveStatus !== 'COMPLETED'
        const banner = (
          <RegistrationBanner
            slug={slug}
            isParticipant={membership?.isParticipant ?? false}
            isLoggedIn={!!user}
            status={effectiveStatus}
            startDate={tournament.startDate?.toISOString() ?? null}
            canRegister={tournament.isOpenRegistration || tournament.tournamentType !== 'INVITE' || !!inviteToken}
            inviteToken={inviteToken}
            registrationClosed={tournament.registrationClosed}
            currentPlayerHolesPlayed={currentPlayerHolesPlayed}
          />
        )
        if (isRegisteredPreScoring && myGroup) {
          return (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {banner}
              <TeeTimeTile myGroup={myGroup} />
            </div>
          )
        }
        return <div className="mb-6">{banner}</div>
      })()}

      <TournamentHeaderBlock
        name={tournament.name}
        description={tournament.description}
        logo={tournament.logo}
        startDate={tournament.startDate}
        endDate={tournament.endDate}
        status={effectiveStatus}
      />

      <SponsorStrip tournamentId={tournament.id} />

      <LiveLeaderboard
        initialData={initialStandings}
        tournamentId={tournament.id}
        roundNumbers={roundNumbers}
        roundIds={roundIds}
        slug={slug}
        status={effectiveStatus}
        handicapSystem={tournament.handicapSystem}
        defendingChampionPlayerId={defendingChampionPlayerId}
        startDate={tournament.startDate?.toISOString() ?? null}
        isRegistered={isRegistered}
        scoringCta={canScore ? {
          label: currentPlayerHolesPlayed > 0 ? 'Continue Scoring' : 'Enter Scores',
          href: `/${slug}/play`,
          holesPlayed: currentPlayerHolesPlayed,
          totalHoles,
        } : undefined}
      />

      <TournamentStats
        standings={initialStandings}
        roundNumbers={roundNumbers}
        powerupsEnabled={tournament.powerupsEnabled}
        attackStats={attackStats}
      />
    </main>
  )
}

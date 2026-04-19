export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getLeaderboard } from '@/lib/scoring'
import { maybeAutoAdvanceStatus } from '@/lib/tournament-status'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'
import { TournamentStats } from '@/components/leaderboard/TournamentStats'
import { RegistrationBanner } from '@/components/RegistrationBanner'

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

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

  const user = await getUser()

  const membership = user
    ? await prisma.tournamentPlayer.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
        select: { isAdmin: true, isParticipant: true, id: true },
      })
    : null

  const isRegistered = !!membership?.isParticipant

  const effectiveStatus = await maybeAutoAdvanceStatus(
    tournament.id,
    tournament.status,
    tournament.rounds,
    tournament.startDate,
    tournament.endDate,
  )

  const initialStandings = await getLeaderboard(tournament.id)
  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)

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

  // Invite token for invite-only tournaments
  let inviteToken: string | null = null
  if (user && !isRegistered && !tournament.isOpenRegistration && effectiveStatus === 'REGISTRATION') {
    const invitation = await prisma.invitation.findFirst({
      where: { tournamentId: tournament.id, email: user.email, acceptedAt: null },
      select: { token: true },
    })
    inviteToken = invitation?.token ?? null
  }

  // Defending champion
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

  // Attack stats
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <RegistrationBanner
        slug={slug}
        isParticipant={membership?.isParticipant ?? false}
        isLoggedIn={!!user}
        status={effectiveStatus}
        startDate={tournament.startDate?.toISOString() ?? null}
        canRegister={tournament.isOpenRegistration || !!inviteToken}
        inviteToken={inviteToken}
        registrationDeadline={tournament.registrationDeadline?.toISOString() ?? null}
      />

      {myGroup && (
        <div className="mb-6 rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 bg-[var(--color-primary)]/5 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Your Tee Time</p>
          </div>
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-foreground">{myGroup.name}</p>
              {myGroup.teeTime && (
                <p className="text-sm font-bold text-foreground">
                  {new Date(myGroup.teeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>
            {myGroup.startingHole && (
              <p className="text-xs text-muted-foreground">Starting on Hole {myGroup.startingHole}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {myGroup.memberNames.map((name, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50">{name}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <LiveLeaderboard
        initialData={initialStandings}
        tournamentId={tournament.id}
        roundNumbers={roundNumbers}
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

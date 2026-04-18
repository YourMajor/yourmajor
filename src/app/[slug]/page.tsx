export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getLeaderboard } from '@/lib/scoring'
import { maybeAutoAdvanceStatus } from '@/lib/tournament-status'
import { LiveLeaderboard } from '@/components/leaderboard/LiveLeaderboard'
import { TournamentStats } from '@/components/leaderboard/TournamentStats'
import { buttonVariants } from '@/components/ui/button-variants'
import Link from 'next/link'

export default async function TournamentPage({
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
        select: { isAdmin: true, id: true },
      })
    : null

  let isAdmin = membership?.isAdmin ?? false
  if (!isAdmin && user?.role === 'ADMIN') isAdmin = true
  const isRegistered = !!membership

  const effectiveStatus = await maybeAutoAdvanceStatus(
    tournament.id,
    tournament.status,
    tournament.rounds,
    tournament.startDate,
    tournament.endDate,
  )

  const initialStandings = await getLeaderboard(tournament.id)
  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)

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

  // Check if the user has a pending invitation (for invite-only tournaments)
  let inviteToken: string | null = null
  if (user && !isRegistered && !tournament.isOpenRegistration && effectiveStatus === 'REGISTRATION') {
    const invitation = await prisma.invitation.findFirst({
      where: {
        tournamentId: tournament.id,
        email: user.email,
        acceptedAt: null,
      },
      select: { token: true },
    })
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
      {/* Registration CTA — open registration or invite-only with matching email */}
      {!isRegistered && user && effectiveStatus === 'REGISTRATION' &&
        (tournament.isOpenRegistration || inviteToken) && (
        <div className="mb-6 p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Join this tournament</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inviteToken ? "You've been invited. Sign up to compete." : 'Registration is open. Sign up to compete.'}
            </p>
          </div>
          <Link
            href={`/${slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`}
            className={buttonVariants({ size: 'sm' }) + ' shrink-0 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}
          >
            Register
          </Link>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground">
          {tournament.name}
        </h1>
        {tournament.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{tournament.description}</p>
        )}
        {tournament.startDate && (
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {tournament.endDate ? ` \u2013 ${new Date(tournament.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </p>
        )}
      </div>

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

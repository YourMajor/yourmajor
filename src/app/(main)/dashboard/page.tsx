import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'

import { PlusCircle, Trophy, Clock, MapPin, Repeat } from 'lucide-react'
import NearbyTournaments from '@/components/NearbyTournaments'
import { FindTournament } from '@/components/FindTournament'
import { DashboardInfoCard } from '@/components/DashboardInfoCard'
import { TournamentCard } from '@/components/TournamentCard'
import { DashboardHero } from '@/components/dashboard/DashboardHero'

export default async function DashboardPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  // Fetch profile + memberships + invitations + round counts in parallel
  const [profile, memberships, pendingInvitations, standaloneCount] = await Promise.all([
    prisma.playerProfile.findUnique({ where: { userId: user.id } }),
    prisma.tournamentPlayer.findMany({
      where: { userId: user.id },
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            handicapSystem: true,
            status: true,
            startDate: true,
            endDate: true,
            primaryColor: true,
            accentColor: true,
            logo: true,
            headerImage: true,
            registrationDeadline: true,
            registrationClosed: true,
            isOpenRegistration: true,
            tournamentType: true,
            isLeague: true,
            leagueEndDate: true,
            parentTournamentId: true,
            rounds: {
              select: { course: { select: { name: true, par: true } } },
            },
            _count: { select: { players: true, rounds: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invitation.findMany({
      where: {
        acceptedAt: null,
        OR: [
          { email: user.email },
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            handicapSystem: true,
            status: true,
            startDate: true,
            endDate: true,
            primaryColor: true,
            accentColor: true,
            logo: true,
            headerImage: true,
            registrationDeadline: true,
            registrationClosed: true,
            isOpenRegistration: true,
            tournamentType: true,
            isLeague: true,
            leagueEndDate: true,
            parentTournamentId: true,
            rounds: {
              select: { course: { select: { name: true, par: true } } },
            },
            _count: { select: { players: true, rounds: true } },
          },
        },
      },
    }),
    prisma.standaloneRound.count({ where: { userId: user.id } }),
  ])

  // Most recent tournament round this user scored in
  const mostRecentScore = await prisma.score.findFirst({
    where: { tournamentPlayer: { userId: user.id } },
    orderBy: { submittedAt: 'desc' },
    include: {
      round: {
        include: {
          course: { select: { name: true, par: true } },
          tournament: { select: { name: true, slug: true } },
        },
      },
    },
  })

  // Aggregate gross total + hole count for the most recent tournament round
  let mostRecentRoundGross: number | null = null
  let mostRecentRoundPar: number | null = null
  let mostRecentRoundHoles = 0
  if (mostRecentScore) {
    const roundScores = await prisma.score.findMany({
      where: {
        roundId: mostRecentScore.roundId,
        tournamentPlayer: { userId: user.id },
      },
      include: { hole: { select: { par: true } } },
    })
    mostRecentRoundGross = roundScores.reduce((sum, s) => sum + s.strokes, 0)
    mostRecentRoundPar = roundScores.reduce((sum, s) => sum + (s.hole?.par ?? 4), 0)
    mostRecentRoundHoles = roundScores.length
  }

  // Quick stats for the header
  const tpIds = memberships.map((m) => m.id)
  const tournamentRoundGroups = await prisma.score.groupBy({
    by: ['roundId'],
    where: { tournamentPlayerId: { in: tpIds } },
  })
  const totalRounds = tournamentRoundGroups.length + standaloneCount

  // Scoring average from tournament scores (completed 18-hole rounds)
  let scoringAvg: number | null = null
  if (tpIds.length > 0) {
    const allTournamentScores = await prisma.score.findMany({
      where: { tournamentPlayerId: { in: tpIds } },
      select: { strokes: true, hole: { select: { par: true } }, roundId: true },
    })
    const roundGroups = new Map<string, { strokes: number; par: number }[]>()
    for (const s of allTournamentScores) {
      const list = roundGroups.get(s.roundId) ?? []
      list.push({ strokes: s.strokes, par: s.hole.par })
      roundGroups.set(s.roundId, list)
    }
    const completedRounds = Array.from(roundGroups.values()).filter((r) => r.length >= 18)
    if (completedRounds.length > 0) {
      const roundVsPars = completedRounds.map((r) => r.reduce((sum, s) => sum + (s.strokes - s.par), 0))
      scoringAvg = roundVsPars.reduce((a, b) => a + b, 0) / roundVsPars.length
    }
  }

  // Separate leagues from regular tournaments
  // Show only the most recent event per league chain the user is in
  // Active non-league tournaments
  const activeMemberships = memberships.filter(
    (m) => (m.isAdmin || m.isParticipant)
      && m.tournament.status !== 'COMPLETED'
      && !m.tournament.isLeague
  )

  // For leagues: group by chain, pick the most recent membership per chain
  // We deduplicate by tournament name (league events share the same name)
  const leagueMembershipsByName = new Map<string, typeof memberships[number]>()
  for (const m of memberships) {
    if (!m.tournament.isLeague) continue
    if (!(m.isAdmin || m.isParticipant)) continue
    const existing = leagueMembershipsByName.get(m.tournament.name)
    // Keep the most recently created one (memberships are ordered by createdAt desc)
    if (!existing) {
      leagueMembershipsByName.set(m.tournament.name, m)
    }
  }

  // Active leagues: leagueEndDate hasn't passed yet (or no end date set)
  const now = new Date()
  const activeLeagues = Array.from(leagueMembershipsByName.values()).filter((m) => {
    if (m.tournament.leagueEndDate) {
      return new Date(m.tournament.leagueEndDate) >= now
    }
    return m.tournament.status !== 'COMPLETED'
  })

  // Completed leagues: leagueEndDate has passed or status is COMPLETED
  const completedLeagues = Array.from(leagueMembershipsByName.values()).filter((m) => {
    if (m.tournament.leagueEndDate) {
      return new Date(m.tournament.leagueEndDate) < now
    }
    return m.tournament.status === 'COMPLETED'
  })

  // Pending invitations — show as "Invited" tournaments (exclude already-registered ones)
  const registeredTournamentIds = new Set(memberships.map((m) => m.tournament.id))
  const invitedTournaments = pendingInvitations
    .filter((inv) => !registeredTournamentIds.has(inv.tournament.id) && inv.tournament.status !== 'COMPLETED')
    .map((inv) => ({ tournament: inv.tournament, token: inv.token }))

  const yourTournaments = activeMemberships.slice(0, 5)
  const hasMoreTournaments = activeMemberships.length > 5

  // Tournament history: completed non-league tournaments only (league events hidden, completed leagues shown separately)
  const historyMemberships = memberships.filter(
    (m) => m.tournament.status === 'COMPLETED' && !m.tournament.isLeague
  )
  // Add completed league roots to history
  const historyWithLeagues = [...historyMemberships, ...completedLeagues]

  const handicap = profile?.handicap ?? memberships[0]?.handicap ?? 0
  const displayName = profile?.displayName ?? user.name ?? user.email.split('@')[0]

  const mostRecentIsComplete = mostRecentRoundHoles >= 18
  const mostRecentDiff = (mostRecentRoundGross ?? 0) - (mostRecentRoundPar ?? 0)

  const hasActiveRoundToScore = Boolean(mostRecentScore && !mostRecentIsComplete)

  return (
    <>
    <DashboardHero
      displayName={displayName}
      handicap={Number(handicap)}
      totalRounds={totalRounds}
      scoringAvg={scoringAvg}
      activeTournamentCount={activeMemberships.length + activeLeagues.length}
      hasActiveRoundToScore={hasActiveRoundToScore}
    />

    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-10">
      {/* Most Recent Round */}
      {mostRecentScore && (
        <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: 'var(--accent)' }}>
          <CardContent className="py-2 px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {mostRecentRoundGross !== null && mostRecentRoundPar !== null && (
                  <div className="shrink-0">
                    <span className="text-lg font-bold font-heading leading-none">{mostRecentRoundGross}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">
                      ({mostRecentDiff === 0 ? 'E' : mostRecentDiff > 0 ? `+${mostRecentDiff}` : `${mostRecentDiff}`})
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{mostRecentScore.round.course.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {mostRecentScore.round.tournament.name} · thru {mostRecentRoundHoles}
                  </p>
                </div>
              </div>
              <Link
                href={`/${mostRecentScore.round.tournament.slug}${mostRecentIsComplete ? '' : '/play'}`}
                className={buttonVariants({ variant: mostRecentIsComplete ? 'outline' : 'default', size: 'sm' })}
                style={!mostRecentIsComplete ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : {}}
              >
                {mostRecentIsComplete ? 'View' : 'Resume'}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Tournaments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Your Tournaments</h2>
          </div>
          {hasMoreTournaments && (
            <Link href="/tournaments" className="text-sm text-muted-foreground hover:underline">
              See all
            </Link>
          )}
        </div>
        {yourTournaments.length > 0 || invitedTournaments.length > 0 ? (
          <>
            {yourTournaments.map((m) => (
              <TournamentCard
                key={m.id}
                t={m.tournament}
                showAdmin={m.isAdmin}
                isRegistered
              />
            ))}
            {invitedTournaments.map((inv) => (
              <TournamentCard
                key={`inv-${inv.tournament.id}`}
                t={inv.tournament}
                showAdmin={false}
                inviteToken={inv.token}
              />
            ))}
          </>
        ) : (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="py-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Trophy className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-heading font-semibold text-base">Welcome to YourMajor</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create a tournament, join with a code from a friend, or find an open event near you.
              </p>
              <div className="flex flex-col items-center gap-3 mt-5 w-full max-w-xs">
                <Link
                  href="/tournaments/new"
                  className={buttonVariants({ size: 'lg' }) + ' w-full justify-center text-base'}
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create Tournament
                </Link>
                <FindTournament />
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Your Leagues */}
      {activeLeagues.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Your Leagues</h2>
          </div>
          {activeLeagues.map((m) => (
            <TournamentCard
              key={m.id}
              t={m.tournament}
              showAdmin={m.isAdmin}
              isRegistered
            />
          ))}
        </section>
      )}

      {/* Tournament History */}
      {historyWithLeagues.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Tournament History</h2>
          </div>
          {historyWithLeagues.map((m) => (
            <TournamentCard
              key={m.id}
              t={m.tournament}
              showAdmin={m.isAdmin}
            />
          ))}
        </section>
      )}

      {/* What YourMajor can do */}
      <DashboardInfoCard />

      {/* Open Near You */}
      <div className="section-gold-rule max-w-xs mx-auto" />
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-heading font-semibold text-lg">Open Near You</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Jump into a public tournament at a course near you. Play your round anytime during the event window and see how you stack up against other local golfers.
        </p>
        <NearbyTournaments />
      </section>
    </main>
    </>
  )
}

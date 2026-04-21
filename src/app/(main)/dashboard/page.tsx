import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Trophy, Clock, MapPin, ChevronRight, CalendarClock, Repeat } from 'lucide-react'
import NearbyTournaments from '@/components/NearbyTournaments'
import { TournamentCardMenu } from '@/components/TournamentCardMenu'
import { FindTournament } from '@/components/FindTournament'

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

const HCP_LABEL: Record<string, string> = {
  NONE: 'No Handicap',
  WHS: 'WHS',
  STABLEFORD: 'Stableford',
  CALLAWAY: 'Callaway',
  PEORIA: 'Peoria',
}

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
      where: { email: user.email, acceptedAt: null },
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
  const avatarUrl = profile?.avatar ?? user.image ?? null

  const mostRecentIsComplete = mostRecentRoundHoles >= 18
  const mostRecentDiff = (mostRecentRoundGross ?? 0) - (mostRecentRoundPar ?? 0)

  return (
    <>
    {/* Player header bar — full width */}
    <div className="w-full" style={{ backgroundColor: 'var(--primary)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-0">
        <div className="flex items-center justify-between gap-4">
          <Link href="/profile" className="flex items-center gap-4 group min-w-0">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 border-2 border-white/20 group-hover:border-white/40 transition-colors">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="text-xl font-bold bg-white/20 text-white">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-heading font-bold text-white truncate">{displayName}</h1>
                <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors shrink-0" />
              </div>
              <p className="text-sm text-white/60 mt-0.5 truncate">{user.email}</p>
            </div>
          </Link>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 shrink-0">
            <FindTournament />
            <Link
              href="/tournaments/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Create Tournament</span>
              <span className="sm:hidden">Create</span>
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
          <div className="text-center">
            <p className="text-lg font-heading font-bold text-white">{handicap}</p>
            <p className="text-[11px] text-white/50 uppercase tracking-wide font-semibold">Handicap</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-heading font-bold text-white">{totalRounds}</p>
            <p className="text-[11px] text-white/50 uppercase tracking-wide font-semibold">Rounds</p>
          </div>
          {scoringAvg !== null && (
            <>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-lg font-heading font-bold text-white">
                  {scoringAvg >= 0 ? '+' : ''}{scoringAvg.toFixed(1)}
                </p>
                <p className="text-[11px] text-white/50 uppercase tracking-wide font-semibold">Avg vs Par</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

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
              <p className="font-heading font-semibold text-base">No tournaments yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create your first tournament and invite friends to compete.
              </p>
              <Link
                href="/tournaments/new"
                className={buttonVariants({ size: 'sm' }) + ' mt-4'}
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create Tournament
              </Link>
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

function TournamentCard({
  t,
  showAdmin,
  isRegistered,
  inviteToken,
}: {
  t: {
    id: string
    slug: string
    name: string
    description: string | null
    handicapSystem: string
    status: string
    startDate: Date | null
    endDate: Date | null
    primaryColor: string
    accentColor: string
    logo: string | null
    headerImage: string | null
    registrationDeadline: Date | null
    registrationClosed: boolean
    isOpenRegistration: boolean
    tournamentType: string
    isLeague: boolean
    leagueEndDate: Date | null
    parentTournamentId: string | null
    rounds: { course: { name: string; par: number } }[]
    _count: { players: number; rounds: number }
  }
  showAdmin: boolean
  isRegistered?: boolean
  inviteToken?: string
}) {
  const isInvite = !!inviteToken && !isRegistered
  const canRegister = !isRegistered && !t.registrationClosed && t.status !== 'COMPLETED'

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = t.startDate && t.endDate
    ? `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`
    : t.startDate ? fmtDate(t.startDate) : null

  const courseName = t.rounds[0]?.course?.name
  const coursePar = t.rounds[0]?.course?.par

  return (
    <div className="relative">
      <Link href={`/${t.slug}`} className="block">
        <Card
          className={`hover:shadow-md transition-all cursor-pointer overflow-hidden !py-0 !gap-0${isInvite ? ' ring-2' : ''}`}
          style={isInvite ? { '--tw-ring-color': t.accentColor } as React.CSSProperties : undefined}
        >
          {/* Branded header strip */}
          <div
            className="relative px-3 py-2.5 flex items-center"
            style={{
              background: t.headerImage
                ? `linear-gradient(to top, ${t.primaryColor}ee, ${t.primaryColor}cc), url(${t.headerImage}) center/cover no-repeat`
                : `linear-gradient(135deg, ${t.primaryColor}, ${t.primaryColor}dd)`,
            }}
          >
            {/* Accent stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: t.accentColor }}
            />

            {/* Logo + Name */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logo}
                  alt=""
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shrink-0 border-2"
                  style={{ borderColor: t.accentColor }}
                />
              ) : (
                <div
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-base font-heading font-bold text-white shrink-0 border-2"
                  style={{ backgroundColor: `${t.primaryColor}80`, borderColor: t.accentColor }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-heading font-semibold text-white truncate text-sm sm:text-base">{t.name}</p>
                <p className="text-[11px] text-white/70 truncate">
                  {courseName ? `${courseName} (Par ${coursePar})` : `${t._count.players} player${t._count.players !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Status badge — top right corner */}
            <div className="absolute top-1.5 right-2">
              {isInvite ? (
                <span className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-400/90 text-amber-950">
                  Invited
                </span>
              ) : t.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white bg-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
              ) : t.status !== 'REGISTRATION' ? (
                <span className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-white/20 text-white">
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              ) : null}
            </div>

            {/* Register button — uses <a> to avoid nested <Link> inside outer <Link> */}
            {(canRegister || isInvite) && (
              <a
                href={`/${t.slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 shrink-0 ml-3 inline-flex items-center rounded-md px-3 py-1.5 text-xs font-bold transition-colors bg-white hover:bg-white/90"
                style={{ color: t.primaryColor }}
              >
                {isInvite ? 'Accept Invite' : 'Register'}
              </a>
            )}
          </div>

          {/* Card body */}
          <CardContent className="py-2.5 space-y-1.5">
            {/* Tags — date, players, handicap, rounds */}
            <div className="flex flex-wrap items-center gap-1.5">
              {dateRange && (
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {dateRange}
                </span>
              )}
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {t._count.players} player{t._count.players !== 1 ? 's' : ''}
              </span>
              <span
                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md text-white"
                style={{ backgroundColor: t.primaryColor }}
              >
                {HCP_LABEL[t.handicapSystem] ?? t.handicapSystem}
              </span>
              {t._count.rounds > 0 && (
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {t._count.rounds} round{t._count.rounds !== 1 ? 's' : ''}
                </span>
              )}
              {t.registrationClosed && t.status !== 'COMPLETED' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  <CalendarClock className="w-3 h-3" />
                  Closed
                </span>
              )}
            </div>

            {/* Description */}
            {t.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Admin menu — bottom right of card */}
      {showAdmin && (
        <div className="absolute bottom-1.5 right-1.5 z-20">
          <TournamentCardMenu
            slug={t.slug}
            tournamentId={t.id}
            tournamentName={t.name}
            showRenew={t.status === 'COMPLETED'}
          />
        </div>
      )}
    </div>
  )
}

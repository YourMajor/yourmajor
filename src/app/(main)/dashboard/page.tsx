import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Trophy, Clock, MapPin, ChevronRight, CalendarClock } from 'lucide-react'
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
            isOpenRegistration: true,
            tournamentType: true,
            _count: { select: { players: true } },
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
            isOpenRegistration: true,
            tournamentType: true,
            _count: { select: { players: true } },
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

  // Active tournaments you're part of (admin or registered player; completed ones go to history)
  const activeMemberships = memberships.filter((m) => (m.isAdmin || m.isParticipant) && m.tournament.status !== 'COMPLETED')

  // Pending invitations — show as "Invited" tournaments (exclude already-registered ones)
  const registeredTournamentIds = new Set(memberships.map((m) => m.tournament.id))
  const invitedTournaments = pendingInvitations
    .filter((inv) => !registeredTournamentIds.has(inv.tournament.id) && inv.tournament.status !== 'COMPLETED')
    .map((inv) => ({ tournament: inv.tournament, token: inv.token }))

  const yourTournaments = activeMemberships.slice(0, 5)
  const hasMoreTournaments = activeMemberships.length > 5
  const historyMemberships = memberships.filter((m) => m.tournament.status === 'COMPLETED')

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
          <div className="flex items-center gap-2 shrink-0">
            <FindTournament />
            <Link
              href="/tournaments/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
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
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Most Recent Round</p>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                mostRecentIsComplete
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {mostRecentIsComplete ? 'Completed' : `${mostRecentRoundHoles}/18 holes`}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-base">{mostRecentScore.round.course.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {mostRecentScore.round.tournament.name} · {new Date(mostRecentScore.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {mostRecentRoundGross !== null && mostRecentRoundPar !== null && (
                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-bold font-heading">{mostRecentRoundGross}</p>
                    <p className="text-sm text-muted-foreground">
                      {mostRecentDiff === 0 ? 'E' : mostRecentDiff > 0 ? `+${mostRecentDiff}` : `${mostRecentDiff}`} thru {mostRecentRoundHoles}
                    </p>
                  </div>
                )}
                <Link
                  href={`/${mostRecentScore.round.tournament.slug}${mostRecentIsComplete ? '' : '/play'}`}
                  className={buttonVariants({ variant: mostRecentIsComplete ? 'outline' : 'default', size: 'sm' })}
                  style={!mostRecentIsComplete ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : {}}
                >
                  {mostRecentIsComplete ? 'View' : 'Resume'}
                </Link>
              </div>
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

      {/* Tournament History */}
      {historyMemberships.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Tournament History</h2>
          </div>
          {historyMemberships.map((m) => (
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
    isOpenRegistration: boolean
    tournamentType: string
    _count: { players: number }
  }
  showAdmin: boolean
  isRegistered?: boolean
  inviteToken?: string
}) {
  const isInvite = !!inviteToken && !isRegistered
  const regOpen = t.status === 'REGISTRATION' || (t.status === 'ACTIVE' && (t.isOpenRegistration || t.tournamentType !== 'INVITE'))
  const deadlinePassed = t.registrationDeadline && new Date() > new Date(t.registrationDeadline)
  const canRegister = !isRegistered && regOpen && !deadlinePassed

  return (
    <div className="relative">
      <Link href={`/${t.slug}`} className="block rounded-lg bg-card text-sm text-card-foreground shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        {/* Status tag — top left */}
        <div className="absolute top-0 left-0 z-10">
          {isInvite ? (
            <span className="inline-flex items-center rounded-br-lg rounded-tl-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
              Invited
            </span>
          ) : t.status === 'ACTIVE' ? (
            <span className="inline-flex items-center gap-1.5 rounded-br-lg rounded-tl-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white bg-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          ) : (
            <span className={`inline-flex items-center rounded-br-lg rounded-tl-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              t.status === 'REGISTRATION'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-muted text-muted-foreground'
            }`}>
              {STATUS_LABEL[t.status] ?? t.status}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row">
          {/* Left: tournament info */}
          <div className="w-full sm:w-1/2 min-w-0 px-4 sm:px-6 py-4 flex flex-col justify-center">
            <div className="flex items-center gap-3 min-w-0 pt-3">
              {t.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-lg font-heading font-bold truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t._count.players} player{t._count.players !== 1 ? 's' : ''}
                  {t.startDate ? ` · ${new Date(t.startDate).toLocaleDateString()}` : ''}
                  {` · ${HCP_LABEL[t.handicapSystem] ?? t.handicapSystem}`}
                </p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 sm:line-clamp-2">{t.description}</p>
                )}
              </div>
            </div>
            {/* Registration deadline + action */}
            <div className="flex items-center justify-between gap-2 mt-2 pt-1">
              {t.registrationDeadline && t.status === 'REGISTRATION' && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="w-3 h-3 shrink-0" />
                  {deadlinePassed
                    ? 'Registration closed'
                    : `Register by ${new Date(t.registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              )}
              {!t.registrationDeadline && !isRegistered && !canRegister && t.status !== 'COMPLETED' && t.tournamentType === 'INVITE' && !isInvite && (
                <p className="text-[11px] text-muted-foreground">Registration closed</p>
              )}
              <span className="flex-1" />
              {(canRegister || isInvite) && (
                <Link
                  href={`/${t.slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
                  style={{ backgroundColor: t.primaryColor }}
                >
                  Register
                </Link>
              )}
            </div>
          </div>

          {/* Right: header image */}
          <div className="relative w-full sm:w-1/2 min-h-[80px] sm:min-h-[100px]">
            {t.headerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.headerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${t.primaryColor}, ${t.accentColor})` }}
              >
                <span className="text-white/15 text-5xl font-heading font-bold select-none">
                  {t.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Admin menu — outside Card to avoid overflow clipping */}
      {showAdmin && (
        <div className="absolute top-1.5 right-1.5 z-20">
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

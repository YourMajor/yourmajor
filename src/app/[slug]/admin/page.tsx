import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Users,
  Calendar,
  Globe,
  Lock,
  Hash,
  Trophy,
  Crown,
  Mail,
  ListChecks,
  Activity,
  CalendarCheck,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import { CopyJoinCode } from './CopyJoinCode'
import { QuickAddPlayer } from './QuickAddPlayer'
import { AnnouncementForm } from './AnnouncementForm'
import { GoLiveButton } from '@/components/admin/GoLiveButton'
import { RegistrationToggle } from './setup/RegistrationToggle'
import { DraftPowerupsCard } from './DraftPowerupsCard'
import { revalidatePath } from 'next/cache'
import { getLeagueEvents, getLeagueRootId } from '@/lib/league-events'
import { listAnnouncements } from '@/lib/league-announcements'
import { getSeasonStandings } from '@/lib/season-standings'
import { getLatestEventRecap } from '@/lib/season-recap'

async function toggleRegistration(tournamentId: string) {
  'use server'
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { registrationClosed: true, slug: true } })
  if (!t) return
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { registrationClosed: !t.registrationClosed },
  })
  revalidatePath(`/${t.slug}/admin`)
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  REGISTRATION: { label: 'Registration', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-200' },
  ACTIVE: { label: 'Live', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200' },
  COMPLETED: { label: 'Completed', bg: 'text-muted-foreground bg-muted', text: 'text-foreground' },
}

const SCORING_METHOD_LABELS: Record<string, string> = {
  POINTS: 'Points table',
  STROKE_AVG: 'Stroke average',
  BEST_OF_N: 'Best of N events',
  STABLEFORD_CUMULATIVE: 'Cumulative Stableford',
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      _count: { select: { players: true, rounds: true, groups: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { course: { select: { name: true } } },
      },
    },
  })

  if (!tournament) return null

  const statusCfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.REGISTRATION
  const isLeagueChain = tournament.isLeague || !!tournament.parentTournamentId
  const showAdminControls =
    tournament.status === 'REGISTRATION' &&
    tournament.tournamentType !== 'PUBLIC' &&
    !tournament.isLeague

  // ── Per-tournament metrics (run in parallel) ──────────────────────────────
  const [participantCount, scoreCount, assignedPlayerCount, latestActivity] = await Promise.all([
    prisma.tournamentPlayer.count({ where: { tournamentId: tournament.id, isParticipant: true } }),
    prisma.score.count({ where: { round: { tournamentId: tournament.id } } }),
    prisma.tournamentGroupMember.count({ where: { group: { tournamentId: tournament.id } } }),
    prisma.score.findFirst({
      where: { round: { tournamentId: tournament.id } },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    }),
  ])

  const expectedScores = tournament.rounds.length * 18 * Math.max(1, participantCount)
  const scorePct = expectedScores > 0 ? Math.min(100, Math.round((scoreCount / expectedScores) * 100)) : 0
  const groupCoverage =
    participantCount > 0 ? Math.min(100, Math.round((assignedPlayerCount / participantCount) * 100)) : 0

  // ── League metrics (only when applicable) ─────────────────────────────────
  let league: {
    seasonName: string
    scoringMethodLabel: string
    leagueEndDate: Date | null
    eventsTotal: number
    eventsCompleted: number
    eventsActive: number
    eventsUpcoming: number
    rosterTotal: number
    rosterActive: number
    leader: { name: string; userId: string; value: string } | null
    latestRecap: { name: string; date: string | null; winner: string | null; slug: string } | null
    latestAnnouncement: { subject: string; sentAt: Date | null; deliveryCount: number; successCount: number } | null
  } | null = null

  if (isLeagueChain) {
    const rootId = (await getLeagueRootId(tournament.id)) ?? tournament.id
    const [leagueEvents, root, rosterCount, rosterActiveCount, standings, recap, announcements] = await Promise.all([
      getLeagueEvents(tournament.id),
      prisma.tournament.findUnique({
        where: { id: rootId },
        select: {
          name: true,
          seasonScoringMethod: true,
          leagueEndDate: true,
        },
      }),
      prisma.leagueRosterMember.count({ where: { roster: { rootTournamentId: rootId } } }),
      prisma.leagueRosterMember.count({ where: { roster: { rootTournamentId: rootId }, status: 'ACTIVE' } }),
      getSeasonStandings(tournament.id).catch(() => null),
      getLatestEventRecap(tournament.id).catch(() => null),
      listAnnouncements(tournament.id).catch(() => []),
    ])

    const eventsCompleted = leagueEvents.filter((e) => e.status === 'COMPLETED').length
    const eventsActive = leagueEvents.filter((e) => e.status === 'ACTIVE').length
    const eventsUpcoming = leagueEvents.filter((e) => e.status === 'REGISTRATION').length
    const leader = standings && standings.standings.length > 0 ? standings.standings[0] : null

    league = {
      seasonName: root?.name ?? tournament.name,
      scoringMethodLabel: SCORING_METHOD_LABELS[root?.seasonScoringMethod ?? 'POINTS'] ?? 'Points table',
      leagueEndDate: root?.leagueEndDate ?? null,
      eventsTotal: leagueEvents.length,
      eventsCompleted,
      eventsActive,
      eventsUpcoming,
      rosterTotal: rosterCount,
      rosterActive: rosterActiveCount,
      leader: leader
        ? {
            name: leader.playerName,
            userId: leader.userId,
            value: standings ? formatLeaderValue(leader.value, standings.scoringMethod) : '—',
          }
        : null,
      latestRecap: recap
        ? {
            name: recap.tournamentName,
            date: recap.date,
            winner: recap.winner.name,
            slug: recap.tournamentSlug,
          }
        : null,
      latestAnnouncement: announcements.length > 0
        ? {
            subject: announcements[0].subject,
            sentAt: announcements[0].sentAt,
            deliveryCount: announcements[0].deliveryCount,
            successCount: announcements[0].successCount,
          }
        : null,
    }
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="px-6 py-5" style={{ backgroundColor: 'var(--color-primary)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Admin Overview</p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-white">{tournament.name}</h1>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
          <StatCell icon={Users} label="Participants" value={String(participantCount)} />
          <StatCell icon={Calendar} label="Rounds" value={String(tournament._count.rounds)} />
          <StatCell
            icon={Activity}
            label="Scores"
            value={`${scoreCount}`}
            sub={expectedScores > 0 ? `${scorePct}% of expected` : undefined}
          />
          <StatCell
            icon={tournament.isOpenRegistration ? Globe : Lock}
            label="Registration"
            value={tournament.isOpenRegistration ? 'Open' : 'Invite'}
          />
        </div>
      </div>

      {/* Join Code */}
      {tournament.joinCode && tournament.tournamentType !== 'INVITE' && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
            >
              <Hash className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tournament Code</p>
              <p className="text-lg font-mono font-bold tracking-widest">{tournament.joinCode}</p>
            </div>
          </div>
          <CopyJoinCode code={tournament.joinCode} />
        </div>
      )}

      {/* Tournament Lifecycle (state-changing, kept on Overview) */}
      {showAdminControls && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tournament Lifecycle
          </p>
          <div className="flex flex-col gap-2">
            <RegistrationToggle
              tournamentId={tournament.id}
              registrationClosed={tournament.registrationClosed}
              toggleAction={toggleRegistration}
            />
            {tournament.powerupsEnabled && (
              <DraftPowerupsCard
                label={tournament.distributionMode === 'RANDOM' ? 'Deal Powerups' : 'Draft Powerups'}
                href={`/${slug}/admin/draft`}
              />
            )}
            <GoLiveButton tournamentId={tournament.id} slug={slug} />
          </div>
        </div>
      )}

      {tournament.status === 'ACTIVE' && <QuickAddPlayer tournamentId={tournament.id} />}

      {tournament.status === 'ACTIVE' && <AnnouncementForm tournamentId={tournament.id} />}

      {/* League summary (read-only metrics) */}
      {league ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">League Summary</p>
              <h2 className="text-lg font-heading font-semibold mt-0.5">{league.seasonName}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {league.scoringMethodLabel}
                {league.leagueEndDate && (
                  <> · ends {league.leagueEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                )}
              </p>
            </div>
            <Link
              href={`/${slug}/admin/season`}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
            >
              Manage season <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <MetricCard icon={CalendarCheck} label="Completed" value={String(league.eventsCompleted)} tone="muted" />
            <MetricCard icon={Activity} label="In progress" value={String(league.eventsActive)} tone={league.eventsActive > 0 ? 'green' : 'muted'} />
            <MetricCard icon={CalendarClock} label="Upcoming" value={String(league.eventsUpcoming)} tone="muted" />
            <MetricCard icon={Calendar} label="Total events" value={String(league.eventsTotal)} tone="muted" />
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <Tile
              icon={Users}
              title="Roster"
              primary={`${league.rosterActive} active`}
              secondary={league.rosterTotal !== league.rosterActive ? `${league.rosterTotal} total` : undefined}
            />
            <Tile
              icon={Crown}
              title="Standings leader"
              primary={league.leader ? league.leader.name : 'Pending first results'}
              secondary={league.leader ? league.leader.value : undefined}
            />
            <Tile
              icon={Trophy}
              title="Latest event"
              primary={league.latestRecap ? league.latestRecap.name : 'Awaiting first event'}
              secondary={
                league.latestRecap
                  ? `Won by ${league.latestRecap.winner ?? '—'}${
                      league.latestRecap.date
                        ? ` · ${new Date(league.latestRecap.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        : ''
                    }`
                  : undefined
              }
              href={league.latestRecap ? `/${league.latestRecap.slug}` : undefined}
            />
          </div>

          {league.latestAnnouncement && (
            <Tile
              icon={Mail}
              title="Last announcement"
              primary={league.latestAnnouncement.subject}
              secondary={`${league.latestAnnouncement.successCount}/${league.latestAnnouncement.deliveryCount} delivered${
                league.latestAnnouncement.sentAt
                  ? ` · ${league.latestAnnouncement.sentAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : ''
              }`}
            />
          )}
        </section>
      ) : (
        // Single-tournament dashboard
        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tournament Health</p>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <Tile
              icon={Users}
              title="Group assignments"
              primary={
                tournament._count.groups === 0
                  ? 'No groups yet'
                  : `${assignedPlayerCount}/${participantCount} assigned`
              }
              secondary={
                tournament._count.groups > 0
                  ? `${tournament._count.groups} group${tournament._count.groups === 1 ? '' : 's'} · ${groupCoverage}% coverage`
                  : undefined
              }
              href={`/${slug}/admin/groups`}
            />
            <Tile
              icon={ListChecks}
              title="Score progress"
              primary={expectedScores > 0 ? `${scorePct}% complete` : '—'}
              secondary={`${scoreCount} score${scoreCount === 1 ? '' : 's'} submitted`}
              href={`/${slug}/admin/scores`}
            />
            <Tile
              icon={Activity}
              title="Last activity"
              primary={
                latestActivity
                  ? latestActivity.submittedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : 'No scores yet'
              }
              secondary={tournament.rounds[0]?.course?.name ?? undefined}
            />
          </div>
          {tournament.rounds.length > 0 && (
            <div className="rounded-xl border border-border p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rounds</p>
              <ul className="space-y-1.5">
                {tournament.rounds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground tabular-nums w-12">R{r.roundNumber}</span>
                      <span className="font-medium truncate">{r.course.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {r.date ? new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCell({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="px-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-heading font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: 'muted' | 'green'
}) {
  const toneCls = tone === 'green'
    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    : 'border-border'
  return (
    <div className={`rounded-xl border ${toneCls} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-2xl font-heading font-bold">{value}</p>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">{label}</p>
    </div>
  )
}

function Tile({
  icon: Icon,
  title,
  primary,
  secondary,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  primary: string
  secondary?: string
  href?: string
}) {
  const inner = (
    <div className="rounded-xl border border-border p-4 h-full transition-all hover:border-[var(--color-primary)]/40">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <p className="text-base font-semibold text-foreground truncate">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</p>}
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function formatLeaderValue(value: number, method: string): string {
  if (method === 'STROKE_AVG' || method === 'BEST_OF_N') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)} avg`
  }
  return `${Math.round(value)} pts`
}

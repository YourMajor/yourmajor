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
  PenLine,
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

// Status pills sit on the brand-primary header, so they read against the
// contrast-guarded --primary-foreground rather than a fixed palette.
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  REGISTRATION: { label: 'Registration', cls: 'bg-primary-foreground/15 text-primary-foreground' },
  ACTIVE: { label: 'Live', cls: 'bg-accent text-accent-foreground' },
  COMPLETED: { label: 'Completed', cls: 'bg-primary-foreground/10 text-primary-foreground/70' },
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
    activeEvent: { name: string; slug: string } | null
    nextEvent: { name: string; slug: string } | null
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

    const activeEvents = leagueEvents.filter((e) => e.status === 'ACTIVE')
    const upcomingEvents = leagueEvents.filter((e) => e.status === 'REGISTRATION')
    const eventsCompleted = leagueEvents.filter((e) => e.status === 'COMPLETED').length
    const eventsActive = activeEvents.length
    const eventsUpcoming = upcomingEvents.length
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
      activeEvent: activeEvents[0] ? { name: activeEvents[0].name, slug: activeEvents[0].slug } : null,
      nextEvent: upcomingEvents[0] ? { name: upcomingEvents[0].name, slug: upcomingEvents[0].slug } : null,
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
    <main className="space-y-10">
      {/* Header */}
      <header className="rounded-xl overflow-hidden border border-border">
        <div className="px-6 py-5" style={{ backgroundColor: 'var(--color-primary)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60 mb-1">
            {league ? 'League Admin' : 'Admin Overview'}
          </p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-primary-foreground">{tournament.name}</h1>
            <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          </div>
          {league && (
            <p className="text-xs text-primary-foreground/70 mt-1.5">
              {league.seasonName} · event {league.eventsCompleted + league.eventsActive} of {league.eventsTotal}
            </p>
          )}
        </div>
      </header>

      {/* ── Right now: everything that changes state ─────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Right now</h2>

        {league && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${slug}/admin/season`}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-md text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Trophy className="w-4 h-4" /> Manage season
            </Link>
            {league.activeEvent && (
              <Link
                href={`/${league.activeEvent.slug}/admin/scores`}
                className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                <PenLine className="w-4 h-4" /> Chase scores
              </Link>
            )}
            <Link
              href={`/${slug}/admin/communications`}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              <Mail className="w-4 h-4" /> Send announcement
            </Link>
          </div>
        )}

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

      {showAdminControls && (
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
      )}

      {tournament.status === 'ACTIVE' && <QuickAddPlayer tournamentId={tournament.id} />}

      {tournament.status === 'ACTIVE' && <AnnouncementForm tournamentId={tournament.id} />}
      </section>

      {/* ── Reference: the numbers, nothing to act on ────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</h2>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Stat icon={Users} label="Participants" value={String(participantCount)} figure />
          <Stat icon={Calendar} label="Rounds" value={String(tournament._count.rounds)} figure />
          <Stat
            icon={Activity}
            label="Scores"
            value={String(scoreCount)}
            sub={expectedScores > 0 ? `${scorePct}% of expected` : undefined}
            figure
          />
          <Stat
            icon={tournament.isOpenRegistration ? Globe : Lock}
            label="Registration"
            value={tournament.isOpenRegistration ? 'Open' : 'Invite'}
            figure
          />
        </div>

      {/* League summary (read-only metrics) */}
      {league ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {league.scoringMethodLabel}
            {league.leagueEndDate && (
              <> · ends {league.leagueEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </p>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Stat icon={CalendarCheck} label="Completed" value={String(league.eventsCompleted)} figure href={`/${slug}/admin/season`} />
            <Stat
              icon={Activity}
              label="In progress"
              value={String(league.eventsActive)}
              sub={league.activeEvent?.name}
              figure
              active={league.eventsActive > 0}
              href={league.activeEvent ? `/${league.activeEvent.slug}/admin/scores` : `/${slug}/admin/season`}
            />
            <Stat
              icon={CalendarClock}
              label="Upcoming"
              value={String(league.eventsUpcoming)}
              sub={league.nextEvent?.name}
              figure
              href={`/${slug}/admin/season`}
            />
            <Stat icon={Calendar} label="Total events" value={String(league.eventsTotal)} figure href={`/${slug}/admin/season`} />
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <Stat
              icon={Users}
              label="Roster"
              value={`${league.rosterActive} active`}
              sub={league.rosterTotal !== league.rosterActive ? `${league.rosterTotal} total` : undefined}
              href={`/${slug}/admin/season`}
            />
            <Stat
              icon={Crown}
              label="Standings leader"
              value={league.leader ? league.leader.name : 'Pending first results'}
              sub={league.leader ? league.leader.value : undefined}
              href={`/${slug}/season`}
            />
            <Stat
              icon={Trophy}
              label="Latest event"
              value={league.latestRecap ? league.latestRecap.name : 'Awaiting first event'}
              sub={
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
            <Stat
              icon={Mail}
              label="Last announcement"
              value={league.latestAnnouncement.subject}
              sub={`${league.latestAnnouncement.successCount}/${league.latestAnnouncement.deliveryCount} delivered${
                league.latestAnnouncement.sentAt
                  ? ` · ${league.latestAnnouncement.sentAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : ''
              }`}
              href={`/${slug}/admin/communications`}
            />
          )}
        </div>
      ) : (
        // Single-tournament dashboard
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <Stat
              icon={Users}
              label="Group assignments"
              value={
                tournament._count.groups === 0
                  ? 'No groups yet'
                  : `${assignedPlayerCount}/${participantCount} assigned`
              }
              sub={
                tournament._count.groups > 0
                  ? `${tournament._count.groups} group${tournament._count.groups === 1 ? '' : 's'} · ${groupCoverage}% coverage`
                  : undefined
              }
              href={`/${slug}/admin/groups`}
            />
            <Stat
              icon={ListChecks}
              label="Score progress"
              value={expectedScores > 0 ? `${scorePct}% complete` : '—'}
              sub={`${scoreCount} score${scoreCount === 1 ? '' : 's'} submitted`}
              href={`/${slug}/admin/scores`}
            />
            <Stat
              icon={Activity}
              label="Last activity"
              value={
                latestActivity
                  ? latestActivity.submittedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : 'No scores yet'
              }
              sub={tournament.rounds[0]?.course?.name ?? undefined}
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
        </div>
      )}
      </section>
    </main>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** The one card on this page. `figure` sets a big tabular number instead of a
 *  sentence; `active` tints the card when something is live; `href` makes it a
 *  link with an affordance arrow. */
function Stat({
  icon: Icon,
  label,
  value,
  sub,
  href,
  figure = false,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  href?: string
  figure?: boolean
  active?: boolean
}) {
  const inner = (
    <div
      className={`rounded-xl border p-4 h-full transition-colors ${
        active ? 'border-success/40 bg-success/5' : 'border-border'
      } ${href ? 'hover:border-[var(--color-primary)]/40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        {href && <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />}
      </div>
      <p
        className={
          figure
            ? 'text-2xl font-heading font-bold tabular-data'
            : 'text-base font-semibold text-foreground truncate'
        }
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

function formatLeaderValue(value: number, method: string): string {
  if (method === 'STROKE_AVG' || method === 'BEST_OF_N') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)} avg`
  }
  return `${Math.round(value)} pts`
}

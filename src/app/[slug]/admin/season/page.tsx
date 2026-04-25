export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getOrCreateRoster } from '@/lib/roster-actions'
import { listSeasonAdjustments } from '@/lib/season-standings-actions'
import { getSeasonAttendance, getSeasonAwards, DEFAULT_TIEBREAKERS, parseTiebreakers } from '@/lib/season-standings'
import { SeasonAdminDashboard } from '@/components/season/SeasonAdminDashboard'

export default async function AdminSeasonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, parentTournamentId: true, isLeague: true },
  })
  if (!tournament) return null

  // Find root tournament for season config
  let rootId = tournament.id
  let currentId: string | null = tournament.parentTournamentId
  while (currentId) {
    const parent = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!parent) break
    rootId = parent.id
    currentId = parent.parentTournamentId
  }

  const rootTournament = await prisma.tournament.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      seasonScoringMethod: true,
      seasonBestOf: true,
      seasonPointsTable: true,
      seasonDropLowest: true,
      seasonTiebreakers: true,
      leagueEndDate: true,
    },
  })

  // Get the latest event's course for the schedule form
  let latestId = tournament.id
  let searchIds = [tournament.id]
  for (let i = 0; i < 100; i++) {
    const children = await prisma.tournament.findMany({
      where: { parentTournamentId: { in: searchIds } },
      select: { id: true },
    })
    if (children.length === 0) break
    const ids = children.map((c) => c.id)
    latestId = ids[ids.length - 1]
    searchIds = ids
  }
  const latestEvent = await prisma.tournament.findUnique({
    where: { id: latestId },
    include: {
      rounds: {
        take: 1,
        orderBy: { roundNumber: 'asc' },
        include: { course: { select: { name: true } } },
      },
      _count: { select: { players: true } },
    },
  })

  const [roster, attendance, schedule, adjustments, awards] = await Promise.all([
    getOrCreateRoster(tournament.id),
    getSeasonAttendance(tournament.id),
    prisma.seasonScheduleEvent.findMany({
      where: { tournamentId: rootId },
      orderBy: { date: 'asc' },
      include: {
        rsvps: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    listSeasonAdjustments(tournament.id),
    getSeasonAwards(tournament.id).catch(() => []),
  ])

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Season Management</p>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{tournament.name}</h1>
      </div>

      <SeasonAdminDashboard
        tournamentId={tournament.id}
        roster={roster ? {
          id: roster.id,
          autoAddNew: roster.autoAddNew,
          members: roster.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            status: m.status,
            joinedAt: m.joinedAt.toISOString(),
            name: m.user.profile?.displayName ?? m.user.name ?? m.user.email.split('@')[0],
            email: m.user.email,
            avatar: m.user.profile?.avatar ?? m.user.image ?? null,
            handicap: m.user.profile?.handicap ?? 0,
          })),
        } : null}
        attendance={{
          rows: attendance.rows,
          events: attendance.events,
        }}
        seasonConfig={{
          scoringMethod: rootTournament?.seasonScoringMethod ?? 'POINTS',
          bestOf: rootTournament?.seasonBestOf ?? null,
          pointsTable: (rootTournament?.seasonPointsTable as Record<number, number>) ?? null,
          leagueEndDate: rootTournament?.leagueEndDate?.toISOString().split('T')[0] ?? null,
          dropLowest: rootTournament?.seasonDropLowest ?? null,
          tiebreakers: rootTournament?.seasonTiebreakers
            ? parseTiebreakers(rootTournament.seasonTiebreakers)
            : DEFAULT_TIEBREAKERS,
        }}
        adjustments={adjustments}
        awards={awards}
        schedule={schedule.map((s) => ({
          id: s.id,
          title: s.title,
          date: s.date.toISOString(),
          courseId: s.courseId,
          notes: s.notes,
          rsvps: s.rsvps.map((r) => ({
            userId: r.userId,
            name: r.user.name ?? r.user.email,
            status: r.status,
          })),
        }))}
        leagueInfo={tournament.isLeague ? {
          courseName: latestEvent?.rounds[0]?.course?.name ?? null,
          courseId: latestEvent?.rounds[0]?.courseId ?? null,
          playerCount: latestEvent?._count?.players ?? 0,
          leagueName: tournament.name,
        } : null}
        slug={slug}
      />
    </main>
  )
}

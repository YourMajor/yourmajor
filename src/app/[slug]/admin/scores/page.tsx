import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminScorecardEditor } from '@/components/admin/AdminScorecardEditor'
import { LeagueScoreSelector } from '@/components/admin/LeagueScoreSelector'
import { getLeagueEvents } from '@/lib/league-events'

export default async function AdminScoresPage({
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
        include: {
          course: {
            select: {
              name: true,
              holes: { orderBy: { number: 'asc' }, select: { id: true, number: true, par: true, handicap: true } },
            },
          },
        },
      },
      players: {
        include: {
          user: { select: { name: true, email: true } },
          scores: { select: { roundId: true, holeId: true, strokes: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!tournament) return null

  const isLeagueChain = tournament.isLeague || !!tournament.parentTournamentId
  const leagueEvents = isLeagueChain ? await getLeagueEvents(tournament.id) : []

  const rounds = tournament.rounds.map((r) => ({
    id: r.id,
    roundNumber: r.roundNumber,
    courseName: r.course.name,
    holes: r.course.holes,
  }))

  const players = tournament.players.map((p) => {
    const scoresByRound: Record<string, Record<string, number>> = {}
    for (const s of p.scores) {
      if (!scoresByRound[s.roundId]) scoresByRound[s.roundId] = {}
      scoresByRound[s.roundId][s.holeId] = s.strokes
    }
    return {
      id: p.id,
      name: p.user.name ?? p.user.email.split('@')[0],
      handicap: p.handicap,
      scoresByRound,
    }
  })

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${slug}/admin`} className="hover:text-foreground transition-colors">Admin</Link>
          {' › '}Score Management
        </p>
        <h1 className="text-2xl font-bold font-heading">{tournament.name} — Scores</h1>
      </div>
      {leagueEvents.length > 0 && (
        <LeagueScoreSelector
          events={leagueEvents.map((e) => ({
            id: e.id,
            slug: e.slug,
            name: e.name,
            date: e.date?.toISOString() ?? null,
            status: e.status,
            isCurrent: e.id === tournament.id,
          }))}
        />
      )}
      <AdminScorecardEditor rounds={rounds} players={players} />
    </main>
  )
}

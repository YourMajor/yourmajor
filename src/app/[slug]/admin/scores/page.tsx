import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminScorecardEditor } from '@/components/admin/AdminScorecardEditor'
import { LeagueScoreSelector } from '@/components/admin/LeagueScoreSelector'
import { PlayedPowerupsPanel, type PlayedPowerup } from '@/components/admin/PlayedPowerupsPanel'
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

  // Cards in play, so an admin can take back one a player hit by accident.
  // Scoped by the ACTIVATOR's membership, which is how PlayerPowerup is tied to
  // a tournament (there is no tournamentId column on the row).
  const playedRows = tournament.powerupsEnabled
    ? await prisma.playerPowerup.findMany({
        where: {
          tournamentPlayer: { tournamentId: tournament.id },
          status: { in: ['USED', 'ACTIVE'] },
        },
        select: {
          id: true,
          status: true,
          holeNumber: true,
          targetHoleNumber: true,
          targetPlayerId: true,
          tournamentPlayerId: true,
          scoreModifier: true,
          usedAt: true,
          roundId: true,
          powerup: { select: { name: true, type: true } },
        },
        orderBy: { usedAt: 'desc' },
      })
    : []

  const roundNumberById = new Map(tournament.rounds.map((r) => [r.id, r.roundNumber]))
  const displayName = (u: { name: string | null; email: string }) => u.name ?? u.email.split('@')[0]
  // targetPlayerId is a bare column with no relation on PlayerPowerup, so both
  // names come from the players already loaded above rather than a second query.
  const nameByPlayerId = new Map(tournament.players.map((p) => [p.id, displayName(p.user)]))

  const played: PlayedPowerup[] = playedRows.map((pp) => ({
    playerPowerupId: pp.id,
    powerupName: pp.powerup.name,
    powerupType: pp.powerup.type,
    activatorName: nameByPlayerId.get(pp.tournamentPlayerId) ?? 'Player',
    targetName: pp.targetPlayerId ? nameByPlayerId.get(pp.targetPlayerId) ?? 'Player' : null,
    roundNumber: pp.roundId ? roundNumberById.get(pp.roundId) ?? null : null,
    // An attack's effect lands on the victim's hole, so that is the hole worth
    // showing an admin — the attacker's activation hole says nothing about it.
    holeNumber: pp.powerup.type === 'ATTACK' && pp.targetPlayerId
      ? pp.targetHoleNumber ?? pp.holeNumber
      : pp.holeNumber,
    scoreModifier: pp.scoreModifier,
    status: pp.status,
  }))

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
        <h1 className="text-2xl font-heading">{tournament.name} — Scores</h1>
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
      {tournament.powerupsEnabled && (
        <PlayedPowerupsPanel tournamentId={tournament.id} played={played} />
      )}
    </main>
  )
}

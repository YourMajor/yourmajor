import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PlusCircle, Trophy, Clock, Repeat, Users } from 'lucide-react'
import { TournamentCard } from '@/components/TournamentCard'

const TOURNAMENT_SELECT = {
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
} as const

export default async function TournamentsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const memberships = await prisma.tournamentPlayer.findMany({
    where: { userId: user.id },
    include: { tournament: { select: TOURNAMENT_SELECT } },
    orderBy: { createdAt: 'desc' },
  })

  // Organising / Playing: active non-league tournaments where the user has the role.
  const organising = memberships.filter(
    (m) => m.isAdmin && m.tournament.status !== 'COMPLETED' && !m.tournament.isLeague
  )
  const playing = memberships.filter(
    (m) => !m.isAdmin && m.tournament.status !== 'COMPLETED' && !m.tournament.isLeague
  )

  // Leagues: dedupe by name (league events share a name). Keep the most recent membership per chain.
  const leaguesByName = new Map<string, (typeof memberships)[number]>()
  for (const m of memberships) {
    if (!m.tournament.isLeague) continue
    if (!leaguesByName.has(m.tournament.name)) {
      leaguesByName.set(m.tournament.name, m)
    }
  }
  const now = new Date()
  const activeLeagues = Array.from(leaguesByName.values()).filter((m) => {
    if (m.tournament.leagueEndDate) return new Date(m.tournament.leagueEndDate) >= now
    return m.tournament.status !== 'COMPLETED'
  })
  const completedLeagues = Array.from(leaguesByName.values()).filter((m) => {
    if (m.tournament.leagueEndDate) return new Date(m.tournament.leagueEndDate) < now
    return m.tournament.status === 'COMPLETED'
  })

  // Tournament history: completed non-league tournaments plus completed league roots.
  const completedNonLeague = memberships.filter(
    (m) => m.tournament.status === 'COMPLETED' && !m.tournament.isLeague
  )
  const history = [...completedNonLeague, ...completedLeagues]

  const hasAny =
    history.length > 0 ||
    organising.length > 0 ||
    playing.length > 0 ||
    activeLeagues.length > 0

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Tournaments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your full tournament history and any active events not on your dashboard.
          </p>
        </div>
        <Link href="/tournaments/new">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <PlusCircle className="w-4 h-4" />
            Create
          </Button>
        </Link>
      </div>

      {!hasAny && (
        <Card className="border-dashed border-2 border-border shadow-none">
          <CardContent className="py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-heading font-semibold text-base">No tournaments yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Once you create or join a tournament, your history will live here.
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Tournament History</h2>
          </div>
          {history.map((m) => (
            <TournamentCard
              key={m.id}
              t={m.tournament}
              showAdmin={m.isAdmin}
            />
          ))}
        </section>
      )}

      {organising.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Organising</h2>
          </div>
          {organising.map((m) => (
            <TournamentCard
              key={m.id}
              t={m.tournament}
              showAdmin={m.isAdmin}
              isRegistered
            />
          ))}
        </section>
      )}

      {playing.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-lg">Playing</h2>
          </div>
          {playing.map((m) => (
            <TournamentCard
              key={m.id}
              t={m.tournament}
              showAdmin={false}
              isRegistered
            />
          ))}
        </section>
      )}

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
    </main>
  )
}

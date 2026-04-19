import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScorecardDetail } from '@/components/scorecard/ScorecardDetail'

export default async function PlayerScorecardPage({
  params,
}: {
  params: Promise<{ slug: string; tournamentPlayerId: string }>
}) {
  const { slug, tournamentPlayerId } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { id: tournamentPlayerId },
    include: {
      user: { select: { name: true, email: true, image: true } },
      scores: {
        include: {
          hole: { select: { number: true, par: true, handicap: true } },
          round: { select: { roundNumber: true, course: { select: { name: true, par: true } } } },
        },
        orderBy: [{ round: { roundNumber: 'asc' } }, { hole: { number: 'asc' } }],
      },
    },
  })

  if (!player) return null

  const profile = await prisma.playerProfile.findUnique({
    where: { userId: player.userId },
    select: { avatar: true },
  })
  const avatarUrl = profile?.avatar ?? player.user.image ?? null

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: { rounds: { orderBy: { roundNumber: 'asc' }, include: { course: { select: { name: true, par: true, holes: { select: { number: true, par: true, handicap: true }, orderBy: { number: 'asc' } } } } } } },
  })
  if (!tournament) return null

  const playerName = player.user.name ?? player.user.email.split('@')[0]

  // Fetch powerup score modifiers (used powerups affect net score)
  const usedPowerups = await prisma.playerPowerup.findMany({
    where: { tournamentPlayerId: player.id, status: 'USED', scoreModifier: { not: null } },
    select: { scoreModifier: true, roundId: true },
  })
  const totalPowerupModifier = usedPowerups.reduce((sum, pp) => sum + (pp.scoreModifier ?? 0), 0)

  // Group scores by round number
  const scoresByRound: Record<number, typeof player.scores> = {}
  for (const score of player.scores) {
    const rn = score.round.roundNumber
    if (!scoresByRound[rn]) scoresByRound[rn] = []
    scoresByRound[rn].push(score)
  }

  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)
  const roundCourseMap = new Map(tournament.rounds.map((r) => [r.roundNumber, r.course]))
  const roundDateMap = new Map(tournament.rounds.map((r) => [r.roundNumber, r.date]))
  const isSingleRound = roundNumbers.length === 1
  const defaultTab = String(roundNumbers[0] ?? 1)

  return (
    <main className="w-full px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; {tournament.name}
        </Link>
      </div>

      <div className="flex items-end gap-5 mb-8">
        <Avatar className="size-28 sm:size-36 shrink-0 border-4" style={{ borderColor: 'var(--color-primary)' }}>
          {avatarUrl && <AvatarImage src={avatarUrl} alt={playerName} />}
          <AvatarFallback className="text-5xl sm:text-6xl font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
            {playerName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold">{playerName}</h1>
          <p className="text-base font-semibold text-muted-foreground mt-1">Handicap {player.handicap}</p>
        </div>
      </div>

      {roundNumbers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rounds configured yet.</p>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {roundNumbers.map((rn) => {
              const course = roundCourseMap.get(rn)
              const roundDate = roundDateMap.get(rn)
              let label: string
              if (isSingleRound) {
                const datePart = roundDate ? new Date(roundDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
                label = datePart && course ? `${datePart} - ${course.name}` : datePart ?? (course ? course.name : `Round ${rn}`)
              } else {
                const datePart = roundDate ? new Date(roundDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
                const parts = [`Round ${rn}`, datePart, course?.name].filter(Boolean)
                label = parts.join(' - ')
              }
              return (
                <TabsTrigger key={rn} value={String(rn)}>
                  {label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {roundNumbers.map((rn) => {
            const roundScores = scoresByRound[rn] ?? []
            const course = roundCourseMap.get(rn)
            return (
              <TabsContent key={rn} value={String(rn)} className="mt-4">
                {roundScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No scores posted for Round {rn}.</p>
                ) : (
                  <ScorecardDetail
                    scores={roundScores.map((s) => ({
                      holeNumber: s.hole.number,
                      par: s.hole.par,
                      strokes: s.strokes,
                      handicapIndex: s.hole.handicap,
                      putts: s.putts,
                      fairwayHit: s.fairwayHit,
                      gir: s.gir,
                    }))}
                    handicap={player.handicap}
                    playerName={playerName}
                    avatarUrl={avatarUrl}
                    handicapSystem={tournament.handicapSystem}
                    courseName={course?.name}
                    coursePar={course?.par ?? undefined}
                    courseHoles={course?.holes?.map((h) => ({ number: h.number, par: h.par, handicap: h.handicap }))}
                    powerupModifier={totalPowerupModifier}
                  />
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </main>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button-variants'
import { TournamentMessage } from '@/components/ui/tournament-message'
import { LiveScoring } from '@/components/scorecard/live/LiveScoring'
import { Clock, Swords, AlertCircle } from 'lucide-react'

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ round?: string }>
}) {
  const { slug } = await params
  const { round } = await searchParams

  const user = await getUser()
  if (!user) redirect(`/auth/login?next=/${slug}/play`)

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          course: {
            include: {
              holes: {
                orderBy: { number: 'asc' },
                include: {
                  yardages: {
                    take: 1,
                    orderBy: { yards: 'desc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!tournament) return null

  if (tournament.status !== 'ACTIVE') {
    return (
      <TournamentMessage
        icon={Clock}
        heading="Round Not Open"
        description="Score entry is only available during an active tournament."
        backHref={`/${slug}`}
      />
    )
  }

  const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
  })

  if (!tournamentPlayer) {
    redirect(`/${slug}/register`)
  }

  // Gate: when powerups enabled, block scoring until powerups are distributed
  if (tournament.powerupsEnabled) {
    const playerPowerupCount = await prisma.playerPowerup.count({
      where: { tournamentPlayerId: tournamentPlayer.id },
    })
    if (playerPowerupCount === 0) {
      return (
        <TournamentMessage
          icon={Swords}
          heading="Powerups Not Ready"
          description="Powerups must be drafted or dealt before scoring can begin. Check with the tournament admin or visit the draft page."
          backHref={`/${slug}`}
        >
          <Link
            href={`/${slug}/draft`}
            className={buttonVariants({ size: 'sm' }) + ' bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}
          >
            Go to Draft
          </Link>
        </TournamentMessage>
      )
    }
  }

  // Select round (default to first)
  const selectedRoundNumber = round ? parseInt(round) : (tournament.rounds[0]?.roundNumber ?? 1)
  const selectedRound = tournament.rounds.find((r) => r.roundNumber === selectedRoundNumber)

  if (!selectedRound) {
    return (
      <TournamentMessage
        icon={AlertCircle}
        heading="No Rounds Configured"
        description="No rounds have been set up for this tournament yet."
        backHref={`/${slug}`}
      />
    )
  }

  // Existing scores for this player + round
  const existingScores = await prisma.score.findMany({
    where: { tournamentPlayerId: tournamentPlayer.id, roundId: selectedRound.id },
    select: { holeId: true, strokes: true, fairwayHit: true, gir: true, putts: true },
  })

  // Player's tee assignment for this round
  const playerTee = await prisma.roundPlayerTee.findUnique({
    where: {
      roundId_tournamentPlayerId: {
        roundId: selectedRound.id,
        tournamentPlayerId: tournamentPlayer.id,
      },
    },
    include: {
      teeOption: {
        include: {
          yardages: {
            where: {
              holeId: { in: selectedRound.course.holes.map((h) => h.id) },
            },
          },
        },
      },
    },
  })

  // Build yardage map from player's specific tee
  const teeYardageMap: Record<string, number> = {}
  if (playerTee) {
    for (const y of playerTee.teeOption.yardages) {
      teeYardageMap[y.holeId] = y.yards
    }
  }

  const holes = selectedRound.course.holes.map((h) => ({
    id: h.id,
    number: h.number,
    par: h.par,
    handicap: h.handicap,
    yards: teeYardageMap[h.id] ?? h.yardages[0]?.yards ?? null,
  }))

  // Fetch player powerups, attacks received, and tournament players
  const [playerPowerups, attacksReceived, tournamentPlayers] = await Promise.all([
    tournament.powerupsEnabled
      ? prisma.playerPowerup.findMany({
          where: { tournamentPlayerId: tournamentPlayer.id },
          select: {
            id: true,
            powerupId: true,
            status: true,
            holeNumber: true,
            roundId: true,
            scoreModifier: true,
            metadata: true,
            powerup: {
              select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
            },
          },
        })
      : [],
    tournament.powerupsEnabled
      ? prisma.playerPowerup.findMany({
          where: {
            targetPlayerId: tournamentPlayer.id,
            status: 'USED',
            roundId: selectedRound.id,
          },
          select: {
            id: true,
            holeNumber: true,
            scoreModifier: true,
            powerup: {
              select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
            },
            tournamentPlayer: {
              select: { user: { select: { name: true } } },
            },
          },
        })
      : [],
    tournament.powerupsEnabled
      ? prisma.tournamentPlayer.findMany({
          where: { tournamentId: tournament.id },
          select: { id: true, user: { select: { name: true } } },
        })
      : [],
  ])

  return (
    <LiveScoring
      tournamentPlayerId={tournamentPlayer.id}
      roundId={selectedRound.id}
      holes={holes}
      existingScores={existingScores}
      courseName={selectedRound.course.name}
      courseLatitude={selectedRound.course.latitude}
      courseLongitude={selectedRound.course.longitude}
      powerupsEnabled={tournament.powerupsEnabled}
      teeName={playerTee?.teeOption.name}
      teeColor={playerTee?.teeOption.color ?? undefined}
      backHref={`/${slug}`}
      backLabel={tournament.name}
      playerName={user.name ?? user.email.split('@')[0]}
      tournamentId={tournament.id}
      tournamentPlayerId2={tournamentPlayer.id}
      playerPowerups={playerPowerups as any}
      attacksReceived={attacksReceived as any}
      tournamentPlayers={tournamentPlayers as any}
    />
  )
}

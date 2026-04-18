import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { buttonVariants } from '@/components/ui/button-variants'
import { TournamentMessage } from '@/components/ui/tournament-message'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { PowerupCard } from '@/components/draft/PowerupCard'
import { computeCurrentTurn } from '@/lib/draft-utils'
import { Swords, Clock, Target } from 'lucide-react'
import type { PowerupCardData } from '@/components/draft/PowerupCard'

interface Player {
  id: string
  user: { name: string | null; image: string | null }
}

interface DraftPick {
  pickNumber: number
  powerupId: string
  powerup: PowerupCardData
  tournamentPlayer: Player
}

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect(`/auth/login?next=/${slug}/draft`)

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      powerupsEnabled: true,
      powerupsPerPlayer: true,
      maxAttacksPerPlayer: true,
      distributionMode: true,
      primaryColor: true,
      accentColor: true,
    },
  })
  if (!tournament || !tournament.powerupsEnabled) {
    return (
      <TournamentMessage
        icon={Swords}
        heading="Powerups Not Enabled"
        description="Powerups are not enabled for this tournament."
        backHref={`/${slug}`}
      />
    )
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    select: { id: true, isAdmin: true },
  })
  if (!player) redirect(`/${slug}/register`)

  const isAdmin = player.isAdmin || user.role === 'ADMIN'

  // If RANDOM distribution — show the player their cards (or "waiting" if not dealt yet)
  if (tournament.distributionMode === 'RANDOM') {
    const myPowerups = await prisma.playerPowerup.findMany({
      where: { tournamentPlayerId: player.id },
      include: {
        powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
      },
    })

    if (myPowerups.length === 0) {
      return (
        <TournamentMessage
          icon={Clock}
          heading="Powerups"
          description="Waiting for the tournament admin to deal powerups..."
          variant="waiting"
          backHref={`/${slug}`}
        />
      )
    }

    return (
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold">Your Powerups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {myPowerups.length} card{myPowerups.length !== 1 ? 's' : ''} dealt to you
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {myPowerups.map((pp) => (
            <PowerupCard
              key={pp.id}
              powerup={pp.powerup as PowerupCardData}
              state={pp.status === 'USED' ? 'used' : 'owned'}
              size="md"
            />
          ))}
        </div>
      </main>
    )
  }

  // DRAFT mode
  const draft = await prisma.draft.findUnique({
    where: { tournamentId: tournament.id },
    include: {
      picks: {
        orderBy: { pickNumber: 'asc' },
        include: {
          powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
          tournamentPlayer: {
            select: { id: true, user: { select: { name: true, image: true } } },
          },
        },
      },
    },
  })

  if (!draft) {
    return (
      <TournamentMessage
        icon={Target}
        heading="No Draft Yet"
        description="No draft has been set up yet."
        backHref={`/${slug}`}
      >
        {isAdmin && (
          <Link href={`/${slug}/admin/draft`} className={buttonVariants({ variant: 'outline' })}>
            Set Up Draft
          </Link>
        )}
      </TournamentMessage>
    )
  }

  if (draft.status === 'PENDING') {
    return (
      <TournamentMessage
        icon={Clock}
        heading="Powerup Draft"
        description="Waiting for the admin to set the draft order and start the draft..."
        variant="waiting"
        backHref={`/${slug}`}
      >
        {isAdmin && (
          <Link
            href={`/${slug}/admin/draft`}
            className={buttonVariants({ size: 'sm' }) + ' bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}
          >
            Set Order &amp; Start Draft
          </Link>
        )}
      </TournamentMessage>
    )
  }

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const tournamentPowerups = await prisma.tournamentPowerup.findMany({
    where: { tournamentId: tournament.id },
    include: {
      powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
    },
  })

  const pickedIds = new Set(draft.picks.map((p) => p.powerupId))
  const availablePowerups = tournamentPowerups
    .filter((tp) => !pickedIds.has(tp.powerupId))
    .map((tp) => tp.powerup as PowerupCardData)

  const draftOrder = (draft.draftOrder as string[]) ?? []
  const currentTurn = computeCurrentTurn(
    draftOrder,
    draft.format,
    draft.currentPick,
    tournament.powerupsPerPlayer,
  )

  const rootStyle: Record<string, string> = {}
  if (tournament.primaryColor) rootStyle['--color-primary'] = tournament.primaryColor
  if (tournament.accentColor) rootStyle['--color-accent'] = tournament.accentColor

  return (
    <main
      className="max-w-5xl mx-auto px-1 sm:px-2 py-6 space-y-4"
      style={rootStyle}
    >
      <div className="text-center">
        <h1 className="text-2xl font-heading font-bold">{tournament.name} — Powerup Draft</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {draft.format} draft &middot; {tournament.powerupsPerPlayer} picks per player
        </p>
      </div>

      <DraftBoard
        tournamentId={tournament.id}
        currentPlayerId={player.id}
        initialState={{
          draft: {
            id: draft.id,
            format: draft.format,
            status: draft.status,
            draftOrder,
            currentPick: draft.currentPick,
            picks: draft.picks as unknown as DraftPick[],
          },
          currentTurn,
          availablePowerups,
          players: players as unknown as Player[],
          powerupsPerPlayer: tournament.powerupsPerPlayer,
          maxAttacksPerPlayer: tournament.maxAttacksPerPlayer,
        }}
      />
    </main>
  )
}

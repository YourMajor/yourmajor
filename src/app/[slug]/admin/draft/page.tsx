import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { DraftAdmin } from '@/components/draft/DraftAdmin'
import { computeCurrentTurn } from '@/lib/draft-utils'
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

export default async function AdminDraftPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect(`/auth/login?next=/${slug}/admin/draft`)

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      powerupsEnabled: true,
      powerupsPerPlayer: true,
      maxAttacksPerPlayer: true,
      distributionMode: true,
    },
  })
  if (!tournament || !tournament.powerupsEnabled) return null

  // Verify admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    select: { id: true, isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') redirect(`/${slug}`)

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: tournament.id },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

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

  // Available powerups
  const tournamentPowerups = await prisma.tournamentPowerup.findMany({
    where: { tournamentId: tournament.id },
    include: {
      powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
    },
  })

  const pickedIds = new Set(draft?.picks.map((p) => p.powerupId) ?? [])
  const availablePowerups = tournamentPowerups
    .filter((tp) => !pickedIds.has(tp.powerupId))
    .map((tp) => tp.powerup as PowerupCardData)

  const draftOrder = (draft?.draftOrder as string[] | null) ?? []
  const currentTurn = draft
    ? computeCurrentTurn(
        draftOrder,
        draft.format,
        draft.currentPick,
        tournament.powerupsPerPlayer,
      )
    : null

  const draftData = draft
    ? {
        id: draft.id,
        format: draft.format,
        status: draft.status,
        draftOrder,
        currentPick: draft.currentPick,
        picks: draft.picks as unknown as DraftPick[],
      }
    : null

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${slug}/admin`} className="hover:text-foreground transition-colors">Admin</Link>
          {' › '}Powerup Draft
        </p>
        <h1 className="text-2xl font-heading font-bold">Manage Draft</h1>
      </div>

      <DraftAdmin
        tournamentId={tournament.id}
        currentPlayerId={membership!.id}
        draft={draftData}
        distributionMode={tournament.distributionMode}
        players={players as unknown as Player[]}
        availablePowerups={availablePowerups}
        powerupsPerPlayer={tournament.powerupsPerPlayer}
        maxAttacksPerPlayer={tournament.maxAttacksPerPlayer}
        currentTurn={currentTurn}
      />
    </main>
  )
}

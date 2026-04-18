import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { computeCurrentTurn } from '@/lib/draft-utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, powerupsPerPlayer: true, maxAttacksPerPlayer: true, distributionMode: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  const draft = await prisma.draft.findUnique({
    where: { tournamentId },
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

  // For RANDOM distribution mode, no draft record exists
  if (!draft) {
    return NextResponse.json({ draft: null, distributionMode: tournament.distributionMode })
  }

  // All tournament powerups (the pool)
  const tournamentPowerups = await prisma.tournamentPowerup.findMany({
    where: { tournamentId },
    include: {
      powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
    },
  })

  // Tournament players
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Compute whose turn it is
  const draftOrder = (draft.draftOrder as string[] | null) ?? []
  const currentTurn = computeCurrentTurn(
    draftOrder,
    draft.format,
    draft.currentPick,
    tournament.powerupsPerPlayer,
  )

  // Available powerups (not yet picked)
  const pickedPowerupIds = new Set(draft.picks.map((p) => p.powerupId))
  const availablePowerups = tournamentPowerups
    .filter((tp) => !pickedPowerupIds.has(tp.powerupId))
    .map((tp) => tp.powerup)

  return NextResponse.json({
    draft: {
      id: draft.id,
      format: draft.format,
      timing: draft.timing,
      status: draft.status,
      draftOrder,
      currentPick: draft.currentPick,
      picks: draft.picks,
    },
    currentTurn,
    availablePowerups,
    players,
    powerupsPerPlayer: tournament.powerupsPerPlayer,
    maxAttacksPerPlayer: tournament.maxAttacksPerPlayer,
    distributionMode: tournament.distributionMode,
  })
}

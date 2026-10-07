import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

/**
 * GET /api/tournaments/[id]/powerups/active
 * Returns all ACTIVE variable powerups for the current player with metadata.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayerId: player.id,
      // ARMED as well as ACTIVE: this is the recovery path LiveScoring hits
      // when an activation's HTTP response was lost, and without it an arming
      // that actually landed would be invisible to the client for good.
      status: { in: ['ACTIVE', 'ARMED'] },
    },
    include: {
      powerup: {
        select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
      },
    },
  })

  return NextResponse.json({ activePowerups })
}

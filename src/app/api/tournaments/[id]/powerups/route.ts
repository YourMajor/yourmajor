import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const powerups = await prisma.playerPowerup.findMany({
    where: { tournamentPlayerId: player.id },
    include: {
      powerup: {
        select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
      },
    },
    orderBy: { powerup: { type: 'asc' } },
  })

  // Also get attacks received against this player
  const attacksReceived = await prisma.playerPowerup.findMany({
    where: {
      targetPlayerId: player.id,
      status: 'USED',
    },
    include: {
      powerup: {
        select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
      },
      tournamentPlayer: {
        select: { user: { select: { name: true } } },
      },
    },
  })

  return NextResponse.json({ powerups, attacksReceived })
}

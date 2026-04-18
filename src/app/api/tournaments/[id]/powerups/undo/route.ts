import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { playerPowerupId } = await req.json() as { playerPowerupId: string }

  if (!playerPowerupId) {
    return NextResponse.json({ error: 'playerPowerupId is required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Powerup not found' }, { status: 404 })
  if (playerPowerup.tournamentPlayerId !== player.id) {
    return NextResponse.json({ error: 'Not your powerup' }, { status: 403 })
  }
  if (playerPowerup.status !== 'USED' && playerPowerup.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Powerup is not currently in use' }, { status: 400 })
  }

  // Revert the powerup back to AVAILABLE
  const updated = await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      status: 'AVAILABLE',
      usedAt: null,
      roundId: null,
      holeNumber: null,
      scoreModifier: null,
      targetPlayerId: null,
      metadata: undefined,
    },
  })

  return NextResponse.json({ status: updated.status })
}

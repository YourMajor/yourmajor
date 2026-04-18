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
  const { playerPowerupId, scoreModifier } = await req.json() as {
    playerPowerupId: string
    scoreModifier: number
  }

  if (!playerPowerupId || scoreModifier === undefined) {
    return NextResponse.json({ error: 'playerPowerupId and scoreModifier required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (playerPowerup.tournamentPlayerId !== player.id) {
    return NextResponse.json({ error: 'Not your powerup' }, { status: 403 })
  }
  if (playerPowerup.status !== 'USED') {
    return NextResponse.json({ error: 'Powerup must be used before resolving' }, { status: 400 })
  }

  const updated = await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { scoreModifier },
  })

  return NextResponse.json(updated)
}

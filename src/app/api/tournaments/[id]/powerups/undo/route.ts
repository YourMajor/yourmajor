import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getUser } from '@/lib/auth'
import { broadcastNotification } from '@/lib/notification-broadcast'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const parsed = await parseBody(req, z.object({ playerPowerupId: z.string().min(1) }))
  if (!parsed.ok) return parsed.response
  const { playerPowerupId } = parsed.data

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
    include: { powerup: { select: { name: true } } },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Powerup not found' }, { status: 404 })
  if (playerPowerup.tournamentPlayerId !== player.id) {
    return NextResponse.json({ error: 'Not your powerup' }, { status: 403 })
  }
  if (playerPowerup.status !== 'USED' && playerPowerup.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Powerup is not currently in use' }, { status: 400 })
  }

  // Captured before the reset nulls them out.
  const { targetPlayerId, usedAt } = playerPowerup

  // Revert the powerup back to AVAILABLE
  const updated = await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      status: 'AVAILABLE',
      usedAt: null,
      roundId: null,
      holeNumber: null,
      targetHoleNumber: null,
      scoreModifier: null,
      targetPlayerId: null,
      // DbNull, not undefined — Prisma reads `undefined` as "leave this field
      // alone", so variable-powerup metadata used to survive the undo.
      metadata: Prisma.DbNull,
    },
  })

  // Activation writes three side effects the client can see. Reverting the row
  // alone left the target with a permanent "you were attacked" notification and
  // the tournament chat with a permanent attack announcement.
  if (targetPlayerId) {
    await prisma.notification.deleteMany({
      where: {
        tournamentPlayerId: targetPlayerId,
        type: 'ATTACK_RECEIVED',
        payload: { path: ['playerPowerupId'], equals: playerPowerupId },
      },
    })
    // Without this the recipient's NotificationPopup keeps showing the deleted
    // notification until they refetch. Same channel activate broadcasts on.
    // Awaited with the delete it announces so it can't be lost to a freeze.
    await broadcastNotification(targetPlayerId).catch(() => {})
  }

  if (usedAt) {
    // ponytail: matches the system message by content, not an FK — renaming a
    // powerup between activate and undo leaves the line. Add a PlayerPowerup
    // relation on TournamentMessage if that ever matters.
    await prisma.tournamentMessage.updateMany({
      where: {
        tournamentId,
        userId: user.id,
        isSystem: true,
        deletedAt: null,
        createdAt: { gte: usedAt },
        content: { contains: playerPowerup.powerup.name },
      },
      data: { deletedAt: new Date(), deletedBy: user.id },
    })
  }

  return NextResponse.json({ status: updated.status })
}

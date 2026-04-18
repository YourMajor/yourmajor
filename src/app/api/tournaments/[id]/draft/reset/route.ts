import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  // Verify admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const draft = await prisma.draft.findUnique({
    where: { tournamentId },
    include: { picks: { select: { powerupId: true, tournamentPlayerId: true } } },
  })
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (draft.status === 'PENDING') {
    return NextResponse.json({ error: 'Draft is already in setup state' }, { status: 400 })
  }

  const pickedPowerupIds = draft.picks.map((p) => p.powerupId)
  const pickedPlayerIds = [...new Set(draft.picks.map((p) => p.tournamentPlayerId))]

  await prisma.$transaction(async (tx) => {
    // Delete all draft picks
    await tx.draftPick.deleteMany({ where: { draftId: draft.id } })

    // Delete only AVAILABLE PlayerPowerups that were created by the draft
    if (pickedPowerupIds.length > 0) {
      await tx.playerPowerup.deleteMany({
        where: {
          tournamentPlayerId: { in: pickedPlayerIds },
          powerupId: { in: pickedPowerupIds },
          status: 'AVAILABLE',
        },
      })
    }

    // Reset draft to PENDING, keep draftOrder intact
    await tx.draft.update({
      where: { tournamentId },
      data: { status: 'PENDING', currentPick: 0 },
    })
  })

  return NextResponse.json({ status: 'PENDING' })
}

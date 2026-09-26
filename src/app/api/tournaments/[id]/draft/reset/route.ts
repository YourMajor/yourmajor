import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'

/**
 * Reset the live draft — the one for Draft.currentRound — back to setup.
 *
 * Only that round's picks are removed, along with the unused cards they
 * granted. Earlier rounds' drafts are finished history: their picks and any
 * cards players are still holding from them are left alone.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const draft = await prisma.draft.findUnique({ where: { tournamentId } })
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (draft.status === 'PENDING') {
    return NextResponse.json({ error: 'Draft is already in setup state' }, { status: 400 })
  }

  const roundPicks = await prisma.draftPick.findMany({
    where: { draftId: draft.id, tournamentRound: draft.currentRound },
    select: { id: true, powerupId: true, tournamentPlayerId: true },
  })
  const pickIds = roundPicks.map((p) => p.id)

  await prisma.$transaction(async (tx) => {
    // Cards linked to this round's picks. Used cards stay: they already
    // changed a score and removing them would rewrite the leaderboard.
    if (pickIds.length > 0) {
      await tx.playerPowerup.deleteMany({
        where: { draftPickId: { in: pickIds }, status: 'AVAILABLE' },
      })
    }

    // Picks from before cards were linked to picks (draftPickId NULL) can only
    // exist in round 1, where each card was drafted at most once, so matching
    // on (player, powerup) is exact there.
    if (draft.currentRound === 1 && roundPicks.length > 0) {
      await tx.playerPowerup.deleteMany({
        where: {
          draftPickId: null,
          status: 'AVAILABLE',
          OR: roundPicks.map((p) => ({
            tournamentPlayerId: p.tournamentPlayerId,
            powerupId: p.powerupId,
          })),
        },
      })
    }

    await tx.draftPick.deleteMany({ where: { id: { in: pickIds } } })

    // Back to PENDING for the same round; draftOrder is kept.
    await tx.draft.update({
      where: { tournamentId },
      data: { status: 'PENDING', currentPick: 0, turnStartedAt: null },
    })
  })

  return NextResponse.json({ status: 'PENDING', currentRound: draft.currentRound })
}

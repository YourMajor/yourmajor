import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { canPickPowerup } from '@/lib/draft-utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pickId: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId, pickId } = await params
  const { powerupId: newPowerupId } = (await req.json()) as { powerupId: string }
  if (!newPowerupId) {
    return NextResponse.json({ error: 'powerupId is required' }, { status: 400 })
  }

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pick = await tx.draftPick.findUnique({
        where: { id: pickId },
        include: {
          draft: {
            select: {
              id: true,
              tournamentId: true,
              picks: {
                include: { powerup: { select: { type: true } } },
              },
              tournament: {
                select: { maxAttacksPerPlayer: true },
              },
            },
          },
          powerup: { select: { id: true, type: true } },
        },
      })

      if (!pick) throw new Error('Pick not found.')
      if (pick.draft.tournamentId !== tournamentId) {
        throw new Error('Pick does not belong to this tournament.')
      }

      if (pick.powerupId === newPowerupId) {
        // No-op swap; bail early so we don't trip the "already picked" guard
        return { ok: true, unchanged: true as const, pick }
      }

      const newPowerup = await tx.powerup.findUnique({
        where: { id: newPowerupId },
        select: { id: true, type: true },
      })
      if (!newPowerup) throw new Error('Replacement powerup not found.')

      // Block override if the player has already activated/used this card.
      // The PlayerPowerup row that mirrors this DraftPick is matched on
      // (tournamentPlayerId, current powerupId).
      const playerPowerup = await tx.playerPowerup.findFirst({
        where: {
          tournamentPlayerId: pick.tournamentPlayerId,
          powerupId: pick.powerupId,
        },
      })
      if (!playerPowerup) {
        throw new Error('No matching PlayerPowerup record for this pick.')
      }
      if (playerPowerup.status !== 'AVAILABLE') {
        throw new Error(
          'Cannot change a pick that has already been activated or used in scoring.',
        )
      }

      // Build a pick history that EXCLUDES the pick being edited so the
      // attack-budget and "already picked" checks treat the swap correctly.
      const history = pick.draft.picks
        .filter((p) => p.id !== pick.id)
        .map((p) => ({
          tournamentPlayerId: p.tournamentPlayerId,
          powerupType: p.powerup.type as 'BOOST' | 'ATTACK',
          powerupId: p.powerupId,
        }))

      const validation = canPickPowerup(
        history,
        pick.tournamentPlayerId,
        newPowerup.id,
        newPowerup.type as 'BOOST' | 'ATTACK',
        pick.draft.tournament.maxAttacksPerPlayer,
      )
      if (!validation.allowed) throw new Error(validation.reason)

      const updatedPick = await tx.draftPick.update({
        where: { id: pick.id },
        data: { powerupId: newPowerupId },
        include: {
          powerup: {
            select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
          },
          tournamentPlayer: {
            select: { id: true, user: { select: { name: true, image: true } } },
          },
        },
      })

      await tx.playerPowerup.update({
        where: { id: playerPowerup.id },
        data: { powerupId: newPowerupId },
      })

      return { ok: true, unchanged: false as const, pick: updatedPick }
    })

    return NextResponse.json(result)
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Conflict: another pick already uses this powerup.' },
        { status: 409 },
      )
    }
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

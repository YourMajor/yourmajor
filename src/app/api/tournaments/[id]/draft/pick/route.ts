import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { computeCurrentTurn, canPickPowerup } from '@/lib/draft-utils'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { powerupId } = await req.json() as { powerupId: string }

  if (!powerupId) {
    return NextResponse.json({ error: 'powerupId is required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { powerupsPerPlayer: true, maxAttacksPerPlayer: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  // Use a transaction for atomicity
  try {
    const result = await prisma.$transaction(async (tx) => {
      const draft = await tx.draft.findUnique({
        where: { tournamentId },
        include: {
          picks: {
            include: { powerup: { select: { type: true } } },
          },
        },
      })

      if (!draft) throw new Error('No draft found for this tournament.')
      if (draft.status !== 'ACTIVE') throw new Error('The draft is not active yet.')

      const draftOrder = draft.draftOrder as string[]
      const currentTurn = computeCurrentTurn(
        draftOrder,
        draft.format,
        draft.currentPick,
        tournament.powerupsPerPlayer,
      )

      if (!currentTurn) throw new Error('The draft is already complete.')
      if (currentTurn.tournamentPlayerId !== player.id) {
        throw new Error("It's not your turn to pick.")
      }

      // Validate pick
      const powerup = await tx.powerup.findUnique({ where: { id: powerupId } })
      if (!powerup) throw new Error('That powerup no longer exists.')

      const pickData = draft.picks.map((p) => ({
        tournamentPlayerId: p.tournamentPlayerId,
        powerupType: p.powerup.type as 'BOOST' | 'ATTACK',
        powerupId: p.powerupId,
      }))

      const validation = canPickPowerup(
        pickData,
        player.id,
        powerupId,
        powerup.type,
        tournament.maxAttacksPerPlayer,
      )
      if (!validation.allowed) throw new Error(validation.reason)

      // Create the pick
      const pick = await tx.draftPick.create({
        data: {
          draftId: draft.id,
          tournamentPlayerId: player.id,
          powerupId,
          pickNumber: draft.currentPick + 1,
        },
        include: {
          powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
          tournamentPlayer: {
            select: { id: true, user: { select: { name: true, image: true } } },
          },
        },
      })

      // Create PlayerPowerup record
      await tx.playerPowerup.create({
        data: {
          tournamentPlayerId: player.id,
          powerupId,
          status: 'AVAILABLE',
        },
      })

      // Advance the draft
      const newPickCount = draft.currentPick + 1
      const totalNeeded = draftOrder.length * tournament.powerupsPerPlayer
      const isComplete = newPickCount >= totalNeeded

      await tx.draft.update({
        where: { tournamentId },
        data: {
          currentPick: newPickCount,
          status: isComplete ? 'COMPLETED' : 'ACTIVE',
        },
      })

      // Notify next player (if draft continues)
      if (!isComplete) {
        const nextTurn = computeCurrentTurn(
          draftOrder,
          draft.format,
          newPickCount,
          tournament.powerupsPerPlayer,
        )
        if (nextTurn) {
          await tx.notification.create({
            data: {
              tournamentPlayerId: nextTurn.tournamentPlayerId,
              type: 'DRAFT_YOUR_TURN',
              payload: {
                pickNumber: nextTurn.pickNumber,
                message: "It's your turn to pick a powerup!",
              },
            },
          })
        }
      } else {
        // Notify all that draft is complete
        const allPlayers = await tx.tournamentPlayer.findMany({
          where: { tournamentId },
          select: { id: true },
        })
        await tx.notification.createMany({
          data: allPlayers.map((p) => ({
            tournamentPlayerId: p.id,
            type: 'DRAFT_COMPLETED' as const,
            payload: { message: 'The powerup draft is complete!' },
          })),
        })
      }

      return { pick, isComplete, newPickCount }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import type { Prisma } from '@/generated/prisma/client'
import { canPickPowerup, computeCurrentTurn } from './draft-utils'

export interface ExecutePickInput {
  draftId: string
  tournamentPlayerId: string
  powerupId: string
  /**
   * Optimistic-concurrency guard. Pass `Draft.currentPick` as observed
   * before this call; the conditional update only commits if no other pick
   * landed in between. If `null`, no guard is applied (caller has alternative
   * serialization, e.g. admin actions outside the turn flow).
   */
  expectedCurrentPick: number | null
}

export interface ExecutePickResult {
  pick: {
    id: string
    pickNumber: number
    powerupId: string
    tournamentPlayerId: string
    powerup: {
      id: string
      slug: string
      name: string
      type: 'BOOST' | 'ATTACK'
      description: string
      effect: unknown
    }
    tournamentPlayer: {
      id: string
      user: { name: string | null; image: string | null }
    }
  }
  isComplete: boolean
  newPickCount: number
  /** userId of the next picker, if any (for off-app push) */
  nextPickerUserId: string | null
  /** tournamentPlayerId of the next picker, if any (for in-app notification) */
  nextPickerTournamentPlayerId: string | null
}

/**
 * Atomically record one draft pick.
 *
 * Caller is responsible for any auth/turn-membership check before invoking.
 * This function validates structural constraints (draft active, attack budget,
 * powerup not already picked, it's actually `tournamentPlayerId`'s turn) and
 * advances the draft using optimistic concurrency control.
 *
 * Throws on validation failure. Catches `P2002` at the route layer for the
 * `(draftId, pickNumber)` race-loser case and returns a clean 409.
 */
export async function executePick(
  tx: Prisma.TransactionClient,
  input: ExecutePickInput,
): Promise<ExecutePickResult> {
  const { draftId, tournamentPlayerId, powerupId, expectedCurrentPick } = input

  const draft = await tx.draft.findUnique({
    where: { id: draftId },
    include: {
      picks: {
        include: { powerup: { select: { type: true } } },
      },
      tournament: {
        select: { powerupsPerPlayer: true, maxAttacksPerPlayer: true },
      },
    },
  })

  if (!draft) throw new Error('No draft found.')
  if (draft.status !== 'ACTIVE') throw new Error('The draft is not active.')

  if (expectedCurrentPick !== null && draft.currentPick !== expectedCurrentPick) {
    throw new Error('Draft state changed before this pick could be recorded. Please retry.')
  }

  const draftOrder = draft.draftOrder as string[]
  const currentTurn = computeCurrentTurn(
    draftOrder,
    draft.format,
    draft.currentPick,
    draft.tournament.powerupsPerPlayer,
  )

  if (!currentTurn) throw new Error('The draft is already complete.')
  if (currentTurn.tournamentPlayerId !== tournamentPlayerId) {
    throw new Error("It's not this player's turn to pick.")
  }

  const powerup = await tx.powerup.findUnique({ where: { id: powerupId } })
  if (!powerup) throw new Error('That powerup no longer exists.')

  const pickData = draft.picks.map((p) => ({
    tournamentPlayerId: p.tournamentPlayerId,
    powerupType: p.powerup.type as 'BOOST' | 'ATTACK',
    powerupId: p.powerupId,
  }))

  const validation = canPickPowerup(
    pickData,
    tournamentPlayerId,
    powerupId,
    powerup.type,
    draft.tournament.maxAttacksPerPlayer,
  )
  if (!validation.allowed) throw new Error(validation.reason)

  const pickNumber = draft.currentPick + 1

  const pick = await tx.draftPick.create({
    data: {
      draftId: draft.id,
      tournamentPlayerId,
      powerupId,
      pickNumber,
    },
    include: {
      powerup: {
        select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
      },
      tournamentPlayer: {
        select: { id: true, user: { select: { name: true, image: true } } },
      },
    },
  })

  await tx.playerPowerup.create({
    data: {
      tournamentPlayerId,
      powerupId,
      status: 'AVAILABLE',
    },
  })

  const newPickCount = pickNumber
  const totalNeeded = draftOrder.length * draft.tournament.powerupsPerPlayer
  const isComplete = newPickCount >= totalNeeded
  const hasTimer = draft.turnSeconds !== null && draft.turnSeconds > 0

  // Optimistic concurrency control: only succeed if currentPick still matches
  // what we read at the start of the transaction. Two racing picks observe the
  // same currentPick; the loser sees count===0 and aborts.
  const updated = await tx.draft.updateMany({
    where: { id: draft.id, currentPick: draft.currentPick },
    data: {
      currentPick: newPickCount,
      status: isComplete ? 'COMPLETED' : 'ACTIVE',
      turnStartedAt: isComplete || !hasTimer ? null : new Date(),
    },
  })

  if (updated.count !== 1) {
    throw new Error('Draft state changed before this pick could be recorded. Please retry.')
  }

  let nextPickerUserId: string | null = null
  let nextPickerTournamentPlayerId: string | null = null
  if (!isComplete) {
    const nextTurn = computeCurrentTurn(
      draftOrder,
      draft.format,
      newPickCount,
      draft.tournament.powerupsPerPlayer,
    )
    if (nextTurn) {
      nextPickerTournamentPlayerId = nextTurn.tournamentPlayerId
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
      const nextPlayer = await tx.tournamentPlayer.findUnique({
        where: { id: nextTurn.tournamentPlayerId },
        select: { user: { select: { id: true } } },
      })
      nextPickerUserId = nextPlayer?.user.id ?? null
    }
  }

  return {
    pick: pick as ExecutePickResult['pick'],
    isComplete,
    newPickCount,
    nextPickerUserId,
    nextPickerTournamentPlayerId,
  }
}

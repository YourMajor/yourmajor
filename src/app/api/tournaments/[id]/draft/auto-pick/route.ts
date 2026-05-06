import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { computeCurrentTurn } from '@/lib/draft-utils'
import { executePick } from '@/lib/draft-pick'
import { selectAutoPickPowerupId } from '@/lib/draft-auto-pick'
import { sendPushToUser } from '@/lib/push'

const CLOCK_SKEW_GRACE_MS = 2_000

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  // Caller must be a participant or admin of this tournament. Any participant
  // can fire this endpoint when they observe the timer expire — the server is
  // the source of truth for whether a pick should actually happen.
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true },
  })
  if (!membership && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const draft = await prisma.draft.findUnique({
    where: { tournamentId },
    select: { id: true, currentPick: true, turnSeconds: true, turnStartedAt: true, status: true },
  })
  if (!draft) return NextResponse.json({ error: 'No draft found.' }, { status: 404 })

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true, name: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read draft inside the txn so the timer check is based on committed state
      const fresh = await tx.draft.findUnique({
        where: { id: draft.id },
        include: {
          picks: {
            include: { powerup: { select: { type: true } } },
          },
          tournament: {
            select: {
              powerupsPerPlayer: true,
              maxAttacksPerPlayer: true,
              tournamentPowerups: {
                select: { powerup: { select: { id: true, type: true } } },
              },
            },
          },
        },
      })

      if (!fresh) throw new Error('No draft found.')
      if (fresh.status !== 'ACTIVE') throw new Error('The draft is not active.')
      if (!fresh.turnSeconds || fresh.turnSeconds <= 0) {
        throw new Error('Auto-pick is disabled (no turn timer set).')
      }
      if (!fresh.turnStartedAt) {
        throw new Error('Turn timer is not running.')
      }

      const elapsedMs = Date.now() - fresh.turnStartedAt.getTime()
      const requiredMs = fresh.turnSeconds * 1000 - CLOCK_SKEW_GRACE_MS
      if (elapsedMs < requiredMs) {
        const err = new Error('Turn timer has not expired yet.')
        ;(err as Error & { tooEarly?: boolean }).tooEarly = true
        throw err
      }

      const draftOrder = fresh.draftOrder as string[]
      const currentTurn = computeCurrentTurn(
        draftOrder,
        fresh.format,
        fresh.currentPick,
        fresh.tournament.powerupsPerPlayer,
      )
      if (!currentTurn) throw new Error('The draft is already complete.')

      const candidates = fresh.tournament.tournamentPowerups.map((tp) => ({
        id: tp.powerup.id,
        type: tp.powerup.type as 'BOOST' | 'ATTACK',
      }))

      const pickHistory = fresh.picks.map((p) => ({
        tournamentPlayerId: p.tournamentPlayerId,
        powerupType: p.powerup.type as 'BOOST' | 'ATTACK',
        powerupId: p.powerupId,
      }))

      const chosenPowerupId = selectAutoPickPowerupId(
        pickHistory,
        currentTurn.tournamentPlayerId,
        candidates,
        fresh.tournament.maxAttacksPerPlayer,
      )
      if (!chosenPowerupId) {
        throw new Error('No valid powerup available for auto-pick.')
      }

      const picked = await executePick(tx, {
        draftId: fresh.id,
        tournamentPlayerId: currentTurn.tournamentPlayerId,
        powerupId: chosenPowerupId,
        expectedCurrentPick: fresh.currentPick,
      })

      // Tell the affected player what happened
      await tx.notification.create({
        data: {
          tournamentPlayerId: currentTurn.tournamentPlayerId,
          type: 'DRAFT_AUTO_PICK',
          payload: {
            pickNumber: picked.pick.pickNumber,
            powerupName: picked.pick.powerup.name,
            message: `Time expired — auto-picked "${picked.pick.powerup.name}" for you.`,
          },
        },
      })

      return picked
    })

    if (result.nextPickerUserId) {
      void sendPushToUser(result.nextPickerUserId, {
        title: `${tournament.name} — You're on the clock`,
        body: "It's your turn to pick a powerup.",
        url: `/${tournament.slug}/draft`,
      }).catch((err) => console.error('[push] draft auto-pick dispatch failed', err))
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Pick already recorded for this turn.' },
        { status: 409 },
      )
    }
    if (err && typeof err === 'object' && (err as { tooEarly?: boolean }).tooEarly) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 425 },
      )
    }
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

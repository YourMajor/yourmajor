import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { broadcastNotification } from '@/lib/notification-broadcast'

/**
 * Has this powerup's outcome become known?
 *
 * A player may take back a card they played by mistake, but only while nobody
 * can yet tell what it was worth. Without that boundary undo is an
 * outcome-shopping exploit: activate Sandbagger's Bluff, enter the score, see
 * you missed by three (+2), undo. Play The Vampire, see the victim birdied,
 * undo. Every gamble card becomes a free roll.
 *
 * Which hole decides depends on the card:
 *   • an ATTACK is read off the VICTIM's landing hole, not the attacker's —
 *     the attacker's own hole says nothing about what the attack did;
 *   • a multi-hole card (status ACTIVE) is known as soon as ANY hole in its
 *     window has been scored;
 *   • a single-hole boost is known once its own hole has been scored.
 *
 * Admins bypass this entirely, which is the same escalation src/lib/play-round.ts
 * already documents for score corrections: players fix their own until it
 * matters, then it goes through an admin.
 */
async function isOutcomeKnown(pp: {
  tournamentPlayerId: string
  targetPlayerId: string | null
  roundId: string | null
  holeNumber: number | null
  targetHoleNumber: number | null
  status: string
  powerup: { type: string }
}): Promise<boolean> {
  // Never activated against a round — nothing can have resolved.
  if (!pp.roundId) return false

  // An attack's effect lands on its victim's card, so that is the card to read.
  const isAttack = pp.powerup.type === 'ATTACK' && pp.targetPlayerId !== null
  const subjectId = isAttack ? (pp.targetPlayerId as string) : pp.tournamentPlayerId

  // An armed card has not fired, so nothing about it is knowable yet.
  if (pp.status === 'ARMED') return false

  if (pp.status === 'ACTIVE') {
    // Multi-hole: the window runs from the hole after activation, matching
    // fetchScoresAfter in src/lib/variable-powerup-evaluator.ts.
    const after = pp.holeNumber ?? 0
    const scored = await prisma.score.count({
      where: {
        tournamentPlayerId: subjectId,
        roundId: pp.roundId,
        hole: { number: { gt: after } },
      },
    })
    return scored > 0
  }

  const hole = isAttack ? (pp.targetHoleNumber ?? pp.holeNumber) : pp.holeNumber
  if (hole === null) return false

  const score = await prisma.score.findFirst({
    where: {
      tournamentPlayerId: subjectId,
      roundId: pp.roundId,
      hole: { number: hole },
    },
    select: { id: true },
  })
  return score !== null
}

/**
 * Reactions that fired against this activation, as the activation route
 * recorded them on `metadata.reactedBy`. Read defensively — the shape comes
 * out of a Json column.
 */
function readConsumedReactions(metadata: unknown): string[] {
  if (typeof metadata !== 'object' || metadata === null) return []
  const raw = (metadata as { reactedBy?: unknown }).reactedBy
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) =>
      typeof r === 'object' && r !== null
        ? (r as { playerPowerupId?: unknown }).playerPowerupId
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

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

  const isAdmin = await isTournamentAdmin(user.id, tournamentId)

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  // An admin need not be a participant — admin ≠ participant in this product.
  if (!player && !isAdmin) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
    include: {
      powerup: { select: { name: true, type: true } },
      // The activator, who is not necessarily the caller any more: an admin
      // undoing someone else's card needs their userId for the chat cleanup
      // below, and their tournamentId to scope the card to this tournament.
      tournamentPlayer: { select: { tournamentId: true, userId: true } },
    },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Powerup not found' }, { status: 404 })

  // Scope the card to this tournament before anything else — playerPowerupId is
  // caller-supplied, and an admin of tournament A must not reach into B.
  if (playerPowerup.tournamentPlayer.tournamentId !== tournamentId) {
    return NextResponse.json({ error: 'Powerup not found' }, { status: 404 })
  }
  if (!isAdmin && playerPowerup.tournamentPlayerId !== player?.id) {
    return NextResponse.json({ error: 'Not your powerup' }, { status: 403 })
  }
  // ARMED counts as in use: a reactive card played by mistake has to be
  // retrievable like any other, and it has had no effect on anyone yet.
  if (
    playerPowerup.status !== 'USED' &&
    playerPowerup.status !== 'ACTIVE' &&
    playerPowerup.status !== 'ARMED'
  ) {
    return NextResponse.json({ error: 'Powerup is not currently in use' }, { status: 400 })
  }

  if (!isAdmin && (await isOutcomeKnown(playerPowerup))) {
    return NextResponse.json(
      {
        error:
          'That hole has already been scored, so this card can no longer be taken back. Ask a tournament admin to undo it.',
      },
      { status: 409 },
    )
  }

  // Captured before the reset nulls them out.
  const { targetPlayerId, usedAt } = playerPowerup
  const activatorUserId = playerPowerup.tournamentPlayer.userId
  // Reactions this activation set off, recorded by the activation route.
  const reacted = readConsumedReactions(playerPowerup.metadata)

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

  // Give back any reaction this attack burned. Without this, undo would be a
  // free way to strip somebody's Deflector: play an attack into it, watch it
  // fire, take the attack back and keep the advantage.
  if (reacted.length > 0) {
    await prisma.playerPowerup.updateMany({
      where: { id: { in: reacted }, status: 'USED' },
      data: {
        status: 'ARMED',
        scoreModifier: null,
        // A reaction's target/hole were written when it fired; re-arming has to
        // clear them or a Tripwire would stay pointed at the attack it caught.
        targetHoleNumber: null,
      },
    })
  }

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
    //
    // Scoped to the ACTIVATOR's userId, not the caller's. Activation authors
    // the chat line as the activating player, so an admin undoing someone
    // else's card would otherwise try to delete their own messages and leave
    // the real line standing in chat for good. `deletedBy` stays the caller —
    // the admin is who performed the deletion.
    await prisma.tournamentMessage.updateMany({
      where: {
        tournamentId,
        userId: activatorUserId,
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

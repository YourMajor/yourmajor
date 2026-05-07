import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getUser } from '@/lib/auth'
import { canActivate, computeActivationModifier, computeAttackTargetHole, isVariablePowerup, parsePowerupEffect } from '@/lib/powerup-engine'
import { sendPushToUser } from '@/lib/push'
import { broadcastNotification } from '@/lib/notification-broadcast'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const body = await req.json() as {
    playerPowerupId: string
    roundId: string
    holeNumber: number
    targetPlayerId?: string
    targetHoleNumber?: number
    metadata?: Record<string, unknown>
  }

  const { playerPowerupId, roundId, holeNumber, targetPlayerId, targetHoleNumber: targetHoleOverride, metadata } = body
  if (!playerPowerupId || !roundId || !holeNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true, user: { select: { name: true } } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  // Fetch the powerup
  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
    include: { powerup: true },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Powerup not found' }, { status: 404 })
  if (playerPowerup.tournamentPlayerId !== player.id) {
    return NextResponse.json({ error: 'Not your powerup' }, { status: 403 })
  }
  if (playerPowerup.status !== 'AVAILABLE') {
    return NextResponse.json({ error: 'Powerup already used' }, { status: 400 })
  }

  let effect
  try {
    effect = parsePowerupEffect(playerPowerup.powerup.effect)
  } catch {
    return NextResponse.json({ error: 'Powerup effect data is malformed' }, { status: 500 })
  }

  // Validate restrictions. Load all holes — we need them not just for the
  // attacker's activation hole but also to compute the recipient's target hole
  // when this is an attack.
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    include: { course: { include: { holes: true } } },
  })
  const hole = round?.course.holes.find((h) => h.number === holeNumber)
  if (!hole) return NextResponse.json({ error: 'Hole not found' }, { status: 404 })

  const activation = canActivate(effect, { par: hole.par, number: hole.number })
  if (!activation.allowed) {
    return NextResponse.json({ error: activation.reason }, { status: 400 })
  }

  // Validate target for ATTACK cards
  if (effect.requiresTarget && !targetPlayerId) {
    return NextResponse.json({ error: 'Target player required for attack cards' }, { status: 400 })
  }

  // For attacks, decide which hole on the recipient's scorecard the attack
  // lands on. Default = recipient's first unscored hole + 1 (clamped). The
  // client may override to any of the recipient's unscored holes; we validate
  // the override is actually unscored before accepting it.
  let resolvedTargetHole: number | null = null
  if (playerPowerup.powerup.type === 'ATTACK' && targetPlayerId) {
    const targetScores = await prisma.score.findMany({
      where: { tournamentPlayerId: targetPlayerId, roundId },
      select: { hole: { select: { number: true } } },
    })
    const scoredNumbers = new Set(targetScores.map((s) => s.hole.number))
    const allHoleNumbers = round!.course.holes.map((h) => h.number)

    if (typeof targetHoleOverride === 'number') {
      if (!allHoleNumbers.includes(targetHoleOverride)) {
        return NextResponse.json({ error: 'Override hole is not on the course' }, { status: 400 })
      }
      if (scoredNumbers.has(targetHoleOverride)) {
        return NextResponse.json({ error: 'Cannot apply attack on a hole the target has already scored' }, { status: 400 })
      }
      resolvedTargetHole = targetHoleOverride
    } else {
      const auto = computeAttackTargetHole(allHoleNumbers, scoredNumbers)
      if (auto === null) {
        return NextResponse.json({ error: 'Target has finished — no hole to attack' }, { status: 400 })
      }
      resolvedTargetHole = auto
    }
  }

  // Determine status and modifier based on powerup type
  const isVariable = isVariablePowerup(effect)
  const status = isVariable ? 'ACTIVE' as const : 'USED' as const
  const scoreModifier = isVariable
    ? null
    : computeActivationModifier(effect, metadata as { numberValue?: unknown } | null, playerPowerup.powerup.slug)

  // Build structured metadata for variable powerups
  let structuredMetadata: Record<string, unknown> | undefined = metadata ? { ...metadata } : undefined
  if (isVariable) {
    const powerupSlug = playerPowerup.powerup.slug
    if (powerupSlug === 'fairway-finder') {
      structuredMetadata = {
        declaredCount: metadata?.numberValue ?? 1,
        activationHoleNumber: holeNumber,
        fairwaysHit: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'king-of-the-hill') {
      structuredMetadata = {
        targetPlayerIds: metadata?.selectedPlayerIds ?? [],
        activationHoleNumber: holeNumber,
        consecutiveWins: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'the-streaker') {
      structuredMetadata = {
        declaredCount: metadata?.numberValue ?? 1,
        activationHoleNumber: holeNumber,
        girsHit: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'no-three-putts') {
      structuredMetadata = {
        declaredCount: metadata?.numberValue ?? 2,
        activationHoleNumber: holeNumber,
        holesPlayed: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'birdie-hunter') {
      structuredMetadata = {
        activationHoleNumber: holeNumber,
        holesScored: 0,
        bonusStrokes: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'stayin-alive') {
      structuredMetadata = {
        activationHoleNumber: holeNumber,
        holesScored: 0,
        hadBogey: false,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'double-or-nothing') {
      const targetIds = (targetPlayerId ? [targetPlayerId] : (metadata?.selectedPlayerIds as string[] | undefined)) ?? []
      structuredMetadata = {
        targetPlayerIds: targetIds,
        activationHoleNumber: holeNumber,
        holesScored: 0,
        netDelta: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'one-putt-wonder') {
      structuredMetadata = {
        activationHoleNumber: holeNumber,
        holesScored: 0,
        bonusStrokes: 0,
        status: 'in_progress',
      }
    } else if (powerupSlug === 'foot-wedge') {
      structuredMetadata = {
        activationHoleNumber: holeNumber,
        holesRemaining: 9,
        status: 'in_progress',
      }
    }
  }

  // Update the powerup
  const updated = await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      status,
      usedAt: new Date(),
      roundId,
      holeNumber,
      targetHoleNumber: resolvedTargetHole,
      targetPlayerId: targetPlayerId ?? null,
      scoreModifier,
      metadata: structuredMetadata as Prisma.InputJsonValue | undefined,
    },
    include: {
      powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
    },
  })

  // Create attack notification for target player
  if (playerPowerup.powerup.type === 'ATTACK' && targetPlayerId) {
    const targetPlayer = await prisma.tournamentPlayer.findUnique({
      where: { id: targetPlayerId },
      select: {
        id: true,
        user: { select: { id: true, name: true } },
        tournament: { select: { slug: true, name: true } },
      },
    })

    const landsOnHole = resolvedTargetHole ?? holeNumber

    await prisma.notification.create({
      data: {
        tournamentPlayerId: targetPlayerId,
        type: 'ATTACK_RECEIVED',
        payload: {
          attackerName: player.user.name ?? 'A player',
          powerupName: playerPowerup.powerup.name,
          powerupDescription: playerPowerup.powerup.description,
          holeNumber: landsOnHole,
          powerupSlug: playerPowerup.powerup.slug,
        },
      },
    })

    // Broadcast to the recipient's notification channel so the in-app modal
    // updates instantly without depending on RLS-gated postgres_changes.
    // The client refetches via the auth-checked notifications API.
    void broadcastNotification(targetPlayerId).catch(() => {})

    // Fire-and-forget push so the recipient sees a system banner even if the
    // app isn't focused. In-app delivery is handled by the broadcast above
    // (see NotificationPopup).
    if (targetPlayer?.user.id && targetPlayer.tournament) {
      void sendPushToUser(targetPlayer.user.id, {
        title: `${targetPlayer.tournament.name} — Under attack!`,
        body: `${player.user.name ?? 'A player'} used ${playerPowerup.powerup.name} on you (Hole ${landsOnHole})`,
        url: `/${targetPlayer.tournament.slug}/play`,
      }).catch((err) => console.error('[push] attack dispatch failed', err))
    }

    // System chat message for attack
    await prisma.tournamentMessage.create({
      data: {
        tournamentId,
        userId: user.id,
        content: `⚔️ ${player.user.name ?? 'Player'} ATTACKED ${targetPlayer?.user.name ?? 'Player'} with ${playerPowerup.powerup.name} on Hole ${landsOnHole}!`,
        isSystem: true,
      },
    })
  } else if (isVariable) {
    // System chat message for variable powerup activation
    const playerName = player.user.name ?? 'Player'
    let activationDetail = ''
    if (playerPowerup.powerup.slug === 'fairway-finder') {
      activationDetail = `, declaring ${structuredMetadata?.declaredCount ?? '?'} consecutive fairways`
    } else if (playerPowerup.powerup.slug === 'king-of-the-hill') {
      activationDetail = ' — the streak begins next hole'
    } else if (playerPowerup.powerup.slug === 'the-streaker') {
      activationDetail = `, declaring ${structuredMetadata?.declaredCount ?? '?'} consecutive GIRs`
    } else if (playerPowerup.powerup.slug === 'no-three-putts') {
      activationDetail = `, declaring ${structuredMetadata?.declaredCount ?? '?'} clean holes`
    } else if (playerPowerup.powerup.slug === 'birdie-hunter') {
      activationDetail = ' — birdies count double for the next 3 holes'
    } else if (playerPowerup.powerup.slug === 'stayin-alive') {
      activationDetail = ' — bogey-free next 3 holes for -3'
    } else if (playerPowerup.powerup.slug === 'one-putt-wonder') {
      activationDetail = ' — one-putts pay -1 each for the next 9 holes'
    } else if (playerPowerup.powerup.slug === 'foot-wedge') {
      activationDetail = ' — relocate every shot one club length for 9 holes'
    }
    await prisma.tournamentMessage.create({
      data: {
        tournamentId,
        userId: user.id,
        content: `⚡ ${playerName} activated ${playerPowerup.powerup.name} on Hole ${holeNumber}${activationDetail}!`,
        isSystem: true,
      },
    })
  } else {
    // System chat message for boost
    await prisma.tournamentMessage.create({
      data: {
        tournamentId,
        userId: user.id,
        content: `⚡ ${player.user.name ?? 'Player'} used ${playerPowerup.powerup.name} on Hole ${holeNumber}!`,
        isSystem: true,
      },
    })
  }

  return NextResponse.json(updated)
}

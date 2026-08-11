import { NextRequest, NextResponse, after } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
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
  const parsed = await parseBody(req, z.object({
    playerPowerupId: z.string().min(1),
    roundId: z.string().min(1),
    holeNumber: z.number().int().min(1).max(18),
    targetPlayerId: z.string().min(1).optional(),
    targetHoleNumber: z.number().int().min(1).max(18).optional(),
    // Shape stays open — each powerup effect reads its own keys, and the ids
    // inside are individually scoped to this tournament further down.
    metadata: z.record(z.string(), z.unknown()).optional(),
  }))
  if (!parsed.ok) return parsed.response
  const { playerPowerupId, roundId, holeNumber, targetPlayerId, targetHoleNumber: targetHoleOverride, metadata } = parsed.data

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
  // findFirst, not findUnique: the round has to belong to *this* tournament.
  // roundId is attacker-controlled and reaches three sinks (the target's score
  // filter, the persisted row, and the hole list), so it is scoped here at the
  // load rather than at each use. No compound unique on (id, tournamentId).
  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId },
    include: { course: { include: { holes: true } } },
  })
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })

  const hole = round.course.holes.find((h) => h.number === holeNumber)
  if (!hole) return NextResponse.json({ error: 'Hole not found' }, { status: 404 })

  const activation = canActivate(effect, { par: hole.par, number: hole.number })
  if (!activation.allowed) {
    return NextResponse.json({ error: activation.reason }, { status: 400 })
  }

  // Validate target for ATTACK cards
  if (effect.requiresTarget && !targetPlayerId) {
    return NextResponse.json({ error: 'Target player required for attack cards' }, { status: 400 })
  }

  // Resolve the target *before* the claim below writes it to the row — every
  // player id in the body has to belong to this tournament. Only the caller
  // was scoped above, so without this a participant of one tournament could
  // land a real attack on another tournament's leaderboard.
  let targetPlayer: {
    id: string
    user: { id: string; name: string | null }
    tournament: { slug: string; name: string }
  } | null = null
  if (targetPlayerId) {
    targetPlayer = await prisma.tournamentPlayer.findFirst({
      where: { id: targetPlayerId, tournamentId },
      select: {
        id: true,
        user: { select: { id: true, name: true } },
        tournament: { select: { slug: true, name: true } },
      },
    })
    if (!targetPlayer) {
      return NextResponse.json({ error: 'Target player is not in this tournament' }, { status: 403 })
    }
  }

  // Same for the multi-target variable powerups, whose ids ride in metadata
  // and are read back as tournamentPlayer ids by variable-powerup-evaluator.
  const selectedPlayerIds = [...new Set((metadata?.selectedPlayerIds as string[] | undefined) ?? [])]
  if (selectedPlayerIds.length > 0) {
    const inTournament = await prisma.tournamentPlayer.count({
      where: { id: { in: selectedPlayerIds }, tournamentId },
    })
    if (inTournament !== selectedPlayerIds.length) {
      return NextResponse.json({ error: 'Target player is not in this tournament' }, { status: 403 })
    }
  }

  // For attacks, decide which hole on the recipient's scorecard the attack
  // lands on. Default = recipient's first unscored hole + 1 (clamped). The
  // client may override to any of the recipient's unscored holes; we validate
  // the override is actually unscored before accepting it.
  let resolvedTargetHole: number | null = null
  if (playerPowerup.powerup.type === 'ATTACK' && targetPlayer) {
    const targetScores = await prisma.score.findMany({
      where: { tournamentPlayerId: targetPlayer.id, roundId },
      select: { hole: { select: { number: true } } },
    })
    const scoredNumbers = new Set(targetScores.map((s) => s.hole.number))
    const allHoleNumbers = round.course.holes.map((h) => h.number)

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
        targetPlayerIds: selectedPlayerIds,
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
      const targetIds = targetPlayerId ? [targetPlayerId] : selectedPlayerIds
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

  // Claim the card with a conditional write. The status pre-check above is
  // only a fast path — two concurrent POSTs both pass it, so the AVAILABLE
  // predicate has to live in the UPDATE itself or both would fire
  // notifications and clobber scoreModifier. Same pattern as draft/pick.
  const claimed = await prisma.playerPowerup.updateMany({
    where: { id: playerPowerupId, status: 'AVAILABLE' },
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
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Powerup already used' }, { status: 409 })
  }

  // updateMany can't `include`, so re-read for the relation the client needs.
  const updated = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
    include: {
      powerup: { select: { id: true, slug: true, name: true, type: true, description: true, effect: true } },
    },
  })

  // Create attack notification for target player
  if (playerPowerup.powerup.type === 'ATTACK' && targetPlayer) {
    const landsOnHole = resolvedTargetHole ?? holeNumber

    await prisma.notification.create({
      data: {
        tournamentPlayerId: targetPlayer.id,
        type: 'ATTACK_RECEIVED',
        payload: {
          // Undo deletes this notification by matching on playerPowerupId —
          // there is no FK from Notification to PlayerPowerup.
          playerPowerupId,
          attackerName: player.user.name ?? 'A player',
          powerupName: playerPowerup.powerup.name,
          powerupDescription: playerPowerup.powerup.description,
          holeNumber: landsOnHole,
          powerupSlug: playerPowerup.powerup.slug,
        },
      },
    })

    // Both run after the response. The broadcast updates the recipient's
    // in-app modal without depending on RLS-gated postgres_changes; the push
    // gives them a system banner when the app isn't focused. A bare `void`
    // did not survive on Vercel — the function can freeze at the response.
    const target = targetPlayer
    after(async () => {
      try {
        await broadcastNotification(target.id)
        await sendPushToUser(target.user.id, {
          title: `${target.tournament.name} — Under attack!`,
          body: `${player.user.name ?? 'A player'} used ${playerPowerup.powerup.name} on you (Hole ${landsOnHole})`,
          url: `/${target.tournament.slug}/play`,
        })
      } catch (err) {
        console.error('[push] attack dispatch failed', err)
      }
    })

    // System chat message for attack
    await prisma.tournamentMessage.create({
      data: {
        tournamentId,
        userId: user.id,
        content: `⚔️ ${player.user.name ?? 'Player'} ATTACKED ${targetPlayer.user.name ?? 'Player'} with ${playerPowerup.powerup.name} on Hole ${landsOnHole}!`,
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

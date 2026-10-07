import { NextRequest, NextResponse, after } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getUser } from '@/lib/auth'
import { buildWindowMetadata, canActivate, computeActivationModifier, computeAttackTargetHole, isReactivePowerup, isVariablePowerup, isWindowedPowerup, parsePowerupEffect } from '@/lib/powerup-engine'
import { activationTriggersReactions, fireReactions } from '@/lib/powerup-reactions'
import { MAX_OVERRIDE_STROKES, MIN_OVERRIDE_STROKES, NUMBER_OVERRIDE_SLUG, isValidStrokeOverrideValue } from '@/lib/powerup-stroke-overrides'
import { initialVariableMetadata, variableActivationDetail } from '@/lib/variable-powerup-evaluator'
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

  // The comeback cards unlock only once the player is far enough over par, so
  // the restriction check needs their round so far. Loaded only when a card
  // actually asks, to keep the common activation at one query.
  let progress: { strokesOverPar: number } | undefined
  if (typeof effect.restrictions.minStrokesOverPar === 'number' && effect.restrictions.minStrokesOverPar > 0) {
    const played = await prisma.score.findMany({
      where: { tournamentPlayerId: playerPowerup.tournamentPlayerId, roundId },
      select: { strokes: true, hole: { select: { par: true } } },
    })
    progress = {
      strokesOverPar: played.reduce((sum, s) => sum + (s.strokes - s.hole.par), 0),
    }
  }

  const activation = canActivate(effect, { par: hole.par, number: hole.number }, progress)
  if (!activation.allowed) {
    return NextResponse.json({ error: activation.reason }, { status: 400 })
  }

  // Can I Get Your Number replaces the player's strokes on this hole with
  // metadata.numberValue (powerup-stroke-overrides.ts). computeActivationModifier
  // returns null for stroke-override slugs and the card needs no second-party
  // confirmation, so the body's number is never inspected anywhere else on the
  // way in — it has to be a legal hole score here or it reaches the leaderboard
  // verbatim.
  if (
    playerPowerup.powerup.slug === NUMBER_OVERRIDE_SLUG &&
    !isValidStrokeOverrideValue(metadata?.numberValue)
  ) {
    return NextResponse.json(
      { error: `Number must be a whole number between ${MIN_OVERRIDE_STROKES} and ${MAX_OVERRIDE_STROKES}` },
      { status: 400 },
    )
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

  // A restriction_select choice is client-supplied and ends up quoted back to
  // other players (The Gauntlet's restriction, The Tally's confirmation
  // prompt), so it has to be one of the options the card actually declares —
  // not arbitrary text.
  let selectedOption: string | null = null
  if (effect.input?.type === 'restriction_select') {
    const options = effect.input.options ?? []
    const choice = metadata?.selectedOption
    if (typeof choice !== 'string' || !options.includes(choice)) {
      return NextResponse.json(
        { error: 'Select one of this card\'s options' },
        { status: 400 },
      )
    }
    selectedOption = choice
  }

  // For attacks, decide which hole on the recipient's scorecard the attack
  // lands on. Default = recipient's first unscored hole + 1 (clamped). The
  // client may override to any of the recipient's unscored holes; we validate
  // the override is actually unscored before accepting it.
  let resolvedTargetHole: number | null = null
  const isScoreSwap = effect.scoring.conditionalKey === 'score_swap'
  let swapHoleNumber: number | null = null
  if (isScoreSwap && targetPlayer) {
    // Parent Trap swaps both players' scores on a hole the activator picks —
    // any hole on the course, played or not — and the swap is applied once
    // both have finished the round (powerup-stroke-overrides.ts). So any
    // opponent is fair game, whatever their progress.
    const swapHole = targetHoleOverride ?? holeNumber
    if (!round.course.holes.some((h) => h.number === swapHole)) {
      return NextResponse.json({ error: 'Swap hole is not on the course' }, { status: 400 })
    }
    resolvedTargetHole = swapHole
    swapHoleNumber = swapHole
  } else if (playerPowerup.powerup.type === 'ATTACK' && targetPlayer) {
    const targetScores = await prisma.score.findMany({
      where: { tournamentPlayerId: targetPlayer.id, roundId },
      select: { hole: { select: { number: true } } },
    })
    const scoredNumbers = new Set(targetScores.map((s) => s.hole.number))
    const allHoleNumbers = round.course.holes.map((h) => h.number)

    if (typeof targetHoleOverride === 'number' && !allHoleNumbers.includes(targetHoleOverride)) {
      return NextResponse.json({ error: 'Override hole is not on the course' }, { status: 400 })
    }
    // The client's hole list is a snapshot from when the scoring page loaded
    // (play/page.tsx → opponentScoredHoles) and never refreshes mid-round, so
    // by the time an attack is played the chosen hole has often been scored
    // already. Rejecting that bounced the card silently back into the hand —
    // fall through to the auto-pick against fresh scores instead.
    if (typeof targetHoleOverride === 'number' && !scoredNumbers.has(targetHoleOverride)) {
      resolvedTargetHole = targetHoleOverride
    } else {
      const auto = computeAttackTargetHole(allHoleNumbers, scoredNumbers)
      if (auto === null) {
        return NextResponse.json({ error: 'Target has finished — no hole to attack' }, { status: 400 })
      }
      resolvedTargetHole = auto
    }
  }

  // Determine status and modifier based on powerup type. Multi-hole kinds park
  // as ACTIVE with tracking metadata; reactive cards park as ARMED and wait for
  // somebody else to act; only single-hole cards settle a modifier here.
  const isVariable = isVariablePowerup(effect)
  const isWindowed = isWindowedPowerup(effect)
  const isReactive = isReactivePowerup(effect)
  const isTracked = isVariable || isWindowed
  const status = isReactive
    ? 'ARMED' as const
    : isTracked
      ? 'ACTIVE' as const
      : 'USED' as const
  const scoreModifier = isTracked || isReactive
    ? null
    : computeActivationModifier(effect, metadata as { numberValue?: unknown } | null, playerPowerup.powerup.slug)

  // ── Reactions: does playing this set off somebody's armed card?
  //
  // Only a plain ATTACK can. Arming a reactive card must not trip a Tripwire,
  // which is the whole recursion guard. Runs before the claim below so a
  // deflected attack is written already redirected, rather than landing on the
  // victim and being corrected afterwards.
  let reactionMessages: string[] = []
  let consumedReactions: Array<{ playerPowerupId: string; reaction: string }> = []
  let effectiveTargetPlayerId: string | null = targetPlayerId ?? null
  let effectiveTargetHole: number | null = resolvedTargetHole
  let effectiveModifier: number | null = scoreModifier

  if (activationTriggersReactions(effect, playerPowerup.powerup.type)) {
    const fired = await fireReactions({
      tournamentId,
      roundId,
      attackerPlayerId: player.id,
      attackerName: player.user.name ?? 'A player',
      victimPlayerId: targetPlayerId ?? null,
      incomingName: playerPowerup.powerup.name,
      incomingModifier: scoreModifier,
      courseHoleNumbers: round.course.holes.map((h) => h.number),
    })
    reactionMessages = fired.messages
    consumedReactions = fired.consumed
    if (fired.incoming) {
      if (fired.incoming.scoreModifier !== undefined) effectiveModifier = fired.incoming.scoreModifier
      if (fired.incoming.targetPlayerId !== undefined) effectiveTargetPlayerId = fired.incoming.targetPlayerId
      if (fired.incoming.targetHoleNumber !== undefined) effectiveTargetHole = fired.incoming.targetHoleNumber
    }
  }

  /** True when a reaction turned this attack around or cancelled it. */
  const wasBlocked = reactionMessages.length > 0 && consumedReactions.some((c) => c.reaction === 'on_targeted')

  // Build structured metadata for variable powerups
  let structuredMetadata: Record<string, unknown> | undefined = metadata ? { ...metadata } : undefined
  // Stored separately from targetHoleNumber: rows from before the hole picker
  // have a targetHoleNumber the old swap logic never used, so the engine only
  // trusts this key.
  if (swapHoleNumber !== null) {
    structuredMetadata = { ...(structuredMetadata ?? {}), swapHoleNumber }
  }
  // Store the validated choice rather than the raw client value.
  if (selectedOption !== null) {
    structuredMetadata = { ...(structuredMetadata ?? {}), selectedOption }
  }
  // What stopped this, so undo can hand the reaction back. Without it, undoing
  // a deflected attack would be a free way to burn somebody's Deflector.
  if (consumedReactions.length > 0) {
    structuredMetadata = { ...(structuredMetadata ?? {}), reactedBy: consumedReactions }
  }
  if (isWindowed) {
    // Windowed cards share one metadata shape and read their window length off
    // the card, so there is no per-slug branch to keep in sync.
    structuredMetadata = buildWindowMetadata(effect, holeNumber, {
      numberValue: metadata?.numberValue,
      selectedPlayerIds,
      targetPlayerId,
      selectedOption,
    }) as unknown as Record<string, unknown>
  } else if (isVariable) {
    // The per-slug shapes live beside the interfaces that read them back and
    // the window constants they have to agree with — see
    // initialVariableMetadata in lib/variable-powerup-evaluator.
    const initial = initialVariableMetadata(playerPowerup.powerup.slug, {
      holeNumber,
      numberValue: metadata?.numberValue,
      selectedPlayerIds,
      targetPlayerId,
    })
    if (initial) structuredMetadata = initial
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
      // The effective values, not the requested ones: a Deflector has already
      // rewritten the target to the attacker, and an Absorb has zeroed it.
      targetHoleNumber: effectiveTargetHole,
      targetPlayerId: effectiveTargetPlayerId,
      scoreModifier: effectiveModifier,
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

  // Reactions announce themselves — and ONLY when they fire. Arming is silent,
  // because a Deflector nobody knows about is what makes attacking a gamble.
  // Posted before the attack's own line so chat reads in the order it happened.
  for (const line of reactionMessages) {
    await prisma.tournamentMessage.create({
      data: { tournamentId, userId: user.id, content: line, isSystem: true },
    })
  }

  // Create attack notification for target player.
  //
  // Skipped in two cases. When a reaction turned the attack around or
  // cancelled it, the original target was not hit and telling them they were
  // under attack would be a lie. And when the card is REACTIVE — Tripwire is
  // an ATTACK aimed at a rival, but arming it must stay secret or the bluff
  // the whole mechanic rests on is given away by a push notification.
  if (playerPowerup.powerup.type === 'ATTACK' && targetPlayer && !wasBlocked && !isReactive) {
    const landsOnHole = effectiveTargetHole ?? holeNumber

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
  } else if (isReactive) {
    // Deliberately silent. A reactive card announces nothing when armed — the
    // whole mechanic is that nobody knows who is protected, so attacking is a
    // risk even against a player holding nothing. Its chat line comes later,
    // if and when it fires (see reactionMessages above).
  } else if (playerPowerup.powerup.type === 'ATTACK' && targetPlayer && wasBlocked) {
    // The attack was stopped. The reaction already posted what happened, so
    // adding "X ATTACKED Y" on top would contradict it.
  } else if (isVariable) {
    // System chat message for variable powerup activation
    const playerName = player.user.name ?? 'Player'
    const activationDetail = variableActivationDetail(playerPowerup.powerup.slug, structuredMetadata)
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

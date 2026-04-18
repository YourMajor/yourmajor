/**
 * Variable Powerup Evaluator
 *
 * Server-side evaluation of active variable-duration powerups.
 * Called after every score save to determine whether a challenge is
 * still in progress, succeeded, or failed.
 */

import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  playerPowerupId: string
  slug: string
  outcome: 'in_progress' | 'success' | 'failed'
  scoreModifier: number | null
  message: string
}

interface FairwayFinderMetadata {
  declaredCount: number
  activationHoleNumber: number
  fairwaysHit: number
  status: 'in_progress' | 'success' | 'failed'
}

interface KingOfTheHillMetadata {
  targetPlayerIds: string[]
  activationHoleNumber: number
  consecutiveWins: number
  status: 'in_progress' | 'success' | 'failed'
}

// ─── Main entry point ──────────────────────────────────────��──────────────────

/**
 * Evaluate all ACTIVE variable powerups for a player in a round.
 * Called after each score save.
 */
export async function evaluateActiveVariablePowerups(
  tournamentPlayerId: string,
  roundId: string,
): Promise<EvaluationResult[]> {
  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayerId,
      roundId,
      status: 'ACTIVE',
    },
    include: {
      powerup: { select: { slug: true, name: true } },
    },
  })

  const results: EvaluationResult[] = []

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    let result: EvaluationResult | null = null

    switch (pp.powerup.slug) {
      case 'fairway-finder':
        result = await evaluateFairwayFinder(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as FairwayFinderMetadata)
        break
      case 'king-of-the-hill':
        result = await evaluateKingOfTheHill(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as KingOfTheHillMetadata)
        break
    }

    if (result) results.push(result)
  }

  return results
}

/**
 * Evaluate ACTIVE variable powerups where `tournamentPlayerId` is a KotH target.
 * Called when a target player submits a score, so the KotH holder's powerup
 * gets re-evaluated with the new data.
 */
export async function evaluateAsKothTarget(
  targetTournamentPlayerId: string,
  roundId: string,
): Promise<EvaluationResult[]> {
  // Find all ACTIVE king-of-the-hill powerups that reference this player as a target
  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      roundId,
      status: 'ACTIVE',
      powerup: { slug: 'king-of-the-hill' },
    },
    include: {
      powerup: { select: { slug: true, name: true } },
    },
  })

  const results: EvaluationResult[] = []

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    const targetPlayerIds = (metadata as unknown as KingOfTheHillMetadata).targetPlayerIds
    if (!targetPlayerIds?.includes(targetTournamentPlayerId)) continue

    const result = await evaluateKingOfTheHill(
      pp.id,
      pp.powerup.slug,
      pp.tournamentPlayerId,
      roundId,
      metadata as unknown as KingOfTheHillMetadata,
    )
    if (result) results.push(result)
  }

  return results
}

/**
 * Force-resolve all remaining ACTIVE variable powerups at end of round.
 */
export async function finalizeVariablePowerups(
  tournamentPlayerId: string,
  roundId: string,
): Promise<EvaluationResult[]> {
  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayerId,
      roundId,
      status: 'ACTIVE',
    },
    include: {
      powerup: { select: { slug: true, name: true } },
    },
  })

  const results: EvaluationResult[] = []

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    let result: EvaluationResult | null = null

    switch (pp.powerup.slug) {
      case 'fairway-finder': {
        const meta = metadata as unknown as FairwayFinderMetadata
        if (meta.fairwaysHit >= meta.declaredCount) {
          // Already reached target but wasn't finalized — success
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'success', -meta.declaredCount, `Fairway Finder complete! -${meta.declaredCount} to your score!`)
        } else {
          // Didn't reach target by end of round — fail
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'failed', 0, `Fairway Finder: Challenge Failed! Hit ${meta.fairwaysHit}/${meta.declaredCount} fairways.`)
        }
        break
      }
      case 'king-of-the-hill': {
        const meta = metadata as unknown as KingOfTheHillMetadata
        const modifier = meta.consecutiveWins > 0 ? -meta.consecutiveWins : 0
        result = await resolvePowerup(pp.id, pp.powerup.slug, meta.consecutiveWins > 0 ? 'success' : 'failed', modifier, meta.consecutiveWins > 0
          ? `King of the Hill: ${meta.consecutiveWins} hole streak! ${modifier} to your score!`
          : 'King of the Hill: No holes won.',
        )
        break
      }
    }

    if (result) results.push(result)
  }

  return results
}

// ─── Slug-specific evaluators ────────────────────────────���────────────────────

async function evaluateFairwayFinder(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: FairwayFinderMetadata,
): Promise<EvaluationResult> {
  const { declaredCount, activationHoleNumber } = metadata

  // Fetch scored non-par-3 holes after activation, ordered by hole number
  const scores = await prisma.score.findMany({
    where: {
      tournamentPlayerId,
      roundId,
      hole: {
        number: { gt: activationHoleNumber },
        par: { gt: 3 },
      },
    },
    include: {
      hole: { select: { number: true, par: true } },
    },
    orderBy: { hole: { number: 'asc' } },
  })

  // Walk through scored holes, counting consecutive fairways
  let consecutiveFairways = 0

  for (const score of scores) {
    if (score.fairwayHit === true) {
      consecutiveFairways++

      if (consecutiveFairways >= declaredCount) {
        // SUCCESS — reached declared target
        return resolvePowerup(
          playerPowerupId,
          slug,
          'success',
          -declaredCount,
          `Fairway Finder complete! ${declaredCount} consecutive fairways! -${declaredCount} to your score!`,
        )
      }
    } else if (score.strokes !== null) {
      // Strokes entered but fairway not hit (false or null) — FAILED
      return resolvePowerup(
        playerPowerupId,
        slug,
        'failed',
        0,
        `Fairway Finder: Challenge Failed on Hole ${score.hole.number}!`,
      )
    }
    // If strokes is null, hole not fully scored yet — skip
  }

  // Still in progress — update metadata with current count
  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      metadata: {
        ...metadata,
        fairwaysHit: consecutiveFairways,
        status: 'in_progress',
      },
    },
  })

  return {
    playerPowerupId,
    slug,
    outcome: 'in_progress',
    scoreModifier: null,
    message: `Fairway Finder: ${consecutiveFairways}/${declaredCount} fairways`,
  }
}

async function evaluateKingOfTheHill(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: KingOfTheHillMetadata,
): Promise<EvaluationResult> {
  const { targetPlayerIds, activationHoleNumber } = metadata

  // Fetch the round's holes after activation, ordered by number
  const round = await prisma.tournamentRound.findUnique({
    where: { id: roundId },
    include: {
      course: {
        include: {
          holes: {
            where: { number: { gt: activationHoleNumber } },
            orderBy: { number: 'asc' },
            select: { id: true, number: true },
          },
        },
      },
    },
  })

  if (!round) {
    return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: 'King of the Hill: Waiting...' }
  }

  const relevantHoles = round.course.holes
  const allPlayerIds = [tournamentPlayerId, ...targetPlayerIds]

  // Fetch all scores for the user and targets on the relevant holes
  const allScores = await prisma.score.findMany({
    where: {
      roundId,
      tournamentPlayerId: { in: allPlayerIds },
      holeId: { in: relevantHoles.map((h) => h.id) },
    },
    include: {
      hole: { select: { number: true } },
    },
  })

  // Build a map: holeNumber → { playerId → strokes }
  const scoreMap = new Map<number, Map<string, number>>()
  for (const s of allScores) {
    if (!scoreMap.has(s.hole.number)) scoreMap.set(s.hole.number, new Map())
    scoreMap.get(s.hole.number)!.set(s.tournamentPlayerId, s.strokes)
  }

  let consecutiveWins = 0

  for (const hole of relevantHoles) {
    const holeScores = scoreMap.get(hole.number)
    if (!holeScores) break // No scores for this hole yet

    const userScore = holeScores.get(tournamentPlayerId)
    if (userScore === undefined) break // User hasn't scored this hole yet

    // Check if all targets have scored this hole
    const targetScores: number[] = []
    let allTargetsScored = true
    for (const targetId of targetPlayerIds) {
      const ts = holeScores.get(targetId)
      if (ts === undefined) {
        allTargetsScored = false
        break
      }
      targetScores.push(ts)
    }

    if (!allTargetsScored) break // Wait for all partners to score

    // Compare: user must beat ALL targets (strictly less)
    const userWins = targetScores.every((ts) => userScore < ts)

    if (userWins) {
      consecutiveWins++
    } else {
      // ANY target tied or beat the user — streak ends
      const modifier = consecutiveWins > 0 ? -consecutiveWins : 0
      return resolvePowerup(
        playerPowerupId,
        slug,
        consecutiveWins > 0 ? 'success' : 'failed',
        modifier,
        consecutiveWins > 0
          ? `King of the Hill ended on Hole ${hole.number}! ${consecutiveWins} hole streak! ${modifier} to your score!`
          : `King of the Hill: Lost on the first hole (Hole ${hole.number}). No bonus earned.`,
      )
    }
  }

  // Still in progress — update metadata
  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      metadata: {
        ...metadata,
        consecutiveWins,
        status: 'in_progress',
      },
    },
  })

  return {
    playerPowerupId,
    slug,
    outcome: 'in_progress',
    scoreModifier: null,
    message: consecutiveWins > 0
      ? `King of the Hill: ${consecutiveWins} hole${consecutiveWins !== 1 ? 's' : ''} won!`
      : 'King of the Hill: Waiting for scores...',
  }
}

// ─── Shared resolution helper ─────────────────────────────────────────────────

async function resolvePowerup(
  playerPowerupId: string,
  slug: string,
  outcome: 'success' | 'failed',
  scoreModifier: number,
  message: string,
): Promise<EvaluationResult> {
  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      status: 'USED',
      scoreModifier,
    },
  })

  return { playerPowerupId, slug, outcome, scoreModifier, message }
}

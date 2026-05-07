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

interface StreakerMetadata {
  declaredCount: number
  activationHoleNumber: number
  girsHit: number
  status: 'in_progress' | 'success' | 'failed'
}

interface NoThreePuttsMetadata {
  declaredCount: number
  activationHoleNumber: number
  holesPlayed: number
  status: 'in_progress' | 'success' | 'failed'
}

interface BirdieHunterMetadata {
  activationHoleNumber: number
  holesScored: number
  bonusStrokes: number
  status: 'in_progress' | 'success' | 'failed'
}

interface StayinAliveMetadata {
  activationHoleNumber: number
  holesScored: number
  hadBogey: boolean
  status: 'in_progress' | 'success' | 'failed'
}

interface DoubleOrNothingMetadata {
  targetPlayerIds: string[]
  activationHoleNumber: number
  holesScored: number
  netDelta: number
  status: 'in_progress' | 'success' | 'failed'
}

interface OnePuttWonderMetadata {
  activationHoleNumber: number
  holesScored: number
  bonusStrokes: number
  status: 'in_progress' | 'success' | 'failed'
}

interface FootWedgeMetadata {
  activationHoleNumber: number
  holesRemaining: number
  status: 'in_progress' | 'completed'
}

const BIRDIE_HUNTER_WINDOW = 3
const STAYIN_ALIVE_WINDOW = 3
const DOUBLE_OR_NOTHING_WINDOW = 3
const ONE_PUTT_WONDER_WINDOW = 9
const FOOT_WEDGE_WINDOW = 9

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
      case 'the-streaker':
        result = await evaluateStreaker(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as StreakerMetadata)
        break
      case 'no-three-putts':
        result = await evaluateNoThreePutts(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as NoThreePuttsMetadata)
        break
      case 'birdie-hunter':
        result = await evaluateBirdieHunter(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as BirdieHunterMetadata)
        break
      case 'stayin-alive':
        result = await evaluateStayinAlive(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as StayinAliveMetadata)
        break
      case 'one-putt-wonder':
        result = await evaluateOnePuttWonder(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as OnePuttWonderMetadata)
        break
      case 'foot-wedge':
        result = await evaluateFootWedge(pp.id, pp.powerup.slug, tournamentPlayerId, roundId, metadata as unknown as FootWedgeMetadata)
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
 * Evaluate ACTIVE Double or Nothing powerups where this player is the target.
 * Called when a target submits a score, so the attacker's powerup re-evaluates
 * with the new scoring data. Mirrors the king-of-the-hill target pattern.
 */
export async function evaluateAsDoubleOrNothingTarget(
  targetTournamentPlayerId: string,
  roundId: string,
): Promise<EvaluationResult[]> {
  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      roundId,
      status: 'ACTIVE',
      powerup: { slug: 'double-or-nothing' },
    },
    include: {
      powerup: { select: { slug: true, name: true } },
    },
  })

  const results: EvaluationResult[] = []

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    const targetPlayerIds = (metadata as unknown as DoubleOrNothingMetadata).targetPlayerIds
    if (!targetPlayerIds?.includes(targetTournamentPlayerId)) continue

    const result = await evaluateDoubleOrNothing(
      pp.id,
      pp.powerup.slug,
      pp.tournamentPlayerId,
      roundId,
      metadata as unknown as DoubleOrNothingMetadata,
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
      case 'the-streaker': {
        const meta = metadata as unknown as StreakerMetadata
        if (meta.girsHit >= meta.declaredCount) {
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'success', -meta.declaredCount, `The Streaker complete! -${meta.declaredCount} to your score!`)
        } else {
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'failed', 0, `The Streaker: Challenge Failed! Hit ${meta.girsHit}/${meta.declaredCount} GIRs.`)
        }
        break
      }
      case 'no-three-putts': {
        const meta = metadata as unknown as NoThreePuttsMetadata
        if (meta.holesPlayed >= meta.declaredCount) {
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'success', -meta.declaredCount, `No Three-Putts complete! -${meta.declaredCount} to your score!`)
        } else {
          result = await resolvePowerup(pp.id, pp.powerup.slug, 'failed', 0, `No Three-Putts: Challenge Failed! ${meta.holesPlayed}/${meta.declaredCount} clean holes.`)
        }
        break
      }
      case 'birdie-hunter': {
        const meta = metadata as unknown as BirdieHunterMetadata
        result = await resolvePowerup(
          pp.id,
          pp.powerup.slug,
          meta.bonusStrokes < 0 ? 'success' : 'failed',
          meta.bonusStrokes,
          meta.bonusStrokes < 0
            ? `Birdie Hunter: ${meta.bonusStrokes} bonus from ${-meta.bonusStrokes} birdie${meta.bonusStrokes === -1 ? '' : 's'}!`
            : 'Birdie Hunter: No birdies in window.',
        )
        break
      }
      case 'stayin-alive': {
        const meta = metadata as unknown as StayinAliveMetadata
        const success = !meta.hadBogey && meta.holesScored >= STAYIN_ALIVE_WINDOW
        result = await resolvePowerup(
          pp.id,
          pp.powerup.slug,
          success ? 'success' : 'failed',
          success ? -3 : 0,
          success ? `Stayin' Alive: 3 bogey-free holes! -3 to your score!` : `Stayin' Alive: Challenge Failed.`,
        )
        break
      }
      case 'double-or-nothing': {
        const meta = metadata as unknown as DoubleOrNothingMetadata
        result = await resolvePowerup(
          pp.id,
          pp.powerup.slug,
          'success',
          meta.netDelta,
          meta.netDelta === 0
            ? `Double or Nothing: net 0 across ${meta.holesScored} hole(s).`
            : `Double or Nothing: ${meta.netDelta > 0 ? '+' : ''}${meta.netDelta} delta to opponent.`,
        )
        break
      }
      case 'one-putt-wonder': {
        const meta = metadata as unknown as OnePuttWonderMetadata
        result = await resolvePowerup(
          pp.id,
          pp.powerup.slug,
          meta.bonusStrokes < 0 ? 'success' : 'failed',
          meta.bonusStrokes,
          meta.bonusStrokes < 0
            ? `One-Putt Wonder: ${meta.bonusStrokes} bonus from ${-meta.bonusStrokes} one-putt${meta.bonusStrokes === -1 ? '' : 's'}!`
            : 'One-Putt Wonder: No one-putts in window.',
        )
        break
      }
      case 'foot-wedge': {
        result = await resolvePowerup(pp.id, pp.powerup.slug, 'success', 0, 'Foot Wedge: window expired.')
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

// ─── New variable evaluators ──────────────────────────────────────────────────

async function fetchScoresAfter(
  tournamentPlayerId: string,
  roundId: string,
  activationHoleNumber: number,
) {
  return prisma.score.findMany({
    where: {
      tournamentPlayerId,
      roundId,
      hole: { number: { gt: activationHoleNumber } },
    },
    include: { hole: { select: { number: true, par: true } } },
    orderBy: { hole: { number: 'asc' } },
  })
}

async function evaluateStreaker(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: StreakerMetadata,
): Promise<EvaluationResult> {
  const { declaredCount, activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)

  let girs = 0
  for (const score of scores) {
    if (score.gir === true) {
      girs++
      if (girs >= declaredCount) {
        return resolvePowerup(playerPowerupId, slug, 'success', -declaredCount, `The Streaker complete! ${declaredCount} GIRs in a row! -${declaredCount} to your score!`)
      }
    } else if (score.strokes !== null && score.gir === false) {
      return resolvePowerup(playerPowerupId, slug, 'failed', 0, `The Streaker: Failed on Hole ${score.hole.number}.`)
    }
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, girsHit: girs, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `The Streaker: ${girs}/${declaredCount} GIRs` }
}

async function evaluateNoThreePutts(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: NoThreePuttsMetadata,
): Promise<EvaluationResult> {
  const { declaredCount, activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)

  let cleanHoles = 0
  for (const score of scores) {
    if (score.putts == null) continue // not entered yet — skip
    if (score.putts >= 3) {
      return resolvePowerup(playerPowerupId, slug, 'failed', 0, `No Three-Putts: Failed on Hole ${score.hole.number} (${score.putts} putts).`)
    }
    cleanHoles++
    if (cleanHoles >= declaredCount) {
      return resolvePowerup(playerPowerupId, slug, 'success', -declaredCount, `No Three-Putts complete! -${declaredCount} to your score!`)
    }
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesPlayed: cleanHoles, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `No Three-Putts: ${cleanHoles}/${declaredCount} clean holes` }
}

async function evaluateBirdieHunter(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: BirdieHunterMetadata,
): Promise<EvaluationResult> {
  const { activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)
  const windowScores = scores.slice(0, BIRDIE_HUNTER_WINDOW)

  let bonus = 0
  for (const score of windowScores) {
    if (score.strokes == null) continue
    if (score.strokes < score.hole.par) bonus -= 1
  }

  if (windowScores.length >= BIRDIE_HUNTER_WINDOW && windowScores.every((s) => s.strokes != null)) {
    return resolvePowerup(
      playerPowerupId,
      slug,
      bonus < 0 ? 'success' : 'failed',
      bonus,
      bonus < 0
        ? `Birdie Hunter: ${bonus} bonus from ${-bonus} birdie${bonus === -1 ? '' : 's'}!`
        : 'Birdie Hunter: No birdies in window.',
    )
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesScored: windowScores.length, bonusStrokes: bonus, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `Birdie Hunter: ${windowScores.length}/${BIRDIE_HUNTER_WINDOW} holes scored, ${bonus} bonus so far` }
}

async function evaluateStayinAlive(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: StayinAliveMetadata,
): Promise<EvaluationResult> {
  const { activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)
  const windowScores = scores.slice(0, STAYIN_ALIVE_WINDOW)

  for (const score of windowScores) {
    if (score.strokes == null) continue
    if (score.strokes > score.hole.par) {
      return resolvePowerup(playerPowerupId, slug, 'failed', 0, `Stayin' Alive: Failed on Hole ${score.hole.number}.`)
    }
  }

  if (windowScores.length >= STAYIN_ALIVE_WINDOW && windowScores.every((s) => s.strokes != null)) {
    return resolvePowerup(playerPowerupId, slug, 'success', -3, `Stayin' Alive: 3 bogey-free holes! -3 to your score!`)
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesScored: windowScores.length, hadBogey: false, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `Stayin' Alive: ${windowScores.length}/${STAYIN_ALIVE_WINDOW} clean holes` }
}

async function evaluateDoubleOrNothing(
  playerPowerupId: string,
  slug: string,
  attackerTournamentPlayerId: string,
  roundId: string,
  metadata: DoubleOrNothingMetadata,
): Promise<EvaluationResult> {
  const { targetPlayerIds, activationHoleNumber } = metadata
  if (!targetPlayerIds || targetPlayerIds.length === 0) {
    return resolvePowerup(playerPowerupId, slug, 'failed', 0, 'Double or Nothing: no target.')
  }
  const targetId = targetPlayerIds[0]

  const scores = await fetchScoresAfter(targetId, roundId, activationHoleNumber)
  const windowScores = scores.slice(0, DOUBLE_OR_NOTHING_WINDOW)

  let netDelta = 0
  for (const score of windowScores) {
    if (score.strokes == null) continue
    netDelta += score.strokes - score.hole.par
  }

  if (windowScores.length >= DOUBLE_OR_NOTHING_WINDOW && windowScores.every((s) => s.strokes != null)) {
    return resolvePowerup(
      playerPowerupId,
      slug,
      'success',
      netDelta,
      netDelta === 0
        ? `Double or Nothing: net 0 across 3 holes.`
        : `Double or Nothing: ${netDelta > 0 ? '+' : ''}${netDelta} applied to opponent.`,
    )
  }

  void attackerTournamentPlayerId
  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesScored: windowScores.length, netDelta, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `Double or Nothing: ${windowScores.length}/${DOUBLE_OR_NOTHING_WINDOW} holes scored, ${netDelta > 0 ? '+' : ''}${netDelta} so far` }
}

async function evaluateOnePuttWonder(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: OnePuttWonderMetadata,
): Promise<EvaluationResult> {
  const { activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)
  const windowScores = scores.slice(0, ONE_PUTT_WONDER_WINDOW)

  let bonus = 0
  for (const score of windowScores) {
    if (score.putts == null) continue
    if (score.putts === 1) bonus -= 1
  }

  if (windowScores.length >= ONE_PUTT_WONDER_WINDOW && windowScores.every((s) => s.strokes != null)) {
    return resolvePowerup(
      playerPowerupId,
      slug,
      bonus < 0 ? 'success' : 'failed',
      bonus,
      bonus < 0
        ? `One-Putt Wonder: ${bonus} bonus from ${-bonus} one-putt${bonus === -1 ? '' : 's'}!`
        : 'One-Putt Wonder: No one-putts in 9-hole window.',
    )
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesScored: windowScores.length, bonusStrokes: bonus, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `One-Putt Wonder: ${windowScores.length}/${ONE_PUTT_WONDER_WINDOW} holes scored, ${bonus} bonus so far` }
}

async function evaluateFootWedge(
  playerPowerupId: string,
  slug: string,
  tournamentPlayerId: string,
  roundId: string,
  metadata: FootWedgeMetadata,
): Promise<EvaluationResult> {
  const { activationHoleNumber } = metadata
  const scores = await fetchScoresAfter(tournamentPlayerId, roundId, activationHoleNumber)
  const windowScores = scores.slice(0, FOOT_WEDGE_WINDOW)
  const holesRemaining = Math.max(0, FOOT_WEDGE_WINDOW - windowScores.length)

  if (holesRemaining === 0 && windowScores.every((s) => s.strokes != null)) {
    return resolvePowerup(playerPowerupId, slug, 'success', 0, `Foot Wedge: 9-hole window complete.`)
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { metadata: { ...metadata, holesRemaining, status: 'in_progress' } },
  })
  return { playerPowerupId, slug, outcome: 'in_progress', scoreModifier: null, message: `Foot Wedge: ${holesRemaining} hole${holesRemaining === 1 ? '' : 's'} remaining` }
}

// ─── Post-hole attack evaluator ─────────────────────────────────────────────
//
// Some manual ATTACK powerups have a static modifier that should fire IF the
// targeted opponent's score on the landing hole meets a condition (e.g.
// Three-Putt Fee → +1 if opponent putts ≥ 3; Snowman → +2 if opponent strokes
// ≥ 8). These are stored as status='USED' with scoreModifier=null at
// activation time, then resolved here once the target's score lands.
//
// Called from /api/scores after the *target's* score is saved — pass the
// tournamentPlayerId of the player who just scored.

const POST_HOLE_ATTACK_SLUGS = ['three-putt-fee', 'snowman'] as const

export async function evaluatePostHoleAttacks(
  targetTournamentPlayerId: string,
  roundId: string,
): Promise<EvaluationResult[]> {
  const pending = await prisma.playerPowerup.findMany({
    where: {
      roundId,
      status: 'USED',
      scoreModifier: null,
      targetPlayerId: targetTournamentPlayerId,
      powerup: { slug: { in: POST_HOLE_ATTACK_SLUGS as unknown as string[] } },
    },
    include: {
      powerup: { select: { slug: true, name: true, effect: true } },
    },
  })

  if (pending.length === 0) return []

  const scores = await prisma.score.findMany({
    where: { tournamentPlayerId: targetTournamentPlayerId, roundId },
    select: { strokes: true, putts: true, hole: { select: { number: true } } },
  })
  const scoreByHole = new Map(scores.map((s) => [s.hole.number, s]))

  const results: EvaluationResult[] = []

  for (const pp of pending) {
    if (pp.targetHoleNumber === null) continue
    const score = scoreByHole.get(pp.targetHoleNumber)
    if (!score) continue // Target hasn't scored that hole yet — wait for the next save.

    const effect = pp.powerup.effect as { scoring: { modifier: number | null } }
    const fullModifier = effect.scoring.modifier ?? 0
    let triggered = false
    let message = ''

    if (pp.powerup.slug === 'three-putt-fee') {
      triggered = (score.putts ?? 0) >= 3
      message = triggered
        ? `Three-Putt Fee: target three-putted hole ${pp.targetHoleNumber} (+${fullModifier})`
        : `Three-Putt Fee: target avoided three-putt on hole ${pp.targetHoleNumber}`
    } else if (pp.powerup.slug === 'snowman') {
      triggered = score.strokes >= 8
      message = triggered
        ? `Snowman: target made ${score.strokes} on hole ${pp.targetHoleNumber} (+${fullModifier})`
        : `Snowman: target made ${score.strokes} on hole ${pp.targetHoleNumber}, didn't reach 8`
    }

    const modifier = triggered ? fullModifier : 0
    await prisma.playerPowerup.update({
      where: { id: pp.id },
      data: { scoreModifier: modifier },
    })

    results.push({
      playerPowerupId: pp.id,
      slug: pp.powerup.slug,
      outcome: triggered ? 'success' : 'failed',
      scoreModifier: modifier,
      message,
    })
  }

  return results
}

// ─── Pending confirmation finder ────────────────────────────────────────────
//
// Six cards have a manual trigger that can't be auto-evaluated from score
// data. We surface them as a modal prompt to the activator after the relevant
// hole is scored; their Yes/No answer is then POSTed to /resolve.

export interface PendingConfirmation {
  playerPowerupId: string
  slug: string
  name: string
  prompt: string
  modifierIfYes: number
  /** Hole the prompt relates to (BOOST: activator's hole; ATTACK: target's hole). */
  contextHoleNumber: number
  targetPlayerName: string | null
}

const CONFIRMATION_BOOST_SLUGS = ['big-brother', 'caddys-pick', 'showdown', 'twinning'] as const
const CONFIRMATION_ATTACK_SLUGS = ['drink-up', 'the-long-and-winding-road'] as const

const CONFIRMATION_PROMPTS: Record<string, string> = {
  'big-brother': 'Did you score lower than your chosen partner on this hole?',
  'caddys-pick': "Did you make par or better with your partner's club choice?",
  'showdown': 'Did you outdrive AND beat your chosen partner on this hole?',
  'twinning': 'Did you and your chosen partner score the same on this hole?',
  'drink-up': 'Did your target fail to finish their drink before the green?',
  'the-long-and-winding-road': "Did your target's ball fail to visit both rough sides?",
}

export async function findPendingConfirmations(
  currentTournamentPlayerId: string,
  roundId: string,
): Promise<PendingConfirmation[]> {
  const allSlugs: string[] = [...CONFIRMATION_BOOST_SLUGS, ...CONFIRMATION_ATTACK_SLUGS]
  const rows = await prisma.playerPowerup.findMany({
    where: {
      roundId,
      status: 'USED',
      scoreModifier: null,
      tournamentPlayerId: currentTournamentPlayerId,
      powerup: { slug: { in: allSlugs } },
    },
    include: {
      powerup: { select: { slug: true, name: true, effect: true } },
    },
  })

  if (rows.length === 0) return []

  // Pre-fetch target names + score availability in two batched queries.
  const targetIds = Array.from(new Set(rows.map((r) => r.targetPlayerId).filter((id): id is string => Boolean(id))))
  const targets = targetIds.length > 0
    ? await prisma.tournamentPlayer.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, user: { select: { name: true } } },
      })
    : []
  const nameById = new Map(targets.map((t) => [t.id, t.user.name]))

  // For BOOST cards we need the activator's score on the activation hole.
  // For ATTACK cards we need the target's score on the target hole.
  const activatorScoreHoles = rows
    .filter((r) => CONFIRMATION_BOOST_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_BOOST_SLUGS[number]))
    .map((r) => r.holeNumber)
    .filter((n): n is number => n !== null)

  const activatorScores = activatorScoreHoles.length > 0
    ? await prisma.score.findMany({
        where: {
          tournamentPlayerId: currentTournamentPlayerId,
          roundId,
          hole: { number: { in: activatorScoreHoles } },
        },
        select: { hole: { select: { number: true } } },
      })
    : []
  const scoredActivatorHoles = new Set(activatorScores.map((s) => s.hole.number))

  // Group ATTACK target lookups by targetPlayerId.
  const attackTargetPairs = rows
    .filter((r) => CONFIRMATION_ATTACK_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_ATTACK_SLUGS[number]))
    .filter((r) => r.targetPlayerId && r.targetHoleNumber !== null)
    .map((r) => ({ tpId: r.targetPlayerId!, hole: r.targetHoleNumber! }))

  const attackTargetScores = attackTargetPairs.length > 0
    ? await prisma.score.findMany({
        where: {
          OR: attackTargetPairs.map((p) => ({
            tournamentPlayerId: p.tpId,
            roundId,
            hole: { number: p.hole },
          })),
        },
        select: { tournamentPlayerId: true, hole: { select: { number: true } } },
      })
    : []
  const scoredTargetKey = new Set(attackTargetScores.map((s) => `${s.tournamentPlayerId}:${s.hole.number}`))

  const pending: PendingConfirmation[] = []

  for (const r of rows) {
    const effect = r.powerup.effect as { scoring: { modifier: number | null } }
    const fullModifier = effect.scoring.modifier ?? 0
    const isBoost = CONFIRMATION_BOOST_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_BOOST_SLUGS[number])

    let contextHole: number | null = null
    if (isBoost) {
      if (r.holeNumber === null || !scoredActivatorHoles.has(r.holeNumber)) continue
      contextHole = r.holeNumber
    } else {
      if (!r.targetPlayerId || r.targetHoleNumber === null) continue
      if (!scoredTargetKey.has(`${r.targetPlayerId}:${r.targetHoleNumber}`)) continue
      contextHole = r.targetHoleNumber
    }

    pending.push({
      playerPowerupId: r.id,
      slug: r.powerup.slug,
      name: r.powerup.name,
      prompt: CONFIRMATION_PROMPTS[r.powerup.slug] ?? 'Did the trigger fire?',
      modifierIfYes: fullModifier,
      contextHoleNumber: contextHole,
      targetPlayerName: r.targetPlayerId ? (nameById.get(r.targetPlayerId) ?? null) : null,
    })
  }

  return pending
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

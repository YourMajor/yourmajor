/**
 * Variable Powerup Evaluator
 *
 * Server-side evaluation of active variable-duration powerups.
 * Called after every score save to determine whether a challenge is
 * still in progress, succeeded, or failed.
 */

import { prisma } from '@/lib/prisma'
import { isWindowedPowerup, parsePowerupEffect } from '@/lib/powerup-engine'
import type { PowerupEffect, WindowMetadata } from '@/lib/powerup-engine'

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

// ─── Windowed cards: the generic, data-driven multi-hole engine ──────────────
//
// A windowed card declares `duration` (how many holes), `conditionalKey` (which
// per-hole rule) and `bank` (how per-hole results accumulate). Everything else
// is this one evaluator, so adding a windowed card is a seed row plus — only if
// the rule is new — one entry in HOLE_PREDICATES.
//
// This replaces the per-slug pattern below it, where each card needed its own
// evaluator, its own metadata interface, its own window constant, and its own
// branch in the activation route's metadata builder.

/** The stored facts a per-hole rule may read. The schema has no shot-level
 *  data, so this is the complete set (see src/lib/round-stats.ts:8-11). */
export interface HoleFacts {
  holeNumber: number
  par: number
  strokes: number
  putts: number | null
  fairwayHit: boolean | null
  gir: boolean | null
}

export interface PredicateContext {
  /** Previous hole in the window, for rules that compare consecutive holes. */
  previous: HoleFacts | null
  /** Index of this hole within the window, 0-based. */
  index: number
  /** The card's per-unit modifier, from effect.scoring.modifier. */
  unit: number
  /** What the player declared at activation, for the cards that ask. */
  declared: number | null
}

export interface PredicateResult {
  /** This hole's contribution to the bank. */
  delta?: number
  /** True when this hole counts toward the visible tally. */
  counted?: boolean
  /** End the card here as a failure (bank kept or wiped per `bank`). */
  fail?: boolean
  /** Lengthen the window — the escalating cards. */
  extend?: number
}

/**
 * Per-hole rules, keyed by the card's `conditionalKey`. Each reads one hole's
 * stored facts and says what it contributes.
 *
 * `unit` is the card's own `modifier`, so one rule serves cards of different
 * magnitudes: 'birdie_bonus' with unit -1 pays a stroke a birdie, with unit -2
 * it pays two.
 */
export const HOLE_PREDICATES: Record<string, (f: HoleFacts, c: PredicateContext) => PredicateResult> = {
  /** No scoring at all — the card is a rule the players apply themselves
   *  (COVID Birdie). The window exists only to drive the countdown banner. */
  none: () => ({}),

  /** Every birdie or better pays. */
  birdie_bonus: (f, c) => (f.strokes < f.par ? { delta: c.unit, counted: true } : {}),

  /** Every one-putt pays. */
  one_putt: (f, c) => (f.putts === 1 ? { delta: c.unit, counted: true } : {}),

  /** Every green in regulation pays. */
  gir_bonus: (f, c) => (f.gir === true ? { delta: c.unit, counted: true } : {}),

  /** Every fairway hit pays. Par 3s are skipped, not failed. */
  fairway_bonus: (f, c) =>
    f.par === 3 ? {} : f.fairwayHit === true ? { delta: c.unit, counted: true } : {},

  /** Par or better pays; a double bogey or worse ends the card. Par Train. */
  par_or_better: (f, c) => {
    if (f.strokes >= f.par + 2) return { fail: true }
    return f.strokes <= f.par ? { delta: c.unit, counted: true } : {}
  },

  /** Any bogey or worse ends the card; each clean hole pays. Stayin' Alive. */
  bogey_free: (f, c) => (f.strokes > f.par ? { fail: true } : { delta: c.unit, counted: true }),

  /** A three-putt ends the card; each clean hole pays. No Three-Putts. */
  no_three_putt: (f, c) => ((f.putts ?? 0) >= 3 ? { fail: true } : { delta: c.unit, counted: true }),

  /** Beat your own previous hole's score-to-par: pays AND extends the window.
   *  The escalating card — a hot streak runs longer. */
  beat_previous_hole: (f, c) => {
    if (!c.previous) return {}
    const now = f.strokes - f.par
    const before = c.previous.strokes - c.previous.par
    return now < before ? { delta: c.unit, counted: true, extend: 1 } : {}
  },

  /** Pays per stroke the subject is OVER par. Scales with how badly they play
   *  — the parasitic attacks (The Vampire). */
  over_par_drain: (f, c) => {
    const over = Math.max(0, f.strokes - f.par)
    return over > 0 ? { delta: over * c.unit, counted: true } : {}
  },

  /** Pays per birdie or better the subject makes — punishes their best golf
   *  rather than their worst (Tax Collector). */
  birdie_tax: (f, c) => (f.strokes < f.par ? { delta: c.unit, counted: true } : {}),

  /** Doubles the subject's score-to-par, in both directions: a bogey hurts
   *  them twice as much, a birdie helps them twice as much (Double or
   *  Nothing). Signed, unlike over_par_drain. */
  score_double: (f, c) => {
    const vsPar = f.strokes - f.par
    return vsPar !== 0 ? { delta: vsPar * c.unit, counted: true } : { counted: true }
  },

  /** Cancels exactly a bogey — the hole is recorded as a par. Only a bogey:
   *  a double is still a double, which is what keeps Second Wind a rescue
   *  rather than a blanket eraser. */
  bogey_rescue: (f, c) => (f.strokes === f.par + 1 ? { delta: c.unit, counted: true } : {}),

  /**
   * The player called their score before playing the hole. Nail it exactly and
   * the card pays its full value; miss by one and nothing happens; miss by two
   * or more and it costs you. A gamble, not a bonus.
   *
   * `unit` is the reward (negative). The penalty is deliberately smaller in
   * magnitude than the reward so the card is worth playing.
   */
  exact_call: (f, c) => {
    if (c.declared === null) return {}
    const off = Math.abs(f.strokes - c.declared)
    if (off === 0) return { delta: c.unit, counted: true }
    if (off === 1) return {}
    return { delta: Math.ceil(Math.abs(c.unit) / 1.5) }
  },
}

/** Cap on what a windowed card can bank, matching the hand-entered score bound
 *  elsewhere. A runaway predicate must not be able to rewrite a leaderboard. */
const MAX_BANKED_MAGNITUDE = 20

/** Windows cannot grow without bound, however hot the streak. */
const MAX_WINDOW_HOLES = 18

/**
 * Evaluate one windowed card against the holes played since it was activated.
 *
 * Which card is being tracked — the activator's own or an opponent's — depends
 * on the card: an attack with a target watches the TARGET's scores, because
 * that is whose play the rule is about.
 *
 * Returns in_progress while the window has holes left, and resolves once it is
 * full, the player has run out of holes, or a rule failed the card.
 */
export async function evaluateWindowedPowerup(
  playerPowerupId: string,
  slug: string,
  name: string,
  effect: PowerupEffect,
  activatorTournamentPlayerId: string,
  roundId: string,
  metadata: WindowMetadata,
  opts?: { finalize?: boolean },
): Promise<EvaluationResult> {
  const predicateKey = effect.scoring.conditionalKey ?? 'none'
  const predicate = HOLE_PREDICATES[predicateKey]
  const bank = effect.scoring.bank ?? 'sum'
  const unit = effect.scoring.modifier ?? 0

  if (!predicate) {
    // An unknown rule must not silently pay out. Close the card at zero and
    // say so — a seed row naming a predicate that doesn't exist is a bug we
    // want visible, not a free modifier.
    return resolvePowerup(
      playerPowerupId,
      slug,
      'failed',
      0,
      `${name}: unknown rule "${predicateKey}" — no effect applied.`,
    )
  }

  // An attack tracks its victim's card; everything else the activator's.
  const subjectId = metadata.targetPlayerIds?.[0] && effect.requiresTarget
    ? metadata.targetPlayerIds[0]
    : activatorTournamentPlayerId

  const scores = await fetchScoresAfter(subjectId, roundId, metadata.activationHoleNumber)

  // Window length starts at the card's declared duration and grows only via a
  // predicate's `extend`. Recomputed from scratch on every pass so the whole
  // evaluation is a pure function of the stored scores — re-running it after a
  // score edit can never double-count a hole.
  let windowLength = Math.min(effect.duration, MAX_WINDOW_HOLES)

  let banked = 0
  let tally = 0
  let failed = false
  let failedHole: number | null = null
  let previous: HoleFacts | null = null
  let consumed = 0

  for (const score of scores) {
    if (consumed >= windowLength) break
    if (score.strokes == null) continue

    const facts: HoleFacts = {
      holeNumber: score.hole.number,
      par: score.hole.par,
      strokes: score.strokes,
      putts: score.putts,
      fairwayHit: score.fairwayHit,
      gir: score.gir,
    }

    const result = predicate(facts, {
      previous,
      index: consumed,
      unit,
      declared: metadata.declaredCount ?? null,
    })
    consumed += 1
    previous = facts

    if (result.fail) {
      failed = true
      failedHole = facts.holeNumber
      break
    }
    if (result.counted) tally += 1
    if (result.delta) banked += result.delta
    if (result.extend) {
      windowLength = Math.min(windowLength + result.extend, MAX_WINDOW_HOLES)
    }
  }

  const holesRemaining = Math.max(0, windowLength - consumed)
  const windowComplete = holesRemaining === 0

  // Note on metadata.declaredCount: for a windowed card it is a VALUE the
  // predicate reads (Sandbagger's Bluff declares a score to match), not a
  // target the card must reach. The declared-TARGET cards (Fairway Finder, The
  // Streaker, No Three-Putts) are still on the per-slug path below, which
  // enforces their own targets. If one is ever migrated here it needs an
  // explicit flag rather than overloading this field.

  if (failed) {
    // 'wipe' and 'streak' both pay nothing once a hole fails; 'sum' keeps what
    // was banked before the failure.
    const payout = bank === 'sum' ? clampBanked(banked) : 0
    return resolvePowerup(
      playerPowerupId,
      slug,
      payout === 0 ? 'failed' : 'success',
      payout,
      payout === 0
        ? `${name}: failed on hole ${failedHole}.`
        : `${name}: ended on hole ${failedHole} — ${formatModifier(payout)} banked.`,
    )
  }

  if (windowComplete || opts?.finalize) {
    if (bank === 'none') {
      return resolvePowerup(playerPowerupId, slug, 'success', 0, `${name}: window complete.`)
    }
    // 'streak' is all or nothing: running out of holes mid-window pays nothing.
    const incompleteStreak = bank === 'streak' && !windowComplete
    const payout = incompleteStreak ? 0 : clampBanked(banked)
    const succeeded = payout !== 0
    return resolvePowerup(
      playerPowerupId,
      slug,
      // A payout that went against the holder is still a resolved card, not a
      // failure — the gamble cards can legitimately cost you.
      succeeded ? 'success' : 'failed',
      payout,
      succeeded
        ? `${name}: ${formatModifier(payout)} from ${tally} hole${tally === 1 ? '' : 's'}!`
        : `${name}: nothing earned in the window.`,
    )
  }

  await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: {
      metadata: { ...metadata, holesRemaining, tally, banked, status: 'in_progress' },
    },
  })

  return {
    playerPowerupId,
    slug,
    outcome: 'in_progress',
    scoreModifier: null,
    message:
      bank === 'none'
        ? `${name}: ${holesRemaining} hole${holesRemaining === 1 ? '' : 's'} remaining`
        : `${name}: ${holesRemaining} hole${holesRemaining === 1 ? '' : 's'} left, ${formatModifier(banked)} banked`,
  }
}

/**
 * Parse a Powerup.effect row and return it only if it describes a windowed
 * card. A malformed effect returns null so the caller falls through to the
 * per-slug path rather than throwing mid-round — a bad seed row must not stop
 * a player from posting a score.
 */
function asWindowedEffect(raw: unknown): PowerupEffect | null {
  try {
    const effect = parsePowerupEffect(raw)
    return isWindowedPowerup(effect) ? effect : null
  } catch {
    return null
  }
}

/**
 * Fill the {sin} placeholder in a confirmation prompt with the option the
 * attacker chose (The Tally). A prompt with no placeholder passes through, and
 * a missing choice degrades to generic wording rather than showing the raw
 * token to a player.
 */
function resolvePrompt(prompt: string, metadata: { selectedOption?: unknown } | null): string {
  if (!prompt.includes('{sin}')) return prompt
  const choice = metadata?.selectedOption
  return typeof choice === 'string' && choice.trim().length > 0
    ? prompt.replace('{sin}', choice.toLowerCase())
    : prompt.replace('{sin}', 'the sin they chose')
}

function clampBanked(value: number): number {
  if (!Number.isFinite(value)) return 0
  const rounded = Math.trunc(value)
  return Math.min(Math.max(rounded, -MAX_BANKED_MAGNITUDE), MAX_BANKED_MAGNITUDE)
}

function formatModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

const BIRDIE_HUNTER_WINDOW = 3
const STAYIN_ALIVE_WINDOW = 3
// The payout, which is NOT the window - they happen to both be 3 today.
const STAYIN_ALIVE_BONUS = -3
const DOUBLE_OR_NOTHING_WINDOW = 3
const ONE_PUTT_WONDER_WINDOW = 9
const FOOT_WEDGE_WINDOW = 9

// ─── Activation ──────────────────────────────────────────────────────────────

/**
 * Everything the activation route knows that a starting metadata blob needs.
 * All four fields come off the request; nothing here touches the database.
 */
export interface VariableActivationContext {
  /** The hole the card was played on. */
  holeNumber: number
  /** The declared count from a number-input card, unvalidated. */
  numberValue?: unknown
  /** Players picked in a player_select input. */
  selectedPlayerIds: string[]
  /** A single attack target, which takes precedence over the multi-select. */
  targetPlayerId?: string | null
}

/**
 * Build the starting metadata for a variable powerup.
 *
 * This lived as a 9-branch chain inside the activation route, one file away
 * from the per-slug interfaces above that consume the result and the window
 * constants it has to agree with — so adding a card meant editing two files and
 * hoping the shapes matched. Returning null means "not a variable slug", and
 * the caller keeps whatever metadata it already built.
 */
export function initialVariableMetadata(
  slug: string,
  ctx: VariableActivationContext,
): Record<string, unknown> | null {
  const activationHoleNumber = ctx.holeNumber
  const inProgress = { activationHoleNumber, status: 'in_progress' as const }

  switch (slug) {
    case 'fairway-finder':
      return { ...inProgress, declaredCount: ctx.numberValue ?? 1, fairwaysHit: 0 }
    case 'king-of-the-hill':
      return { ...inProgress, targetPlayerIds: ctx.selectedPlayerIds, consecutiveWins: 0 }
    case 'the-streaker':
      return { ...inProgress, declaredCount: ctx.numberValue ?? 1, girsHit: 0 }
    case 'no-three-putts':
      return { ...inProgress, declaredCount: ctx.numberValue ?? 2, holesPlayed: 0 }
    case 'birdie-hunter':
      return { ...inProgress, holesScored: 0, bonusStrokes: 0 }
    case 'stayin-alive':
      return { ...inProgress, holesScored: 0, hadBogey: false }
    case 'double-or-nothing':
      return {
        ...inProgress,
        targetPlayerIds: ctx.targetPlayerId ? [ctx.targetPlayerId] : ctx.selectedPlayerIds,
        holesScored: 0,
        netDelta: 0,
      }
    case 'one-putt-wonder':
      return { ...inProgress, holesScored: 0, bonusStrokes: 0 }
    case 'foot-wedge':
      // Was a hardcoded 9 in the route, one file away from the constant it has
      // to match.
      return { ...inProgress, holesRemaining: FOOT_WEDGE_WINDOW }
    default:
      return null
  }
}

/**
 * The trailing clause on the system chat message a variable activation posts.
 * Kept beside `initialVariableMetadata` because it reads the same metadata and
 * quotes the same windows. `double-or-nothing` had no branch in the route's
 * version and silently posted an empty detail.
 */
export function variableActivationDetail(
  slug: string,
  metadata: Record<string, unknown> | undefined,
): string {
  const declared = metadata?.declaredCount ?? '?'

  switch (slug) {
    case 'fairway-finder':
      return `, declaring ${declared} consecutive fairways`
    case 'king-of-the-hill':
      return ' — the streak begins next hole'
    case 'the-streaker':
      return `, declaring ${declared} consecutive GIRs`
    case 'no-three-putts':
      return `, declaring ${declared} clean holes`
    case 'birdie-hunter':
      return ` — birdies count double for the next ${BIRDIE_HUNTER_WINDOW} holes`
    case 'stayin-alive':
      return ` — bogey-free next ${STAYIN_ALIVE_WINDOW} holes for ${STAYIN_ALIVE_BONUS}`
    case 'double-or-nothing':
      return ` — every score counts double for the next ${DOUBLE_OR_NOTHING_WINDOW} holes`
    case 'one-putt-wonder':
      return ` — one-putts pay -1 each for the next ${ONE_PUTT_WONDER_WINDOW} holes`
    case 'foot-wedge':
      return ` — relocate every shot one club length for ${FOOT_WEDGE_WINDOW} holes`
    default:
      return ''
  }
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
      powerup: { select: { slug: true, name: true, effect: true } },
    },
  })

  const results: EvaluationResult[] = []

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    let result: EvaluationResult | null = null

    // Windowed cards are data-driven: no slug branch, the card describes
    // itself. The switch below is the older per-slug path, kept for the
    // player-declared challenge cards.
    const windowed = asWindowedEffect(pp.powerup.effect)
    if (windowed) {
      results.push(
        await evaluateWindowedPowerup(
          pp.id,
          pp.powerup.slug,
          pp.powerup.name,
          windowed,
          tournamentPlayerId,
          roundId,
          metadata as unknown as WindowMetadata,
        ),
      )
      continue
    }

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
      powerup: { select: { slug: true, name: true, effect: true } },
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
      powerup: { select: { slug: true, name: true, effect: true } },
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
  // Reactive cards armed but never set off close out here at zero. Without
  // this they stay ARMED for good and the player's hand never settles. They
  // carry no tracking metadata, so they are swept before the loop below —
  // which skips metadata-less rows.
  const neverFired = await prisma.playerPowerup.findMany({
    where: { tournamentPlayerId, roundId, status: 'ARMED' },
    include: { powerup: { select: { slug: true, name: true } } },
  })
  const expired: EvaluationResult[] = []
  for (const pp of neverFired) {
    expired.push(
      await resolvePowerup(pp.id, pp.powerup.slug, 'failed', 0, `${pp.powerup.name}: never triggered.`),
    )
  }
  const activePowerups = await prisma.playerPowerup.findMany({
    where: {
      tournamentPlayerId,
      roundId,
      status: 'ACTIVE',
    },
    include: {
      powerup: { select: { slug: true, name: true, effect: true } },
    },
  })

  const results: EvaluationResult[] = [...expired]

  for (const pp of activePowerups) {
    const metadata = pp.metadata as Record<string, unknown> | null
    if (!metadata) continue

    let result: EvaluationResult | null = null

    // Windowed cards resolve through the same generic evaluator, told to
    // settle up now rather than wait for the window to fill.
    const windowed = asWindowedEffect(pp.powerup.effect)
    if (windowed) {
      results.push(
        await evaluateWindowedPowerup(
          pp.id,
          pp.powerup.slug,
          pp.powerup.name,
          windowed,
          tournamentPlayerId,
          roundId,
          metadata as unknown as WindowMetadata,
          { finalize: true },
        ),
      )
      continue
    }

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
          success ? STAYIN_ALIVE_BONUS : 0,
          success
            ? `Stayin' Alive: ${STAYIN_ALIVE_WINDOW} bogey-free holes! ${STAYIN_ALIVE_BONUS} to your score!`
            : `Stayin' Alive: Challenge Failed.`,
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
    return resolvePowerup(
      playerPowerupId,
      slug,
      'success',
      STAYIN_ALIVE_BONUS,
      `Stayin' Alive: ${STAYIN_ALIVE_WINDOW} bogey-free holes! ${STAYIN_ALIVE_BONUS} to your score!`,
    )
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
  /** Yes/No cards: full modifier applied on Yes. Count cards: per-occurrence modifier. */
  modifierIfYes: number
  /** Hole the prompt relates to (BOOST: activator's hole; ATTACK: target's hole). */
  contextHoleNumber: number
  targetPlayerName: string | null
  /** 'yes_no' = binary outcome; 'count' = activator enters an occurrence count
   *  and the final modifier is count × modifierIfYes, clamped by cap. */
  inputKind: 'yes_no' | 'count'
  /** Magnitude cap for count cards (same sign as modifierIfYes). null = uncapped. */
  cap: number | null
}

export const CONFIRMATION_BOOST_SLUGS = [
  '1-vs-all',
  'albatross-aim',
  'big-brother',
  'caddys-pick',
  'chip-in-bonus',
  'greenside-magic',
  'liquid-lunch',
  'long-bomb',
  'pendulum',
  'pin-seeker',
  'sand-save',
  'showdown',
  'the-closer',
  'the-comeback',
  'the-tin-cup',
  'twinning',
  'up-and-down-artist',
] as const
export const CONFIRMATION_ATTACK_SLUGS = ['drink-up', 'the-long-and-winding-road'] as const
/** ATTACK count cards — target enters a per-occurrence count after their own hole posts. */
export const CONFIRMATION_ATTACK_COUNT_SLUGS = [
  'out-of-bounds',
  'proximity-mine',
  'the-cursed-club',
  'the-fairway-is-lava',
  'the-flop',
  'yipsy-daisy',
  // The Tally replaces four of the above (they are retired). The sin being
  // counted is the attacker's restriction_select choice, carried in
  // metadata.selectedOption and quoted back in the prompt.
  'the-tally',
] as const

/** Hard upper bound on the count input for count cards — defends the
 *  resolution endpoint when an effect has cap=null. No realistic golf hole
 *  produces more than 20 of any single trackable event. */
const COUNT_INPUT_MAX = 20

/** Validate a client-supplied scoreModifier against a powerup's slug + effect.
 *  Used by /api/tournaments/[id]/powerups/resolve to prevent participants
 *  from posting arbitrary modifier values to cheat the leaderboard. */
export function validateResolutionModifier(
  slug: string,
  effect: { scoring?: { modifier?: number | null; cap?: number | null } } | null | undefined,
  scoreModifier: number,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(scoreModifier) || !Number.isInteger(scoreModifier)) {
    return { ok: false, error: 'scoreModifier must be a finite integer' }
  }

  // 0 is always valid — represents "No" for yes/no cards or "0 occurrences"
  // for count cards. Skips the slug-membership check intentionally so that
  // a user defer/no on a borderline-typed card never errors.
  if (scoreModifier === 0) return { ok: true }

  const isYesNoBoost = (CONFIRMATION_BOOST_SLUGS as readonly string[]).includes(slug)
  const isYesNoAttack = (CONFIRMATION_ATTACK_SLUGS as readonly string[]).includes(slug)
  const isCountAttack = (CONFIRMATION_ATTACK_COUNT_SLUGS as readonly string[]).includes(slug)

  if (!isYesNoBoost && !isYesNoAttack && !isCountAttack) {
    return { ok: false, error: 'Powerup is not user-resolvable' }
  }

  const fullModifier = effect?.scoring?.modifier ?? 0
  if (fullModifier === 0) {
    return { ok: false, error: 'Powerup has no resolvable modifier' }
  }

  if (isYesNoBoost || isYesNoAttack) {
    if (scoreModifier !== fullModifier) {
      return { ok: false, error: `Yes/No powerup expects 0 or ${fullModifier}` }
    }
    return { ok: true }
  }

  // Count card path
  if (Math.sign(scoreModifier) !== Math.sign(fullModifier)) {
    return { ok: false, error: 'Modifier sign does not match powerup type' }
  }
  if (scoreModifier % fullModifier !== 0) {
    return { ok: false, error: `Modifier must be a multiple of ${fullModifier}` }
  }
  const count = scoreModifier / fullModifier
  if (count < 0 || count > COUNT_INPUT_MAX) {
    return { ok: false, error: `Count must be between 0 and ${COUNT_INPUT_MAX}` }
  }

  const cap = effect?.scoring?.cap ?? null
  if (cap !== null) {
    if (cap >= 0 && scoreModifier > cap) {
      return { ok: false, error: `Modifier exceeds cap of +${cap}` }
    }
    if (cap < 0 && scoreModifier < cap) {
      return { ok: false, error: `Modifier exceeds cap of ${cap}` }
    }
  }

  return { ok: true }
}

const CONFIRMATION_PROMPTS: Record<string, string> = {
  '1-vs-all': 'Did you beat every partner outright on this hole?',
  'albatross-aim': 'Did you reach the green in 2 shots?',
  'big-brother': 'Did you score lower than your chosen partner on this hole?',
  'caddys-pick': "Did you make par or better with your partner's club choice?",
  'chip-in-bonus': 'Did you chip in from off the green?',
  'greenside-magic': 'Did your first chip finish within 3 feet?',
  'liquid-lunch': 'Did you take a shot AND make bogey or better?',
  'long-bomb': 'Did your tee shot hit the fairway at 250+ yards?',
  'pendulum': 'Did you sink a putt with your eyes closed?',
  'pin-seeker': 'Did your tee shot land within 10 feet of the pin?',
  'sand-save': 'Did you save par from a bunker?',
  'showdown': 'Did you outdrive AND beat your chosen partner on this hole?',
  'the-closer': 'Did you sink a putt of 10 feet or longer?',
  'the-comeback': 'Did you better your previous hole score?',
  'the-tin-cup': 'Did you score par or better using only your 7-iron?',
  'twinning': 'Did you and your chosen partner score the same on this hole?',
  'up-and-down-artist': 'Did you get up-and-down from off the green?',
  // Attack prompts are answered by the target, so they read in first person
  // about the responder rather than third person about the target.
  'drink-up': 'Did you fail to finish your drink before the green?',
  'the-long-and-winding-road': "Did your ball fail to visit both rough sides?",
  // {sin} is replaced with the attacker's restriction_select choice at read
  // time — the victim is only told what was being counted after the hole is
  // played, so the secret holds while it matters.
  'the-tally': 'How many times did this happen on the hole: {sin}?',
  'out-of-bounds': 'How many OBs or lost balls did you have on this hole?',
  'proximity-mine': 'How many of your shots landed within 2 club lengths of a bunker?',
  'the-cursed-club': 'How many times did you use the cursed club on this hole?',
  'the-fairway-is-lava': "How many times did your ball touch the fairway?",
  'the-flop': 'How many of your shots came from the rough? (max 3)',
  'yipsy-daisy': 'How many short putts (inside 5 ft) did you miss?',
}

export async function findPendingConfirmations(
  currentTournamentPlayerId: string,
  roundId: string,
): Promise<PendingConfirmation[]> {
  // Boosts are answered by the activator; attacks are answered by the target —
  // the criteria describe the target's play (e.g. "Did your ball touch the
  // fairway?") which only the target can observe truthfully, especially when
  // attacker and target are on different holes.
  const rows = await prisma.playerPowerup.findMany({
    where: {
      roundId,
      status: 'USED',
      scoreModifier: null,
      OR: [
        {
          tournamentPlayerId: currentTournamentPlayerId,
          powerup: { slug: { in: CONFIRMATION_BOOST_SLUGS as unknown as string[] } },
        },
        {
          targetPlayerId: currentTournamentPlayerId,
          powerup: {
            slug: {
              in: [
                ...CONFIRMATION_ATTACK_SLUGS,
                ...CONFIRMATION_ATTACK_COUNT_SLUGS,
              ] as unknown as string[],
            },
          },
        },
      ],
    },
    include: {
      powerup: { select: { slug: true, name: true, effect: true } },
    },
  })

  if (rows.length === 0) return []

  // For attacks, the responder needs the *attacker's* name (the question
  // arrives as "{Attacker} attacked you with ..."). For boosts there's no
  // counterparty to name.
  const attackerIds = Array.from(new Set(
    rows
      .filter((r) =>
        CONFIRMATION_ATTACK_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_ATTACK_SLUGS[number]) ||
        CONFIRMATION_ATTACK_COUNT_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_ATTACK_COUNT_SLUGS[number]),
      )
      .map((r) => r.tournamentPlayerId),
  ))
  const attackers = attackerIds.length > 0
    ? await prisma.tournamentPlayer.findMany({
        where: { id: { in: attackerIds } },
        select: { id: true, user: { select: { name: true } } },
      })
    : []
  const attackerNameById = new Map(attackers.map((a) => [a.id, a.user.name]))

  // Gate on the responder having entered a score for the relevant hole.
  //   Boost  → activator (== current user) scored on r.holeNumber.
  //   Attack → target    (== current user) scored on r.targetHoleNumber.
  // The responder is the current user in both branches, so a single query keyed
  // by `tournamentPlayerId: currentTournamentPlayerId` covers both cases.
  const gatingHoles = new Set<number>()
  for (const r of rows) {
    const isBoost = CONFIRMATION_BOOST_SLUGS.includes(
      r.powerup.slug as typeof CONFIRMATION_BOOST_SLUGS[number],
    )
    const hole = isBoost ? r.holeNumber : r.targetHoleNumber
    if (hole !== null) gatingHoles.add(hole)
  }

  const gatingScores = gatingHoles.size > 0
    ? await prisma.score.findMany({
        where: {
          tournamentPlayerId: currentTournamentPlayerId,
          roundId,
          hole: { number: { in: Array.from(gatingHoles) } },
        },
        select: { hole: { select: { number: true } } },
      })
    : []
  const scoredHoles = new Set(gatingScores.map((s) => s.hole.number))

  const pending: PendingConfirmation[] = []

  for (const r of rows) {
    const effect = r.powerup.effect as { scoring: { modifier: number | null; cap?: number | null } }
    const fullModifier = effect.scoring.modifier ?? 0
    const isBoost = CONFIRMATION_BOOST_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_BOOST_SLUGS[number])
    const isCount = CONFIRMATION_ATTACK_COUNT_SLUGS.includes(r.powerup.slug as typeof CONFIRMATION_ATTACK_COUNT_SLUGS[number])

    let contextHole: number | null = null
    if (isBoost) {
      if (r.holeNumber === null || !scoredHoles.has(r.holeNumber)) continue
      contextHole = r.holeNumber
    } else {
      if (r.targetHoleNumber === null || !scoredHoles.has(r.targetHoleNumber)) continue
      contextHole = r.targetHoleNumber
    }

    pending.push({
      playerPowerupId: r.id,
      slug: r.powerup.slug,
      name: r.powerup.name,
      prompt: resolvePrompt(
        CONFIRMATION_PROMPTS[r.powerup.slug] ?? 'Did the trigger fire?',
        r.metadata as { selectedOption?: unknown } | null,
      ),
      modifierIfYes: fullModifier,
      contextHoleNumber: contextHole,
      // For attacks, this now carries the attacker's name so the modal can
      // render "{Attacker} attacked you with X". For boosts there's no name.
      targetPlayerName: isBoost ? null : (attackerNameById.get(r.tournamentPlayerId) ?? null),
      inputKind: isCount ? 'count' : 'yes_no',
      cap: typeof effect.scoring.cap === 'number' ? effect.scoring.cap : null,
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

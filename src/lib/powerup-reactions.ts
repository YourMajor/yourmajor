/**
 * Reactive powerups — cards played to lie in wait.
 *
 * Every other card in the set is fire-and-forget: it resolves against its own
 * scores and nothing another player does can touch it. A reactive card instead
 * goes ARMED and does nothing until somebody else acts, then fires by itself.
 *
 * The point is not the arithmetic. It is that once Deflectors exist, attacking
 * is a gamble even against a player holding nothing — nobody is told a card is
 * armed, so the bluff works whether or not it is real. That makes the other
 * players at the table part of the decision, which no other card does.
 *
 * Two triggers, and the difference in WHOSE row to look for is the design:
 *
 *   on_targeted  — fires when an attack is aimed at the card's HOLDER.
 *                  Look for ARMED rows whose `tournamentPlayerId` is the
 *                  victim. Self-armed protection: Deflector, Absorb.
 *
 *   on_attacking — fires when the card's TARGET plays an attack of their own.
 *                  Look for ARMED rows whose `targetPlayerId` is the attacker.
 *                  Armed *on* a rival by someone else: Tripwire.
 *
 * Reactions never trigger reactions. Arming a card is not "attacking" for
 * Tripwire's purposes, and a reaction firing is not an attack that can itself
 * be deflected. One rule, and recursion is impossible.
 */

import { prisma } from '@/lib/prisma'
import { computeAttackTargetHole, parsePowerupEffect, type PowerupEffect } from '@/lib/powerup-engine'

export type ReactionTrigger = 'on_targeted' | 'on_attacking'

/** What the reaction knows when it fires. */
export interface ReactionContext {
  /** Display name of whoever played the triggering attack. */
  attackerName: string
  /** Display name of the player who holds the reaction. */
  holderName: string
  /** Name of the attack that set this off. */
  incomingName: string
  /** The triggering attack's modifier, if it settled one at activation. */
  incomingModifier: number | null
  /**
   * The hole on the ATTACKER's own card that a bounced or punitive modifier
   * should land on — their next unscored hole. `null` when they have finished
   * the round, in which case there is nowhere for it to go.
   */
  attackerLandingHole: number | null
}

/** Overrides folded into the triggering attack before it is claimed. */
export interface IncomingOverride {
  scoreModifier?: number
  targetPlayerId?: string | null
  targetHoleNumber?: number | null
}

export interface ReactionOutcome {
  /** How the triggering attack is changed. Absent = it proceeds untouched. */
  incoming?: IncomingOverride
  /** What the reaction card itself resolves to. */
  self: {
    scoreModifier: number
    /** Set when the reaction's own effect lands on somebody else. */
    targetPlayerId?: string | null
    targetHoleNumber?: number | null
  }
  /** The public chat line. Reactions announce only when they fire. */
  message: string
}

export interface Reaction {
  trigger: ReactionTrigger
  /**
   * `subjects` carries the ids the outcome may need: who attacked, who holds
   * the reaction. Kept separate from ReactionContext's display strings so the
   * registry stays easy to test without a database.
   */
  apply(
    ctx: ReactionContext,
    subjects: { attackerPlayerId: string; holderPlayerId: string },
  ): ReactionOutcome
}

export const REACTIONS: Record<string, Reaction> = {
  /**
   * Deflector — the incoming attack is turned around and lands on whoever
   * sent it.
   *
   * If the attacker has already finished their round there is no hole left to
   * take it, so the attack is cancelled outright instead of retroactively
   * editing a closed scorecard. The reaction is still consumed either way,
   * which is what keeps a late attack into an unknown Deflector a real gamble.
   */
  deflect: {
    trigger: 'on_targeted',
    apply(ctx, subjects) {
      if (ctx.attackerLandingHole === null) {
        return {
          incoming: { scoreModifier: 0, targetPlayerId: null, targetHoleNumber: null },
          self: { scoreModifier: 0 },
          message:
            `🛡️ ${ctx.holderName} DEFLECTED ${ctx.attackerName}'s ${ctx.incomingName} — ` +
            `${ctx.attackerName} has finished, so it fizzled out.`,
        }
      }
      return {
        incoming: {
          targetPlayerId: subjects.attackerPlayerId,
          targetHoleNumber: ctx.attackerLandingHole,
        },
        self: { scoreModifier: 0 },
        message:
          `🛡️ ${ctx.holderName} DEFLECTED ${ctx.attackerName}'s ${ctx.incomingName} — ` +
          `it landed back on ${ctx.attackerName} (Hole ${ctx.attackerLandingHole}).`,
      }
    },
  },

  /**
   * Absorb — the incoming attack is cancelled and the holder banks a stroke
   * for their trouble. Turns somebody else's aggression into your advantage.
   */
  absorb: {
    trigger: 'on_targeted',
    apply(ctx) {
      return {
        incoming: { scoreModifier: 0, targetPlayerId: null, targetHoleNumber: null },
        self: { scoreModifier: ABSORB_REWARD },
        message:
          `🧲 ${ctx.holderName} ABSORBED ${ctx.attackerName}'s ${ctx.incomingName} — ` +
          `no effect, and ${ctx.holderName} takes ${ABSORB_REWARD} for it.`,
      }
    },
  },

  /**
   * Tripwire — armed on a rival rather than on yourself. The next time they
   * play an attack on anyone, they pay for it. Their attack still goes through;
   * this is a tax on attacking at all.
   *
   * The penalty lands on the attacker's own next unscored hole. If they have
   * finished there is nowhere to put it, so it lapses rather than rewriting a
   * closed card — consistent with Deflector.
   */
  tripwire: {
    trigger: 'on_attacking',
    apply(ctx, subjects) {
      if (ctx.attackerLandingHole === null) {
        return {
          self: { scoreModifier: 0 },
          message:
            `💥 ${ctx.holderName}'s Tripwire caught ${ctx.attackerName} playing ` +
            `${ctx.incomingName} — but they have finished, so it lapsed.`,
        }
      }
      return {
        self: {
          scoreModifier: TRIPWIRE_PENALTY,
          targetPlayerId: subjects.attackerPlayerId,
          targetHoleNumber: ctx.attackerLandingHole,
        },
        message:
          `💥 ${ctx.holderName}'s TRIPWIRE caught ${ctx.attackerName} playing ` +
          `${ctx.incomingName} — +${TRIPWIRE_PENALTY} on Hole ${ctx.attackerLandingHole}.`,
      }
    },
  },
}

/** What Absorb pays its holder. Negative: it helps them. */
export const ABSORB_REWARD = -1

/** What Tripwire costs the rival it catches. Positive: it hurts them. */
export const TRIPWIRE_PENALTY = 2

/**
 * The reaction a card performs, or null if it is not a reactive card or names
 * one that does not exist. Read defensively: a malformed seed row must not stop
 * a player from activating something mid-round.
 */
export function reactionFor(effect: PowerupEffect): Reaction | null {
  if (effect.scoring.mode !== 'reactive') return null
  const name = effect.scoring.reaction
  if (!name) return null
  return REACTIONS[name] ?? null
}

/**
 * Does this activation trigger reactions at all?
 *
 * Only a plain ATTACK does. A reactive card being armed must not set off a
 * Tripwire (that is the recursion guard), and a BOOST is nobody's business.
 */
export function activationTriggersReactions(
  effect: PowerupEffect,
  powerupType: string,
): boolean {
  return powerupType === 'ATTACK' && !isReactive(effect)
}

function isReactive(effect: PowerupEffect): boolean {
  return effect.scoring.mode === 'reactive'
}

// ─── Firing them: the DB side ────────────────────────────────────────────────
//
// Everything above is pure and unit-testable. Below is the orchestration the
// activation route calls, which has to read armed cards and consume them
// without two simultaneous attacks both being stopped by the same Deflector.

export interface FireReactionsResult {
  /** Overrides to fold into the triggering attack before it is claimed. */
  incoming: IncomingOverride | null
  /** Public chat lines, one per reaction that fired. */
  messages: string[]
  /** What was spent, recorded on the attack so undo can give it back. */
  consumed: Array<{ playerPowerupId: string; reaction: string }>
}

/**
 * Fire any reactions this attack sets off, consuming them.
 *
 * Order matters: `on_attacking` resolves first, because Tripwire taxes the act
 * of playing an attack regardless of what then happens to it. `on_targeted`
 * resolves second and may redirect or cancel the attack.
 *
 * Every `on_attacking` reaction fires (two rivals may both have wired you).
 * Only ONE `on_targeted` reaction fires — a single card blocks a single attack.
 */
export async function fireReactions(opts: {
  tournamentId: string
  roundId: string
  attackerPlayerId: string
  attackerName: string
  victimPlayerId: string | null
  incomingName: string
  incomingModifier: number | null
  courseHoleNumbers: number[]
}): Promise<FireReactionsResult> {
  const result: FireReactionsResult = { incoming: null, messages: [], consumed: [] }

  // Candidates: wired onto the attacker, or held by the victim. One query.
  const armed = await prisma.playerPowerup.findMany({
    where: {
      status: 'ARMED',
      tournamentPlayer: { tournamentId: opts.tournamentId },
      OR: [
        { targetPlayerId: opts.attackerPlayerId },
        ...(opts.victimPlayerId ? [{ tournamentPlayerId: opts.victimPlayerId }] : []),
      ],
    },
    select: {
      id: true,
      tournamentPlayerId: true,
      targetPlayerId: true,
      holeNumber: true,
      powerup: { select: { name: true, effect: true } },
      tournamentPlayer: { select: { user: { select: { name: true } } } },
    },
  })
  if (armed.length === 0) return result

  // Where a bounced or punitive modifier can land on the attacker's own card.
  // Null when they have finished — the reactions handle that case themselves.
  const attackerScores = await prisma.score.findMany({
    where: { tournamentPlayerId: opts.attackerPlayerId, roundId: opts.roundId },
    select: { hole: { select: { number: true } } },
  })
  const attackerLandingHole = computeAttackTargetHole(
    opts.courseHoleNumbers,
    new Set(attackerScores.map((s) => s.hole.number)),
  )

  const candidates = armed
    .map((row) => {
      let reaction: Reaction | null = null
      try {
        reaction = reactionFor(parsePowerupEffect(row.powerup.effect))
      } catch {
        // A malformed effect must not break an activation — skip the card.
        reaction = null
      }
      return { row, reaction }
    })
    .filter((c): c is { row: (typeof armed)[number]; reaction: Reaction } => c.reaction !== null)

  const ordered: ReactionTrigger[] = ['on_attacking', 'on_targeted']
  for (const trigger of ordered) {
    for (const { row, reaction } of candidates) {
      if (reaction.trigger !== trigger) continue

      // Only the right party's card fires for each trigger.
      if (trigger === 'on_attacking' && row.targetPlayerId !== opts.attackerPlayerId) continue
      if (trigger === 'on_targeted' && row.tournamentPlayerId !== opts.victimPlayerId) continue

      const outcome = reaction.apply(
        {
          attackerName: opts.attackerName,
          holderName: row.tournamentPlayer.user.name ?? 'A player',
          incomingName: opts.incomingName,
          incomingModifier: opts.incomingModifier,
          attackerLandingHole,
        },
        { attackerPlayerId: opts.attackerPlayerId, holderPlayerId: row.tournamentPlayerId },
      )

      // Claim it with the status in the predicate, so two concurrent attacks
      // cannot both be stopped by one card. Same pattern as the activation
      // claim in powerups/activate.
      const claimed = await prisma.playerPowerup.updateMany({
        where: { id: row.id, status: 'ARMED' },
        data: {
          status: 'USED',
          scoreModifier: outcome.self.scoreModifier,
          ...(outcome.self.targetPlayerId !== undefined
            ? { targetPlayerId: outcome.self.targetPlayerId }
            : {}),
          ...(outcome.self.targetHoleNumber !== undefined
            ? { targetHoleNumber: outcome.self.targetHoleNumber }
            : {}),
        },
      })
      if (claimed.count === 0) continue // somebody else's attack got it first

      result.messages.push(outcome.message)
      result.consumed.push({ playerPowerupId: row.id, reaction: reaction.trigger })
      if (outcome.incoming) {
        result.incoming = { ...(result.incoming ?? {}), ...outcome.incoming }
      }

      // One blocker per attack; taxes all stack.
      if (trigger === 'on_targeted') break
    }
  }

  return result
}

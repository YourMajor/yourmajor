/**
 * Shared draft logic — used by both API routes and client components.
 */

export interface DraftTurnInfo {
  tournamentPlayerId: string
  roundNumber: number // draft round (1-based)
  pickNumber: number  // overall pick number (1-based)
}

/**
 * Compute whose turn it is in the draft.
 *
 * @param draftOrder - array of tournamentPlayerIds in first-round order
 * @param format - LINEAR (same order every round) or SNAKE (reverses each round)
 * @param totalPicks - number of picks already made
 * @param picksPerPlayer - how many powerups each player gets
 * @returns the next turn info, or null if draft is complete
 */
export function computeCurrentTurn(
  draftOrder: string[],
  format: 'LINEAR' | 'SNAKE',
  totalPicks: number,
  picksPerPlayer: number,
): DraftTurnInfo | null {
  const playerCount = draftOrder.length
  if (playerCount === 0) return null

  const totalNeeded = playerCount * picksPerPlayer
  if (totalPicks >= totalNeeded) return null

  const round = Math.floor(totalPicks / playerCount)
  const posInRound = totalPicks % playerCount

  const isReversed = format === 'SNAKE' && round % 2 === 1
  const orderIndex = isReversed ? playerCount - 1 - posInRound : posInRound

  return {
    tournamentPlayerId: draftOrder[orderIndex],
    roundNumber: round + 1,
    pickNumber: totalPicks + 1,
  }
}

/**
 * Keep only the picks made in the draft for `tournamentRound`.
 *
 * A tournament has one Draft row, but a per-round draft runs once per
 * tournament round: `Draft.currentRound` says which one is live and every
 * pick carries the round it was made in. Turn order, the attack budget and
 * the "already picked" pool all apply within a single round's draft, so any
 * code that reasons about the live draft filters through this first.
 */
export function picksForRound<T extends { tournamentRound: number }>(
  picks: T[],
  tournamentRound: number,
): T[] {
  return picks.filter((p) => p.tournamentRound === tournamentRound)
}

export interface NextRoundDraftCheck {
  allowed: boolean
  reason?: string
  /** The tournament round the next draft would be for. */
  nextRound: number
}

/**
 * Can the admin open the draft for the next tournament round?
 *
 * Only once the current round's draft has finished, and only while the
 * tournament has a later round to draft for. Whether everyone has finished
 * scoring the current round is deliberately not a hard rule here — the admin
 * gets a warning in the UI instead, because a player who walks off after 14
 * holes would otherwise block the draft for the whole field.
 */
export function canOpenNextRoundDraft(
  draft: { status: 'PENDING' | 'ACTIVE' | 'COMPLETED'; currentRound: number },
  roundNumbers: number[],
): NextRoundDraftCheck {
  const nextRound = draft.currentRound + 1
  if (draft.status !== 'COMPLETED') {
    return {
      allowed: false,
      nextRound,
      reason: `Finish the Round ${draft.currentRound} draft before opening the next one.`,
    }
  }
  if (!roundNumbers.includes(nextRound)) {
    return {
      allowed: false,
      nextRound,
      reason: `This tournament has no Round ${nextRound} to draft for.`,
    }
  }
  return { allowed: true, nextRound }
}

/**
 * Drop a player from the draft order (e.g. they left the tournament).
 * computeCurrentTurn derives everything from draftOrder.length and the picks
 * counter, so shrinking the array is all that's needed.
 */
export function removeFromDraftOrder(draftOrder: string[], tournamentPlayerId: string): string[] {
  return draftOrder.filter((id) => id !== tournamentPlayerId)
}

/**
 * Count how many ATTACK cards a player has picked so far.
 */
export function countPlayerAttacks(
  picks: Array<{ tournamentPlayerId: string; powerupType: 'BOOST' | 'ATTACK' }>,
  tournamentPlayerId: string,
): number {
  return picks.filter(
    (p) => p.tournamentPlayerId === tournamentPlayerId && p.powerupType === 'ATTACK',
  ).length
}

export type DurationFilter = 'ALL' | 'SINGLE' | 'MULTI'

/**
 * Test whether a powerup duration matches a filter selection.
 * SINGLE  — strictly one hole (duration === 1)
 * MULTI   — any other duration: fixed multi-hole (e.g. 9) or variable (-1)
 * ALL     — passes everything
 */
export function matchesDurationFilter(duration: number, filter: DurationFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'SINGLE') return duration === 1
  return duration !== 1
}

/**
 * Check if a player can pick a given powerup.
 */
export function canPickPowerup(
  picks: Array<{ tournamentPlayerId: string; powerupType: 'BOOST' | 'ATTACK'; powerupId: string }>,
  tournamentPlayerId: string,
  powerupId: string,
  powerupType: 'BOOST' | 'ATTACK',
  maxAttacksPerPlayer: number,
): { allowed: boolean; reason?: string } {
  // Check if powerup is already picked by anyone
  if (picks.some((p) => p.powerupId === powerupId)) {
    return { allowed: false, reason: 'This powerup has already been picked.' }
  }

  // Check attack limit
  if (powerupType === 'ATTACK') {
    const currentAttacks = countPlayerAttacks(picks, tournamentPlayerId)
    if (currentAttacks >= maxAttacksPerPlayer) {
      return {
        allowed: false,
        reason: `You already have ${maxAttacksPerPlayer} attack card${maxAttacksPerPlayer === 1 ? '' : 's'} (max).`,
      }
    }
  }

  return { allowed: true }
}

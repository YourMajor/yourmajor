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

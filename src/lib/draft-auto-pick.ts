import { canPickPowerup } from './draft-utils'

export interface AutoPickCandidate {
  id: string
  type: 'BOOST' | 'ATTACK'
}

export interface AutoPickPickHistory {
  tournamentPlayerId: string
  powerupType: 'BOOST' | 'ATTACK'
  powerupId: string
}

/**
 * Pick a random valid powerup for a player whose turn timer has expired.
 *
 * Prefers BOOST when both BOOST and ATTACK are valid choices — a missed turn
 * shouldn't burn the player's limited attack budget. If only attacks are
 * valid, returns one of those.
 *
 * Returns null only when there are literally no valid candidates (which
 * means the tournament was misconfigured: too few powerups for the player
 * count).
 */
export function selectAutoPickPowerupId(
  picks: AutoPickPickHistory[],
  tournamentPlayerId: string,
  candidates: AutoPickCandidate[],
  maxAttacksPerPlayer: number,
  random: () => number = Math.random,
): string | null {
  const valid = candidates.filter(
    (c) =>
      canPickPowerup(picks, tournamentPlayerId, c.id, c.type, maxAttacksPerPlayer).allowed,
  )

  if (valid.length === 0) return null

  const boosts = valid.filter((c) => c.type === 'BOOST')
  const pool = boosts.length > 0 ? boosts : valid
  const idx = Math.floor(random() * pool.length)
  return pool[idx].id
}

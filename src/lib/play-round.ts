export interface PlayableRound {
  id: string
  roundNumber: number
  holeCount: number
}

/**
 * Which round /play opens when the URL doesn't name one.
 *
 * It used to always open the first round, so once Round 1 was posted there
 * was no way into Round 2 short of typing ?round=2. Now it opens the first
 * round (in order) where this player still has holes to score; once every
 * round is complete it shows the last one.
 */
export function pickDefaultRound<T extends PlayableRound>(
  rounds: T[],
  scoredHolesByRoundId: Map<string, number>,
): T | undefined {
  const ordered = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)
  const open = ordered.find((r) => (scoredHolesByRoundId.get(r.id) ?? 0) < r.holeCount)
  return open ?? ordered[ordered.length - 1]
}

/** How long a finished card stays editable, for fixing a typo after the 18th. */
export const CARD_EDIT_GRACE_MS = 30 * 60 * 1000

/**
 * A player's card for a round is locked (read-only) once every hole has a
 * score and the grace period since the last hole went in has passed. After
 * that, corrections go through an admin.
 *
 * @param lastScoredAt when the final hole was first entered (max submittedAt)
 */
export function isCardLocked(
  card: { holeCount: number; scoredCount: number; lastScoredAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (card.holeCount <= 0 || card.scoredCount < card.holeCount) return false
  if (!card.lastScoredAt) return true
  return now.getTime() - card.lastScoredAt.getTime() >= CARD_EDIT_GRACE_MS
}

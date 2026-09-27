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

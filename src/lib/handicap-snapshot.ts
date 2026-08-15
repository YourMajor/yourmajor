import type { Prisma } from '@/generated/prisma/client'

/**
 * Freeze a player's current profile handicap onto the TournamentPlayer row
 * being activated into an event.
 *
 * `TournamentPlayer.handicap` is a snapshot: the leaderboard computes net
 * scores from it alone (src/lib/scoring.ts) and season points follow from
 * those ranks, so it must not move once an event is under way. Rows created
 * as non-participants — the tournament creator, a watcher, an admin — take
 * the schema default of 0, and the paths that later turn them into players
 * used to leave that 0 in place. Scoring covered it by falling back to the
 * live profile handicap; it no longer does, so the value has to be written
 * here instead.
 *
 * Two conditions gate the write, and both are required:
 *
 *  - `handicap: 0` — anything non-zero is already a real snapshot, set at
 *    registration or by an admin. Overwriting it would change results for
 *    players this activation has nothing to do with.
 *  - `scores: { none: {} }` — once a card exists it was played against the
 *    stored value. A stored 0 is *not* proof the row never scored: removing a
 *    player clears `isParticipant` but an admin-removed row can still hold
 *    scores, so the count has to be checked rather than inferred.
 *
 * Both live in the `where` of a single `updateMany`, so the check and the
 * write are one statement and cannot race a score landing in between.
 *
 * @param db      Prisma client or transaction client.
 * @param profileHandicap The player's current profile handicap.
 * @returns true if the snapshot was written.
 */
export async function snapshotHandicapOnActivation(
  db: Prisma.TransactionClient,
  tournamentPlayerId: string,
  profileHandicap: number,
): Promise<boolean> {
  // Writing 0 over 0 is the only thing this could do; skip the round-trip.
  if (!profileHandicap) return false

  const { count } = await db.tournamentPlayer.updateMany({
    where: { id: tournamentPlayerId, handicap: 0, scores: { none: {} } },
    data: { handicap: profileHandicap },
  })
  return count > 0
}

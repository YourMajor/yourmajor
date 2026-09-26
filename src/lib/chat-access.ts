import { prisma } from './prisma'

export type ChatAccess =
  | { allowed: true; tournamentPlayerId: string | null }
  | { allowed: false; status: 403 | 404; error: string }

/**
 * Who may read and post in a tournament's chat.
 *
 * Anyone with a TournamentPlayer row — players, admins and watchers — always
 * could. Bystanders without a row are allowed too, on the same terms as
 * anonymous spectating of the leaderboard: every tournament except INVITE
 * (the codebase's notion of private). INVITE stays members-only.
 *
 * With `enrollAsWatcher`, a bystander who gets through is recorded as a
 * watcher (the same row tournaments/find creates). That puts the tournament
 * under "Watching" for them and satisfies the realtime RLS policy, which only
 * streams messages to users with a row.
 */
export async function resolveChatAccess(
  tournamentId: string,
  userId: string,
  opts: { enrollAsWatcher?: boolean } = {},
): Promise<ChatAccess> {
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true },
  })
  if (membership) return { allowed: true, tournamentPlayerId: membership.id }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { tournamentType: true },
  })
  if (!tournament) return { allowed: false, status: 404, error: 'Tournament not found' }
  if (tournament.tournamentType === 'INVITE') {
    return { allowed: false, status: 403, error: 'Not a tournament participant' }
  }

  if (!opts.enrollAsWatcher) return { allowed: true, tournamentPlayerId: null }

  // Empty update: if a row appeared in the meantime it keeps its flags.
  const row = await prisma.tournamentPlayer.upsert({
    where: { tournamentId_userId: { tournamentId, userId } },
    create: {
      tournamentId,
      userId,
      isParticipant: false,
      isAdmin: false,
      isWatching: true,
    },
    update: {},
    select: { id: true },
  })
  return { allowed: true, tournamentPlayerId: row.id }
}

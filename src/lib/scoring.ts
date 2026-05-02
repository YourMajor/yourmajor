import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getStrategy } from '@/lib/formats'
import type { ScoringContext } from '@/lib/formats/types'

// Re-export everything from scoring-utils so existing imports still work
export {
  scoreName,
  scoreClass,
  formatVsPar,
  allocateHandicapStrokes,
  callawayDeduction,
  getCallawayAdjustment,
  stablefordPoints,
  STABLEFORD_DEFAULT,
  MODIFIED_STABLEFORD_DEFAULT,
} from '@/lib/scoring-utils'
export type { HoleResult, PlayerStanding } from '@/lib/scoring-utils'

export async function getLeaderboard(
  tournamentId: string,
  roundId?: string,
) {
  const [players, rounds, tournament, teams] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, isParticipant: true },
      select: {
        id: true,
        userId: true,
        handicap: true,
        // Only the user fields actually rendered: name + avatar paths.
        // Skipping email/phone/role/smsNotifications and the rest of User
        // shaves the per-row payload roughly in half.
        user: {
          select: {
            name: true,
            email: true,
            image: true,
            profile: { select: { handicap: true, avatar: true } },
          },
        },
        scores: {
          where: roundId ? { roundId } : undefined,
          select: {
            strokes: true,
            hole: { select: { number: true, par: true, handicap: true } },
            round: { select: { roundNumber: true, courseId: true } },
          },
        },
        playerPowerups: {
          where: { status: 'USED' },
          select: { scoreModifier: true },
        },
        teamMembership: { select: { teamId: true } },
      },
    }),
    prisma.tournamentRound.findMany({
      where: { tournamentId },
      include: { course: { select: { par: true, holes: { select: { number: true, par: true, handicap: true } } } } },
      orderBy: { roundNumber: 'asc' },
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { handicapSystem: true, tournamentFormat: true, formatConfig: true },
    }),
    prisma.tournamentTeam.findMany({
      where: { tournamentId },
      include: { members: { select: { tournamentPlayerId: true } } },
    }),
  ])

  const handicapSystem = tournament?.handicapSystem ?? 'WHS'
  // Effective format: if the tournament is on legacy STROKE_PLAY but the handicap system
  // is set to STABLEFORD, treat that as a STABLEFORD-format event so legacy data keeps
  // its old scoring behaviour.
  const declaredFormat = tournament?.tournamentFormat ?? 'STROKE_PLAY'
  const effectiveFormat =
    declaredFormat === 'STROKE_PLAY' && handicapSystem === 'STABLEFORD'
      ? 'STABLEFORD'
      : declaredFormat

  // Canonical hole list: take the first round's course holes.
  const canonicalHoles = (rounds[0]?.course.holes ?? []).map((h) => ({
    number: h.number,
    par: h.par,
    handicap: h.handicap,
  }))

  const ctx: ScoringContext = {
    tournamentId,
    format: effectiveFormat as ScoringContext['format'],
    formatConfig: (tournament?.formatConfig ?? null) as Record<string, unknown> | null,
    handicapSystem: handicapSystem as ScoringContext['handicapSystem'],
    holes: canonicalHoles,
    rounds: rounds.map((r) => ({ roundNumber: r.roundNumber, par: r.course.par })),
    players: players.map((p) => {
      const name = p.user.name ?? p.user.email.split('@')[0]
      const avatarUrl = p.user.profile?.avatar ?? p.user.image ?? null
      const effectiveHandicap = p.handicap || p.user.profile?.handicap || 0
      const scoreModifier = p.playerPowerups.reduce(
        (sum: number, pp: { scoreModifier: number | null }) => sum + (pp.scoreModifier ?? 0),
        0,
      )
      return {
        tournamentPlayerId: p.id,
        userId: p.userId,
        name,
        avatarUrl,
        handicap: effectiveHandicap,
        scoreModifier,
        teamId: p.teamMembership?.teamId ?? null,
        scores: p.scores.map((s) => ({
          holeNumber: s.hole.number,
          par: s.hole.par,
          strokes: s.strokes,
          handicap: s.hole.handicap,
          roundNumber: s.round.roundNumber,
        })),
      }
    }),
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      memberIds: t.members.map((m) => m.tournamentPlayerId),
    })),
  }

  const strategy = getStrategy(effectiveFormat)
  return strategy.computeStandings(ctx)
}

/**
 * Tag-cached leaderboard read for use in season aggregations where the same
 * COMPLETED tournament's standings are needed across many requests. ACTIVE /
 * REGISTRATION tournaments bypass the cache so live leaderboards stay fresh.
 *
 * Bust the cache for a tournament after admin edits or status change with
 * `revalidateTag(\`leaderboard-${tournamentId}\`)`.
 */
export async function getCachedLeaderboard(
  tournamentId: string,
  status: string,
) {
  if (status !== 'COMPLETED') return getLeaderboard(tournamentId)
  return unstable_cache(
    async () => getLeaderboard(tournamentId),
    [`leaderboard-${tournamentId}`],
    { tags: [`leaderboard-${tournamentId}`, 'leaderboard'] },
  )()
}

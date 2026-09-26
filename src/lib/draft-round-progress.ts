import { prisma } from './prisma'
import { isSingleTeamScoreFormat } from './formats'

export interface RoundFinishProgress {
  roundNumber: number
  finished: number
  total: number
  /** Names of participants who haven't finished yet (for the admin warning). */
  unfinishedNames: string[]
}

/**
 * Pure part of the round-progress check, so it can be tested without a DB.
 *
 * A participant has finished a round once every hole of that round's course
 * has a score. In single-team-score formats (scramble etc.) the team's one
 * score row lives under whichever member is the team anchor, so a player
 * counts as finished when anyone on their team has the full card.
 */
export function countFinishedPlayers(input: {
  participantIds: string[]
  holeCount: number
  scoredHolesByPlayer: Map<string, Set<number>>
  /** teamId per tournamentPlayerId; only used when teamScored is true */
  teamOf?: Map<string, string>
  teamScored: boolean
}): { finishedIds: Set<string> } {
  const { participantIds, holeCount, scoredHolesByPlayer, teamOf, teamScored } = input
  const finishedIds = new Set<string>()
  if (holeCount <= 0) return { finishedIds }

  const ownDone = (id: string) => (scoredHolesByPlayer.get(id)?.size ?? 0) >= holeCount

  const doneTeams = new Set<string>()
  if (teamScored && teamOf) {
    for (const id of participantIds) {
      const team = teamOf.get(id)
      if (team && ownDone(id)) doneTeams.add(team)
    }
  }

  for (const id of participantIds) {
    if (ownDone(id)) {
      finishedIds.add(id)
      continue
    }
    const team = teamOf?.get(id)
    if (teamScored && team && doneTeams.has(team)) finishedIds.add(id)
  }
  return { finishedIds }
}

/**
 * How many participants have finished scoring a tournament round. Used to
 * warn the admin before opening the next round's draft while people are
 * still on the course.
 */
export async function getRoundFinishProgress(
  tournamentId: string,
  roundNumber: number,
): Promise<RoundFinishProgress | null> {
  const [tournament, round, participants] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { tournamentFormat: true },
    }),
    prisma.tournamentRound.findFirst({
      where: { tournamentId, roundNumber },
      select: { id: true, course: { select: { _count: { select: { holes: true } } } } },
    }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, isParticipant: true },
      select: {
        id: true,
        user: { select: { name: true, email: true } },
        teamMembership: { select: { teamId: true } },
      },
    }),
  ])
  if (!tournament || !round) return null

  const scores = await prisma.score.findMany({
    where: { roundId: round.id, tournamentPlayer: { tournamentId } },
    select: { tournamentPlayerId: true, holeId: true },
  })

  const scoredHolesByPlayer = new Map<string, Set<number>>()
  // Distinct holes per player; holeId is as good as the hole number for a count.
  const holeIndex = new Map<string, number>()
  for (const s of scores) {
    let idx = holeIndex.get(s.holeId)
    if (idx === undefined) {
      idx = holeIndex.size
      holeIndex.set(s.holeId, idx)
    }
    let set = scoredHolesByPlayer.get(s.tournamentPlayerId)
    if (!set) {
      set = new Set()
      scoredHolesByPlayer.set(s.tournamentPlayerId, set)
    }
    set.add(idx)
  }

  const teamOf = new Map<string, string>()
  for (const p of participants) {
    if (p.teamMembership) teamOf.set(p.id, p.teamMembership.teamId)
  }

  const { finishedIds } = countFinishedPlayers({
    participantIds: participants.map((p) => p.id),
    holeCount: round.course._count.holes,
    scoredHolesByPlayer,
    teamOf,
    teamScored: isSingleTeamScoreFormat(tournament.tournamentFormat),
  })

  return {
    roundNumber,
    finished: finishedIds.size,
    total: participants.length,
    unfinishedNames: participants
      .filter((p) => !finishedIds.has(p.id))
      .map((p) => p.user.name ?? p.user.email.split('@')[0]),
  }
}

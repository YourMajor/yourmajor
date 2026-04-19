/**
 * Computes the expected status based on round dates (or tournament dates as fallback).
 * Only auto-advances REGISTRATION → ACTIVE → COMPLETED.
 * Never auto-advances from COMPLETED or reverses a status.
 * Returns null if no change is needed.
 */
export function computeExpectedStatus(
  currentStatus: string,
  rounds: { date: Date | null }[],
  tournamentStartDate?: Date | null,
  tournamentEndDate?: Date | null,
): string | null {
  if (currentStatus === 'COMPLETED') return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = rounds
    .map((r) => r.date)
    .filter(Boolean)
    .map((d) => {
      const x = new Date(d!)
      x.setHours(0, 0, 0, 0)
      return x
    })

  // If rounds have no dates, fall back to tournament start/end dates
  // (common for open registration tournaments where players play anytime)
  if (dates.length === 0) {
    if (!tournamentStartDate && !tournamentEndDate) return null
    if (tournamentStartDate) {
      const start = new Date(tournamentStartDate)
      start.setHours(0, 0, 0, 0)
      if (currentStatus === 'REGISTRATION' && today >= start) return 'ACTIVE'
    }
    if (tournamentEndDate) {
      const end = new Date(tournamentEndDate)
      end.setHours(0, 0, 0, 0)
      const dayAfterEnd = new Date(end)
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1)
      if (currentStatus === 'ACTIVE' && today >= dayAfterEnd) return 'COMPLETED_PENDING'
    }
    return null
  }

  const firstRound = new Date(Math.min(...dates.map((d) => d.getTime())))
  const lastRound = new Date(Math.max(...dates.map((d) => d.getTime())))
  const dayAfterLast = new Date(lastRound)
  dayAfterLast.setDate(dayAfterLast.getDate() + 1)

  if (currentStatus === 'REGISTRATION' && today >= firstRound) return 'ACTIVE'
  if (currentStatus === 'ACTIVE' && today >= dayAfterLast) return 'COMPLETED_PENDING'
  return null
}

/**
 * Checks if all registered players have submitted scores for every hole in every round.
 */
async function allPlayersComplete(tournamentId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')
  const [players, rounds] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, isParticipant: true },
      select: { id: true },
    }),
    prisma.tournamentRound.findMany({
      where: { tournamentId },
      include: { course: { select: { holes: { select: { id: true } } } } },
    }),
  ])

  if (players.length === 0 || rounds.length === 0) return false

  // Single query to count scores per (player, round) — avoids N+1
  const scoreCounts = await prisma.score.groupBy({
    by: ['tournamentPlayerId', 'roundId'],
    where: {
      tournamentPlayerId: { in: players.map((p) => p.id) },
      roundId: { in: rounds.map((r) => r.id) },
    },
    _count: { id: true },
  })

  const countMap = new Map<string, number>()
  for (const row of scoreCounts) {
    countMap.set(`${row.tournamentPlayerId}:${row.roundId}`, row._count.id)
  }

  for (const player of players) {
    for (const round of rounds) {
      const holeCount = round.course.holes.length
      if (holeCount === 0) continue
      const submitted = countMap.get(`${player.id}:${round.id}`) ?? 0
      if (submitted < holeCount) return false
    }
  }

  return true
}

/**
 * Checks if the tournament status should auto-advance based on round dates and
 * (for ACTIVE→COMPLETED) whether all players have completed all hole scores.
 * Updates the DB if advancing, and returns the effective status.
 */
export async function maybeAutoAdvanceStatus(
  tournamentId: string,
  currentStatus: string,
  rounds: { date: Date | null }[],
  tournamentStartDate?: Date | null,
  tournamentEndDate?: Date | null,
): Promise<string> {
  const next = computeExpectedStatus(currentStatus, rounds, tournamentStartDate, tournamentEndDate)
  if (!next) return currentStatus

  const { prisma } = await import('@/lib/prisma')

  // REGISTRATION → ACTIVE: date-based only
  if (next === 'ACTIVE') {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'ACTIVE' },
    })
    return 'ACTIVE'
  }

  // ACTIVE → COMPLETED: also require all players to have completed all holes
  if (next === 'COMPLETED_PENDING') {
    const complete = await allPlayersComplete(tournamentId)
    if (!complete) return currentStatus  // date passed but scores not all in — stay ACTIVE
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'COMPLETED' },
    })
    return 'COMPLETED'
  }

  return currentStatus
}

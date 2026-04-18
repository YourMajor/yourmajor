import { prisma } from '@/lib/prisma'

export interface PastChampion {
  slug: string
  headerImage: string | null
  tournamentName: string
  year: number
  startDate: string | null
  endDate: string | null
  championName: string
  championUserId: string
  championAvatarUrl: string | null
  grossTotal: number | null
  grossVsPar: number | null
  roundScores: number[]
}

export interface AncestorTournament {
  id: string
  slug: string
  name: string
  headerImage: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  championUserId: string | null
  championName: string | null
  parentTournamentId: string | null
}

/**
 * Walk the parentTournamentId chain backwards, returning ancestors
 * ordered most-recent-first. Does NOT include the current tournament.
 */
export async function getAncestorChain(tournamentId: string): Promise<AncestorTournament[]> {
  const ancestors: AncestorTournament[] = []
  let currentId: string | null = tournamentId

  // First fetch the current tournament to get its parent
  const current = await prisma.tournament.findUnique({
    where: { id: currentId },
    select: { parentTournamentId: true },
  })
  currentId = current?.parentTournamentId ?? null

  while (currentId) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        slug: true,
        name: true,
        headerImage: true,
        status: true,
        startDate: true,
        endDate: true,
        championUserId: true,
        championName: true,
        parentTournamentId: true,
      },
    })
    if (!t) break
    ancestors.push(t)
    currentId = t.parentTournamentId
  }

  return ancestors
}

export interface LatestTournament {
  slug: string
  name: string
}

/**
 * Walk the childTournaments chain forward from the given tournament,
 * returning the most recent (latest) descendant. Returns null if this
 * tournament IS the latest (has no children).
 */
export async function getLatestInChain(tournamentId: string): Promise<LatestTournament | null> {
  let currentId = tournamentId
  let latest: { slug: string; name: string } | null = null

  for (let i = 0; i < 20; i++) {
    const child = await prisma.tournament.findFirst({
      where: { parentTournamentId: currentId },
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!child) break
    latest = { slug: child.slug, name: child.name }
    currentId = child.id
  }

  return latest
}

/**
 * Returns past champion history with rich data (avatar, scores, dates).
 * Ordered most-recent-first. Only includes completed tournaments with a champion.
 */
export async function getChampionHistory(tournamentId: string): Promise<PastChampion[]> {
  const ancestors = await getAncestorChain(tournamentId)
  const completed = ancestors.filter(
    (t) => t.status === 'COMPLETED' && t.championUserId && t.championName
  )

  const champions: PastChampion[] = []

  for (const t of completed) {
    // Fetch champion's avatar
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: t.championUserId! },
      select: { avatar: true },
    })
    const user = !profile
      ? await prisma.user.findUnique({
          where: { id: t.championUserId! },
          select: { image: true },
        })
      : null

    // Fetch champion's scores for this tournament
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: t.id, userId: t.championUserId! } },
      select: { id: true },
    })

    let grossTotal: number | null = null
    let grossVsPar: number | null = null
    let roundScores: number[] = []

    if (membership) {
      const scores = await prisma.score.findMany({
        where: { tournamentPlayerId: membership.id },
        include: {
          hole: { select: { par: true } },
          round: { select: { roundNumber: true } },
        },
      })

      if (scores.length > 0) {
        grossTotal = scores.reduce((sum, s) => sum + s.strokes, 0)
        const totalPar = scores.reduce((sum, s) => sum + (s.hole?.par ?? 4), 0)
        grossVsPar = grossTotal - totalPar

        // Group by round
        const byRound = new Map<number, number>()
        for (const s of scores) {
          const rn = s.round.roundNumber
          byRound.set(rn, (byRound.get(rn) ?? 0) + s.strokes)
        }
        roundScores = Array.from(byRound.entries())
          .sort(([a], [b]) => a - b)
          .map(([, total]) => total)
      }
    }

    champions.push({
      slug: t.slug,
      headerImage: t.headerImage,
      tournamentName: t.name,
      year: t.startDate ? t.startDate.getFullYear() : t.endDate ? t.endDate.getFullYear() : 0,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      championName: t.championName!,
      championUserId: t.championUserId!,
      championAvatarUrl: profile?.avatar ?? user?.image ?? null,
      grossTotal,
      grossVsPar,
      roundScores,
    })
  }

  return champions
}

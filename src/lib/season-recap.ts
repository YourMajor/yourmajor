import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'


export interface EventRecap {
  tournamentId: string
  tournamentSlug: string
  tournamentName: string
  date: string | null
  winner: { name: string; avatarUrl: string | null; grossVsPar: number | null }
  highlights: RecapHighlight[]
}

export interface RecapHighlight {
  type: 'most_birdies' | 'most_improved' | 'fewest_bogeys' | 'best_round'
  label: string
  playerName: string
  value: string
}

export async function getLatestEventRecap(tournamentId: string): Promise<EventRecap | null> {
  // Find the most recently completed tournament in the chain
  let currentId: string | null = tournamentId
  const chain: { id: string; slug: string; name: string; status: string; startDate: Date | null }[] = []

  // Walk up to root
  while (currentId) {
    const t: { id: string; slug: string; name: string; status: string; startDate: Date | null; parentTournamentId: string | null } | null = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, slug: true, name: true, status: true, startDate: true, parentTournamentId: true },
    })
    if (!t) break
    chain.unshift(t)
    currentId = t.parentTournamentId
  }

  // Walk down from original to find descendants
  let childSearch = [tournamentId]
  for (let i = 0; i < 100; i++) {
    const children = await prisma.tournament.findMany({
      where: { parentTournamentId: { in: childSearch } },
      select: { id: true, slug: true, name: true, status: true, startDate: true },
    })
    if (children.length === 0) break
    chain.push(...children)
    childSearch = children.map((c) => c.id)
  }

  // Find the most recent completed event
  const completed = chain
    .filter((t) => t.status === 'COMPLETED')
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return b.startDate.getTime() - a.startDate.getTime()
    })

  const latestCompleted = completed[0]
  if (!latestCompleted) return null

  const standings = await getLeaderboard(latestCompleted.id)
  if (standings.length === 0) return null

  const winner = standings[0]

  // Compute highlights
  const highlights: RecapHighlight[] = []

  // Most birdies
  let maxBirdies = 0
  let birdiePlayer = ''
  for (const s of standings) {
    const birdies = s.holes.filter((h) => h.diff === -1).length
    if (birdies > maxBirdies) {
      maxBirdies = birdies
      birdiePlayer = s.playerName
    }
  }
  if (maxBirdies > 0) {
    highlights.push({
      type: 'most_birdies',
      label: 'Most Birdies',
      playerName: birdiePlayer,
      value: `${maxBirdies} birdies`,
    })
  }

  // Fewest bogeys (among players who played at least 9 holes)
  let minBogeys = Infinity
  let bogeyPlayer = ''
  for (const s of standings) {
    if (s.holesPlayed < 9) continue
    const bogeys = s.holes.filter((h) => h.diff !== null && h.diff > 0).length
    if (bogeys < minBogeys) {
      minBogeys = bogeys
      bogeyPlayer = s.playerName
    }
  }
  if (minBogeys < Infinity) {
    highlights.push({
      type: 'fewest_bogeys',
      label: 'Fewest Bogeys',
      playerName: bogeyPlayer,
      value: `${minBogeys} bogey${minBogeys !== 1 ? 's' : ''}`,
    })
  }

  return {
    tournamentId: latestCompleted.id,
    tournamentSlug: latestCompleted.slug,
    tournamentName: latestCompleted.name,
    date: latestCompleted.startDate?.toISOString() ?? null,
    winner: {
      name: winner.playerName,
      avatarUrl: winner.avatarUrl,
      grossVsPar: winner.grossVsPar,
    },
    highlights,
  }
}

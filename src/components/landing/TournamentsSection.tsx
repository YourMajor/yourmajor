import { prisma } from '@/lib/prisma'
import { TournamentsPanel } from './TournamentsPanel'
import type { TournamentData } from './TournamentCardGrid'

/**
 * The server half of the clubhouse: featured events come from the database,
 * local ones need the browser's location, so the fetch and the panel are
 * split across the boundary rather than across the page.
 *
 * "Featured" is a deliberate, rare act — a public event we push out for
 * everyone to see. Most of the time this returns nothing and the panel
 * simply shows the local list instead.
 */
async function fetchFeatured(): Promise<TournamentData[]> {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        tournamentType: 'PUBLIC',
        isOpenRegistration: false,
        status: { in: ['REGISTRATION', 'ACTIVE'] },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logo: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: { select: { players: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 6,
    })
    return tournaments.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      logo: t.logo,
      status: t.status,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      playerCount: t._count.players,
      featured: true,
    }))
  } catch {
    return []
  }
}

export async function TournamentsSection() {
  return <TournamentsPanel featured={await fetchFeatured()} />
}

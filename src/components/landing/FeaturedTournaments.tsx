import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TournamentCardGrid } from './TournamentCardGrid'

async function fetchFeatured() {
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
      take: 9,
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
    }))
  } catch {
    return []
  }
}

export async function FeaturedTournaments() {
  const serialized = await fetchFeatured()

  return (
    <section className="mk-section">
      <h2>Featured tournaments</h2>
      <p className="mt-4 max-w-[65ch] text-base lg:text-lg" style={{ color: 'var(--mk-text-muted)' }}>
        Public events taking entries right now.
      </p>

      <div className="mt-10">
        {serialized.length > 0 ? (
          <TournamentCardGrid
            tournaments={serialized}
            emptyMessage="No featured tournaments in this month."
          />
        ) : (
          /* An invitation, not a report of absence. Nothing here is invented:
             the section is genuinely empty until someone opens an event. */
          <div
            className="flex flex-col items-start px-6 py-10"
            style={{
              border: '1px dashed var(--mk-rule-gold)',
              borderRadius: 'var(--mk-radius-lg)',
            }}
          >
            <p className="max-w-[52ch] text-base leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
              Public tournaments show up here as organisers open them. Start one and yours
              is the first.
            </p>
            <Link href="/auth/signup" className="mk-btn mk-btn-primary mt-7">
              Create a tournament
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

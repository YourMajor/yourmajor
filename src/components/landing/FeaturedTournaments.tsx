import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TournamentCardGrid } from './TournamentCardGrid'

async function fetchFeatured() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        isOpenRegistration: true,
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
    <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
      {/* Section header */}
      <div className="text-center mb-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
          Featured Tournaments
        </h2>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Open tournaments looking for players
        </p>
        <div className="w-12 h-0.5 rounded-full bg-accent mx-auto mt-4" />
      </div>

      {serialized.length > 0 ? (
        <TournamentCardGrid
          tournaments={serialized}
          emptyMessage="No tournaments with open registration right now."
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            No tournaments with open registration right now.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>{' '}
            to create your own.
          </p>
        </div>
      )}

      {/* Sign-in CTA */}
      <div className="mt-10 text-center border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Have a tournament code?{' '}
          <Link href="/auth/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>{' '}
          to see your tournaments.
        </p>
      </div>
    </section>
  )
}

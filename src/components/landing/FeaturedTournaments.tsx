import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, PlusCircle } from 'lucide-react'
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
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-heading font-semibold text-lg">Featured Tournaments</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Open tournaments looking for players
      </p>

      {serialized.length > 0 ? (
        <TournamentCardGrid
          tournaments={serialized}
          emptyMessage="No tournaments with open registration right now."
        />
      ) : (
        <Card className="border-dashed border-2 border-border shadow-none">
          <CardContent className="py-8 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-heading font-semibold text-base">No open tournaments</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              No tournaments with open registration right now. Sign in to create your own.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors mt-4"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              <PlusCircle className="w-4 h-4" />
              Create Tournament
            </Link>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground pt-4">
        Have a tournament code?{' '}
        <Link href="/auth/login" className="text-primary font-semibold hover:underline">
          Sign in
        </Link>{' '}
        to see your tournaments.
      </p>
    </section>
  )
}

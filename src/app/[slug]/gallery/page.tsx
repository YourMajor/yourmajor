import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { getAncestorChain } from '@/lib/tournament-chain'
import { PhotoGallery } from '@/components/hub/PhotoGallery'

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, startDate: true, parentTournamentId: true },
  })
  if (!tournament) return null

  const tier = await getTournamentTier(tournament.id)
  if (!TIER_LIMITS[tier].gallery) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-heading font-bold mb-4">Gallery</h1>
        <p className="text-muted-foreground">Photo gallery is available on Pro, Club, and Tour plans.</p>
      </main>
    )
  }

  const user = await getUser()

  const [membership, initialPhotos] = await Promise.all([
    user
      ? prisma.tournamentPlayer.findUnique({
          where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
          select: { id: true },
        })
      : null,
    prisma.tournamentPhoto.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ])

  // Build tournament filter options for renewed tournaments
  let tournamentFilters: Array<{ id: string; name: string; year: number }> | undefined
  if (tournament.parentTournamentId) {
    const ancestors = await getAncestorChain(tournament.id)
    const currentYear = tournament.startDate ? tournament.startDate.getFullYear() : new Date().getFullYear()
    tournamentFilters = [
      { id: tournament.id, name: tournament.name, year: currentYear },
      ...ancestors.map((a) => ({
        id: a.id,
        name: a.name,
        year: a.startDate ? a.startDate.getFullYear() : 0,
      })),
    ]
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold mb-6">Gallery</h1>
      <PhotoGallery
        tournamentId={tournament.id}
        currentUserId={user?.id ?? null}
        isRegistered={!!membership}
        initialPhotos={initialPhotos}
        tournamentFilters={tournamentFilters}
      />
    </main>
  )
}

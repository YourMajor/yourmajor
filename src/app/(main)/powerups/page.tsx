import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { PreDraftPowerupPreview } from '@/components/draft/PreDraftPowerupPreview'
import type { PowerupCardData } from '@/components/draft/PowerupCard'

export const metadata = { title: 'Powerups' }

// The whole live deck, outside any tournament. Same source a new tournament's
// pool is built from (retired cards excluded — see tournaments/new/actions).
export default async function PowerupsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const [powerups, favorites] = await Promise.all([
    prisma.powerup.findMany({
      where: { retiredAt: null },
      select: { id: true, slug: true, name: true, type: true, description: true, effect: true },
      orderBy: { name: 'asc' },
    }),
    prisma.powerupFavorite.findMany({ where: { userId: user.id }, select: { powerupId: true } }),
  ])

  return (
    <PreDraftPowerupPreview
      powerups={powerups as PowerupCardData[]}
      initialFavoriteIds={favorites.map((f) => f.powerupId)}
      heading="Powerups"
      description="Every card in the deck. Heart the ones you want — favourites follow you into every draft."
      backHref="/dashboard"
      waiting={false}
    />
  )
}

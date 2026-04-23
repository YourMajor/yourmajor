import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { BrandingUpsell } from './BrandingUpsell'

export default async function UpgradeInterstitialPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryColor: true,
      accentColor: true,
      players: {
        where: { userId: user.id, isAdmin: true },
        select: { id: true },
        take: 1,
      },
      purchase: {
        select: { id: true },
      },
    },
  })

  if (!tournament) redirect('/dashboard')

  // Only tournament admins can see this page
  const isAdmin = tournament.players.length > 0 || user.role === 'ADMIN'
  if (!isAdmin) redirect(`/${slug}`)

  // Already has a purchase — skip interstitial
  if (tournament.purchase) redirect(`/${slug}`)

  const userTier = await getUserTier(user.id)

  // Non-FREE users don't need the upsell
  if (userTier.tier !== 'FREE') redirect(`/${slug}`)

  return (
    <BrandingUpsell
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      slug={slug}
      proCredits={userTier.proCredits}
    />
  )
}
